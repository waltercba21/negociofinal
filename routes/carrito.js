const express = require('express');
const router = express.Router();
const carritoController = require('../controllers/carritoController');

function autenticarUsuario(req, res, next) {
  if (!req.session || !req.session.usuario || !req.session.usuario.id) {
    return res.redirect('/login');
  }
  next();
}

// Ver carrito
router.get('/', autenticarUsuario, carritoController.verCarrito);

// Crear carrito (si lo usás manualmente)
router.get('/crear', autenticarUsuario, carritoController.crearCarrito);

// Obtener ID carrito activo JSON
router.get('/activo', autenticarUsuario, carritoController.obtenerCarritoID);

// Agregar producto
router.post('/agregar', autenticarUsuario, carritoController.agregarProductoCarrito);

// Actualizar cantidad
router.post('/actualizar', autenticarUsuario, carritoController.actualizarCantidad);

// Cantidad total del carrito
router.get('/cantidad', autenticarUsuario, carritoController.obtenerCantidadCarrito);

// Envío
router.get('/envio', autenticarUsuario, carritoController.envio);
router.post('/envio', autenticarUsuario, carritoController.guardarEnvio);
router.post('/envio/actualizar', autenticarUsuario, carritoController.actualizarDireccionEnvio);

// Confirmar datos
router.get('/confirmarDatos', autenticarUsuario, carritoController.confirmarDatos);

// Eliminar producto
router.post('/eliminar', autenticarUsuario, carritoController.eliminarProducto);

// Finalizar compra
router.get('/finalizar', autenticarUsuario, carritoController.finalizarCompra);

// Pago
router.get('/pago', autenticarUsuario, carritoController.vistaPago);
router.post('/pago', autenticarUsuario, carritoController.procesarPago);

// Resultado pago
router.get('/pago-exito', autenticarUsuario, carritoController.vistaPagoExitoso);

router.get('/pago-error', autenticarUsuario, (req, res) => {
  res.render('pagoError', { mensaje: "Hubo un error en el pago. Intenta nuevamente." });
});

router.get('/pago-pendiente', autenticarUsuario, (req, res) => {
  res.render('pagoPendiente', { mensaje: "Tu pago está pendiente de aprobación." });
});

// ✅ Comprobantes (seguro)
router.get('/comprobante', autenticarUsuario, carritoController.generarComprobante);       // último pedido
router.get('/comprobante/:id', autenticarUsuario, carritoController.generarComprobante);  // pedido específico

module.exports = router;
