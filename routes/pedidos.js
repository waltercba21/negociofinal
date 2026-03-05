const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController');
const ensureAuthenticated = require('../middleware/usuarioMiddleware');
const adminEmails = require('../config/admins');

// ─── Middleware: solo admins ───────────────────────────────────────────────────
function soloAdmin(req, res, next) {
    if (!req.session.usuario || !adminEmails.includes(req.session.usuario.email)) {
        return res.status(403).send('Acceso denegado');
    }
    next();
}

// Todas las rutas de pedidos son solo para admins
router.use(ensureAuthenticated, soloAdmin);

// Notificación en header (cantidad)
router.get('/cantidad', pedidosController.obtenerPedidosPendientes);

// Ver pedidos
router.get('/', pedidosController.obtenerPedidos);

// Confirmar pedido
router.post('/confirmar/:id', pedidosController.confirmarPedido);

// Preparación / Finalizado
router.post('/marcar-preparado/:id', pedidosController.marcarPedidoComoPreparado);
router.post('/finalizar/:id', pedidosController.marcarPedidoComoFinalizado);

// Detalle + PDF
router.get('/:id/detalle', pedidosController.obtenerDetallePedido);
router.get('/:id/pdf-preparacion', pedidosController.generarPDFPreparacion);

module.exports = router;
