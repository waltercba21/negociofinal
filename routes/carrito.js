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

    // Ruta para agregar un producto al carrito
    router.post('/agregar', carritoController.agregarProductoCarrito);


    router.post('/actualizar', carritoController.actualizarCantidad);



    // Ruta para finalizar la compra
    router.get('/finalizar', carritoController.finalizarCompra);

    module.exports = router;
