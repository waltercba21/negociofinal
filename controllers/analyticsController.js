// controllers/analyticsController.js
const producto  = require('../models/producto');           // 👈 FALTABA
const conexion = require('../config/conexion')         // 👈 FALTABA (ajustá la ruta si usás ../config/conexion)
const requestIp = (req) => (req.headers['x-forwarded-for']?.split(',')[0] || req.ip || null);

module.exports = {
  logBusquedaTexto: async (req, res) => {
    try {
      let { q, origen } = req.body || {};
      q = (q || '').toString().trim().slice(0, 255);
      origen = (origen === 'selectores') ? 'selectores' : 'texto';

      if (!q || q.length < 1) return res.json({ ok: true, skipped: 'empty' });

      await producto.insertarBusquedaTexto(conexion, {
        q,
        origen,
        user_id: req.session?.usuario?.id || null,    // mejor que req.user
        ip: requestIp(req)
      });
      return res.json({ ok: true });
    } catch (e) {
      console.error('❌ logBusquedaTexto', e);
      return res.status(500).json({ ok: false });
    }
  },

  logBusquedaProducto: async (req, res) => {
    try {
      let { producto_id, q } = req.body || {};
      const pid = Number(producto_id);
      q = (q || '').toString().trim().slice(0, 255);
      if (!pid) return res.status(400).json({ ok: false, error: 'no_producto_id' });

      await producto.insertarBusquedaProducto(conexion, {
        producto_id: pid,
        q: q || null,
        user_id: req.session?.usuario?.id || null,
        ip: requestIp(req)
      });
      return res.json({ ok: true });
    } catch (e) {
      console.error('❌ logBusquedaProducto', e);
      return res.status(500).json({ ok: false });
    }
  }
};
