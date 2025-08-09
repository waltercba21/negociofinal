// controllers/reportesController.js
const ejs = require('ejs');
const path = require('path');
const puppeteer = require('puppeteer');
const producto = require('../models/producto');
const conexion = require('../database/conexion');

function getFirst(v) {
  return Array.isArray(v) ? v[0] : v;
}
function isDate(d) {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

module.exports = {
  recomendacionesCompra: async (req, res) => {
    try {
      // Normalizar query params
      let categoria_id = getFirst(req.query.categoria_id) || null;
      let desde        = getFirst(req.query.desde) || null;
      let hasta        = getFirst(req.query.hasta) || null;

      const cat = Number.parseInt(categoria_id, 10);
      categoria_id = Number.isInteger(cat) && cat > 0 ? cat : null;

      desde = isDate(desde) ? desde : null;
      hasta = isDate(hasta) ? hasta : null;

      console.log('➡️ /reportes/recomendaciones', { categoria_id, desde, hasta });

      // 1) Más vendidos (facturas + presupuestos)
      const masVendidos = await producto.obtenerMasVendidos(conexion, {
        categoria_id,
        desde,
        hasta,
        limit: 100
      });

      // 2) Más buscados (clicks en buscador)
      const masBuscados = await producto.obtenerMasBuscados(conexion, {
        categoria_id,
        desde,
        hasta,
        limit: 100
      });

      // 3) Fusionar (ventas 0.7 + búsquedas 0.3)
      const ventasById = new Map();
      const buscById = new Map();
      const metaById = new Map();

      for (const r of masVendidos) {
        ventasById.set(r.id, Number(r.total_vendido) || 0);
        metaById.set(r.id, { nombre: r.nombre, precio_venta: r.precio_venta });
      }
      for (const r of masBuscados) {
        buscById.set(r.id, Number(r.total_buscado) || 0);
        if (!metaById.has(r.id)) {
          metaById.set(r.id, { nombre: r.nombre, precio_venta: r.precio_venta });
        }
      }

      const productosIds = new Set([
        ...ventasById.keys(),
        ...buscById.keys()
      ]);

      const ranking = [];
      for (const id of productosIds) {
        const ventas = ventasById.get(id) || 0;
        const buscado = buscById.get(id) || 0;
        const meta = metaById.get(id) || { nombre: '', precio_venta: 0 };
        ranking.push({
          id,
          nombre: meta.nombre,
          precio_venta: meta.precio_venta,
          ventas,
          buscado,
          score: ventas * 0.7 + buscado * 0.3
        });
      }
      ranking.sort((a, b) => b.score - a.score);

      // 4) Render EJS -> HTML
      const templatePath = path.resolve(__dirname, '..', 'views', 'reportes', 'recomendacionesCompra.ejs');
      const html = await ejs.renderFile(templatePath, {
        filtros: { categoria_id, desde, hasta },
        topVendidos: masVendidos.slice(0, 20),
        topBuscados: masBuscados.slice(0, 20),
        ranking: ranking.slice(0, 50)
      });

      // 5) HTML -> PDF (con fallback a HTML si no hay Puppeteer)
      try {
        const browser = await puppeteer.launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox']
          // Si necesitás path a Chromium del sistema, agregamos executablePath acá.
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20mm', right: '12mm', bottom: '18mm', left: '12mm' }
        });
        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="recomendaciones_compra.pdf"');
        return res.send(pdfBuffer);
      } catch (pdfErr) {
        console.error('⚠️ Puppeteer falló, devuelvo HTML:', pdfErr.message);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
      }
    } catch (error) {
      console.error('❌ recomendacionesCompra:', error);
      return res.status(500).send('Error al generar recomendaciones');
    }
  }
};
