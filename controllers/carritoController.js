const carrito = require('../models/carrito');
const producto = require('../models/producto'); // Este modelo debe existir para obtener los productos
const { validationResult } = require('express-validator');

module.exports = {
    crearCarrito: (req, res) => {
        const id_usuario = req.session.usuario.id;

        carrito.obtenerCarritoActivo(id_usuario, (error, carritoExistente) => {
            if (error) {
                return res.status(500).send('Error al verificar el carrito');
            }

            if (carritoExistente.length === 0) {
                carrito.crearCarrito(id_usuario, (error, nuevoCarritoId) => {
                    if (error) {
                        return res.status(500).send('Error al crear el carrito');
                    }
                    console.log(`Carrito creado con ID: ${nuevoCarritoId}`);
                    res.redirect('/carrito'); 
                });
            } else {
                res.redirect('/carrito');
            }
        });
    },
    agregarProductoCarrito: (req, res) => {
        const id_usuario = req.session.usuario.id;
        const { id_producto, cantidad } = req.body;
        carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
            if (error) {
                return res.status(500).send('Error al obtener carrito');
            }

            if (carritoActivo.length === 0) {
                return res.status(400).send('No tienes un carrito activo');
            }

            const id_carrito = carritoActivo[0].id;
            producto.obtenerProductoConImagenes(id_producto, (error, producto) => {
                if (error) {
                    return res.status(500).send('Error al obtener el producto');
                }

                const precio = producto[0].precio;
                carrito.agregarProductoCarrito(id_carrito, id_producto, cantidad, precio, (error, resultado) => {
                    if (error) {
                        return res.status(500).send('Error al agregar el producto al carrito');
                    }

                    console.log('Producto agregado al carrito');
                    res.redirect('/carrito'); 
                });
            });
        });
    },
    verCarrito: (req, res) => {
        const id_usuario = req.session.usuario.id;

        carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
            if (error) {
                return res.status(500).send('Error al obtener el carrito');
            }

            if (carritoActivo.length === 0) {
                return res.render('carrito', { mensaje: 'No tienes un carrito activo' });
            }

            const id_carrito = carritoActivo[0].id;

            // Obtener productos del carrito
            carrito.obtenerProductosCarrito(id_carrito, (error, productosCarrito) => {
                if (error) {
                    return res.status(500).send('Error al obtener los productos del carrito');
                }

                res.render('carrito', { productos: productosCarrito });
            });
        });
    },

    // Finalizar la compra
    finalizarCompra: (req, res) => {
        const id_usuario = req.session.usuario.id;

        // Obtener carrito activo del usuario
        carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
            if (error) {
                return res.status(500).send('Error al obtener carrito');
            }

            if (carritoActivo.length === 0) {
                return res.status(400).send('No tienes un carrito activo');
            }

            const id_carrito = carritoActivo[0].id;

            // Finalizar el carrito
            carrito.finalizarCompra(id_carrito, (error) => {
                if (error) {
                    return res.status(500).send('Error al finalizar la compra');
                }
                console.log('Compra finalizada');
                res.redirect('/'); // Redirigir al usuario a la página principal
            });
        });
    }
};
