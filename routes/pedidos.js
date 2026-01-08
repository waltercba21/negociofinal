const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController');

// Notificación en header (cantidad)
router.get('/cantidad', pedidosController.obtenerPedidosPendientes);

// Ver pedidos (filtrados)
router.get('/', pedidosController.obtenerPedidos);

// ✅ NUEVO: confirmar pedido
router.post('/confirmar/:id', pedidosController.confirmarPedido);

// Preparación / Finalizado
router.post('/marcar-preparado/:id', pedidosController.marcarPedidoComoPreparado);
router.post('/finalizar/:id', pedidosController.marcarPedidoComoFinalizado);

// Detalle + PDF
router.get('/:id/detalle', pedidosController.obtenerDetallePedido);
router.get('/:id/pdf-preparacion', pedidosController.generarPDFPreparacion);

module.exports = router;
