const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController');

// Ruta para obtener la cantidad de pedidos pendientes (para la notificación en el header)
router.get('/cantidad', pedidosController.obtenerPedidosPendientes);

// Ruta para ver todos los pedidos (con opción de filtrado)
router.get('/', pedidosController.obtenerPedidos);

// Ruta para cambiar el estado a "preparación"
router.post('/marcar-preparado/:id', pedidosController.marcarPedidoComoPreparado);

// Ruta para cambiar el estado a "finalizado"
router.post('/finalizar/:id', pedidosController.marcarPedidoComoFinalizado);

module.exports = router;
