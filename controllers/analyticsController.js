// controllers/analyticsController.js
module.exports = {
  logBusquedaTexto: async (req, res) => {
    try {
      const { q, origen } = req.body;
      if (!q || q.trim().length < 2) return res.status(400).json({ ok: false });
      await producto.insertarBusquedaTexto(conexion, {
        q: q.trim(),
        origen: origen || 'texto',
        user_id: req.user?.id || null,
        ip: req.ip
      });
      res.json({ ok: true });
    } catch (e) {
      console.error('logBusquedaTexto', e);
      res.status(500).json({ ok: false });
    }
  },

  logBusquedaProducto: async (req, res) => {
    try {
      const { producto_id, q } = req.body;
      if (!producto_id) return res.status(400).json({ ok: false });
      await producto.insertarBusquedaProducto(conexion, {
        producto_id: Number(producto_id),
        q: (q || '').trim() || null,
        user_id: req.user?.id || null,
        ip: req.ip
      });
      res.json({ ok: true });
    } catch (e) {
      console.error('logBusquedaProducto', e);
      res.status(500).json({ ok: false });
    }
  }
};
