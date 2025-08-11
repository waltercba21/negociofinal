// controllers/reportesController.js
const ejs = require('ejs');
const path = require('path');
const puppeteer = require('puppeteer');
const producto = require('../models/producto');
const conexion = require('../config/conexion');

function getFirst(v) { return Array.isArray(v) ? v[0] : v; }
function isDate(d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d); }

// ========================= VISTA: MAS VENDIDOS =========================
async function masVendidosView(req, res) {
  try {
    let categoria_id = getFirst(req.query.categoria_id) || null;
    let desde        = getFirst(req.query.desde) || null;
    let hasta        = getFirst(req.query.hasta) || null;
    let busqueda     = (getFirst(req.query.busqueda) || '').trim();

    const cat = Number.parseInt(categoria_id, 10);
    categoria_id = Number.isInteger(cat) && cat > 0 ? cat : null;
    desde = isDate(desde) ? desde : null;
    hasta = isDate(hasta) ? hasta : null;

    const [categorias, productos] = await Promise.all([
      producto.obtenerCategorias(conexion),
      producto.obtenerMasVendidos(conexion, {
        categoria_id,
        desde,
        hasta,
        busqueda,
        limit: 100
      })
    ]);

    return res.render('productosMasVendidos', {
      categorias,
      filtros: { categoria_id, desde, hasta, busqueda },
      productos
    });
  } catch (e) {
    console.error('❌ masVendidosView:', e);
    return res.status(500).send('Error cargando reporte de más vendidos');
  }
}

// ========================= PDF: RECOMENDACIONES =========================
async function recomendacionesCompra(req, res) {
  try {
    let categoria_id = getFirst(req.query.categoria_id) || null;
    let desde        = getFirst(req.query.desde) || null;
    let hasta        = getFirst(req.query.hasta) || null;

    const cat = Number.parseInt(categoria_id, 10);
    categoria_id = Number.isInteger(cat) && cat > 0 ? cat : null;
    desde = isDate(desde) ? desde : null;
    hasta = isDate(hasta) ? hasta : null;

    console.log('➡️ /reportes/recomendaciones', { categoria_id, desde, hasta });

    // Top 50 más vendidos (facturas + presupuestos)
    const topVendidos = await producto.obtenerMasVendidos(conexion, {
      categoria_id, desde, hasta, limit: 50
    });

    // Top 50 más buscados (detallado)
    const topBuscados = await producto.obtenerMasBuscadosDetallado(conexion, {
      categoria_id, desde, hasta, limit: 50, weightText: 0.3
    });

    // Sugerido de compra
    const DAY_MS = 24 * 60 * 60 * 1000;
    const COVER_DAYS = 15;

    const start = desde ? new Date(desde + 'T00:00:00') : null;
    const end   = hasta ? new Date(hasta + 'T23:59:59') : null;

    let periodDays;
    if (start && end && end > start) {
      periodDays = Math.max(7, Math.ceil((end - start) / DAY_MS));
    } else {
      periodDays = 30;
    }

    const ventasById = new Map();
    const stockById  = new Map();
    const metaById   = new Map();

    for (const p of topVendidos) {
      ventasById.set(p.id, Number(p.total_vendido) || 0);
      stockById.set(p.id, {
        actual: Number(p.stock_actual) || 0,
        minimo: Number(p.stock_minimo) || 0
      });
      metaById.set(p.id, { nombre: p.nombre });
    }
    for (const r of topBuscados) {
      if (!ventasById.has(r.id)) ventasById.set(r.id, Number(r.ventas) || 0);
      if (!stockById.has(r.id)) {
        stockById.set(r.id, {
          actual: Number(r.stock_actual) || 0,
          minimo: Number(r.stock_minimo) || 0
        });
      }
      if (!metaById.has(r.id)) metaById.set(r.id, { nombre: r.nombre });
    }

    const allIds = [...new Set([...ventasById.keys(), ...stockById.keys()])];
    const sugeridos = [];

    for (const id of allIds) {
      const ventasPeriodo = ventasById.get(id) || 0;
      const vxd = ventasPeriodo / periodDays;
      const objetivo = Math.ceil(vxd * COVER_DAYS);
      const { actual, minimo } = stockById.get(id) || { actual: 0, minimo: 0 };
      const base = Math.max(minimo, objetivo);
      const sugerido = Math.max(0, base - actual);

      sugeridos.push({
        id,
        nombre: metaById.get(id)?.nombre || '',
        ventas_periodo: ventasPeriodo,
        stock_actual: actual,
        stock_minimo: minimo,
        cobertura_objetivo: COVER_DAYS,
        sugerido
      });
    }

    sugeridos.sort((a, b) => b.sugerido - a.sugerido);
    const topSugeridos = sugeridos.slice(0, 50);

    // Render EJS -> HTML
    const templatePath = path.resolve(__dirname, '..', 'views', 'reportes', 'recomendacionesCompra.ejs');
    const html = await ejs.renderFile(templatePath, {
      filtros: { categoria_id, desde, hasta },
      topVendidos,
      topBuscados,
      topSugeridos
    });

    // HTML -> PDF (fallback a HTML si falla)
    try {
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
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

// ========================= API: VENTAS (y búsquedas) DE PRODUCTO =========================
async function ventasDeProducto(req, res) {
  try {
    const producto_id = parseInt(req.query.producto_id, 10);
    const desde = req.query.desde || null;
    const hasta = req.query.hasta || null;
    const agrupar = (req.query.agrupar === 'dia') ? 'dia' : null;
    const incluirBusquedas = req.query.incluir_busquedas === '1';

    if (!Number.isInteger(producto_id) || producto_id <= 0) {
      return res.status(400).json({ ok: false, error: 'producto_id inválido' });
    }

    // Ventas
    const ventas = await producto.obtenerVentasDeProducto(conexion, {
      producto_id,
      desde,
      hasta,
      agruparPor: agrupar
    });

    // Búsquedas (opcional)
    let busquedas = null;
    if (incluirBusquedas) {
      busquedas = await producto.obtenerBusquedasDeProducto(conexion, {
        producto_id,
        desde,
        hasta,
        weightText: 0.3
      });
    }

    return res.json({
      ok: true,
      producto_id,
      desde,
      hasta,
      ...(agrupar === 'dia'
        ? { detalle: ventas.detalle, total_ventas: ventas.total }
        : { total_ventas: ventas.total }),
      ...(incluirBusquedas ? { busquedas } : {})
    });
  } catch (e) {
    console.error('❌ ventasDeProducto:', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}

module.exports = {
  masVendidosView,
  recomendacionesCompra,
  ventasDeProducto
};
