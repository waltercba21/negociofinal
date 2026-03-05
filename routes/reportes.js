const express = require('express');
const router = express.Router();
const reportes = require('../controllers/reportesController');
const ensureAuthenticated = require('../middleware/usuarioMiddleware');
const adminEmails = require('../config/admins');

// ─── Middleware: solo admins ───────────────────────────────────────────────────
function soloAdmin(req, res, next) {
    if (!req.session.usuario || !adminEmails.includes(req.session.usuario.email)) {
        return res.status(403).send('Acceso denegado');
    }
    next();
}

// Todas las rutas de reportes son solo para admins
router.use(ensureAuthenticated, soloAdmin);

router.get('/mas-vendidos', reportes.masVendidosView);
router.get('/recomendaciones', reportes.recomendacionesCompra);
router.get('/ventas-producto', reportes.ventasDeProducto);

module.exports = router;
