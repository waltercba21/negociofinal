// controllers/reportesController.js
const ejs = require('ejs');
const path = require('path');
const puppeteer = require('puppeteer');
const producto = require('../models/producto');
const conexion = require('../config/conexion');

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

      // 1) Top 50 más vendidos (facturas + presupuestos)
      const topVendidos = await producto.obtenerMasVendidos(conexion, {
        categoria_id,
        desde,
        hasta,
        limit: 50
      });

      // 2) Top 50 más buscados (detallado: clicks, textos, total_buscado y ventas)
      const topBuscados = await producto.obtenerMasBuscadosDetallado(conexion, {
        categoria_id,
        desde,
        hasta,
        limit: 50,
        weightText: 0.3 // peso de búsquedas de texto en total_buscado
      });

      // 3) Render EJS -> HTML (solo 2 secciones solicitadas)
      const templatePath = path.resolve(__dirname, '..', 'views', 'reportes', 'recomendacionesCompra.ejs');
      const html = await ejs.renderFile(templatePath, {
        filtros: { categoria_id, desde, hasta },
        topVendidos,   // #, Producto, Ventas
        topBuscados    // #, Producto, Clicks, Búsquedas texto, Total buscado, Ventas
      });

      // 4) HTML -> PDF (fallback a HTML si falla)
      try {
        const browser = await puppeteer.launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox']
          // executablePath: '/usr/bin/chromium-browser', // <-- si tu server lo requiere
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

