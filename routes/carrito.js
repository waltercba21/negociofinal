    const express = require('express');
    const router = express.Router();
    const carritoController = require('../controllers/carritoController');

    function autenticarUsuario(req, res, next) {
        if (!req.session || !req.session.usuario || !req.session.usuario.id) {
            return res.redirect('/login'); // Redirige si no está autenticado
        }
        next();
    }
    
    // Ruta para ver el carrito de compras
    router.get('/', autenticarUsuario, carritoController.verCarrito);
    // Ruta para crear un carrito (si no existe uno activo)
    router.get('/crear', carritoController.crearCarrito);
    // Ruta para obtener el ID del carrito activo en formato JSON
    router.get('/activo', autenticarUsuario, carritoController.obtenerCarritoID);

    // Ruta para agregar un producto al carrito
    router.post('/agregar', carritoController.agregarProductoCarrito);


    router.post('/actualizar', carritoController.actualizarCantidad);
    
    // Ruta para obtener la cantidad total del carrito
    router.get('/cantidad', autenticarUsuario, carritoController.obtenerCantidadCarrito);

    // Ruta para elegir el envio del pedido del carrito
    router.get ('/envio', carritoController.envio);
    router.post('/envio', autenticarUsuario, carritoController.guardarEnvio);
    router.post('/envio/actualizar', autenticarUsuario, carritoController.actualizarDireccionEnvio);


    // Ruta para continuar a la confirmacion de datos
    router.get ('/confirmarDatos', carritoController.confirmarDatos);
    
    // Ruta para eliminar un producto del carrito
    router.post('/eliminar', carritoController.eliminarProducto);

    // Ruta para finalizar la compra
    router.get('/finalizar', carritoController.finalizarCompra);

    module.exports = router;
