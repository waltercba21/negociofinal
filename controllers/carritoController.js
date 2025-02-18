const carrito = require('../models/carrito');
const producto = require('../models/producto');

module.exports = {
    // Crear un carrito nuevo si no existe
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
                    res.redirect('/carrito'); // Redirigir a la vista del carrito
                });
            } else {
                res.redirect('/carrito');
            }
        });
    },

    // Agregar un producto al carrito
    agregarProductoCarrito: (req, res) => {
        if (!req.session.usuario) {
            return res.status(401).send('Usuario no autenticado');
        }
    
        const id_usuario = req.session.usuario.id;
        const { id_producto, cantidad } = req.body;
    
        carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
            if (error) {
                console.error('Error al obtener el carrito:', error);
                return res.status(500).send('Error interno del servidor');
            }
    
            if (carritoActivo.length === 0) {
                return res.status(400).send('No tienes un carrito activo');
            }
    
            const id_carrito = carritoActivo[0].id;
    
            producto.obtenerProductoConImagenes(id_producto, (error, producto) => {
                if (error || producto.length === 0) {
                    console.error('Error al obtener el producto:', error);
                    return res.status(500).send('Error al obtener el producto');
                }
    
                const precio = producto[0].precio;
    
                carrito.agregarProductoCarrito(id_carrito, id_producto, cantidad, precio, (error) => {
                    if (error) {
                        console.error('Error al agregar el producto:', error);
                        return res.status(500).send('Error al agregar el producto al carrito');
                    }
    
                    console.log(`Producto ${id_producto} agregado al carrito ${id_carrito}`);
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
                return res.render('carrito', { productos: [] }); // Si no hay carrito, renderiza vacío
            }
    
            const id_carrito = carritoActivo[0].id;
    
            // Obtener los productos del carrito
            carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
                if (error) {
                    return res.status(500).send('Error al obtener los productos del carrito');
                }
    
                // Pasar los productos a la vista
                res.render('carrito', { productos });
            });
        });
    },    

    // Finalizar la compra
    finalizarCompra: (req, res) => {
        const id_usuario = req.session.usuario.id;

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
