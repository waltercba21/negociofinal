const express = require('express');
const router = express.Router();
const carritoController = require('../controllers/carritoController');
const calcularCantidadCarrito = require('../middleware/carritoMiddleware');

// Aplica el middleware solo a las rutas relacionadas con el carrito
router.use(calcularCantidadCarrito);

// Ruta para crear un carrito (si no existe uno activo)
router.get('/crear', carritoController.crearCarrito);

// Ruta para agregar un producto al carrito
router.post('/agregar', carritoController.agregarProductoCarrito);

// Ruta para ver el carrito de compras
router.get('/', carritoController.verCarrito);

// Ruta para finalizar la compra
router.get('/finalizar', carritoController.finalizarCompra);

module.exports = router;
