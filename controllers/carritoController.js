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
    agregarProductoCarrito : (req, res) => {
        const { id_producto, cantidad } = req.body;
        const id_usuario = req.session.usuario.id;
    
        // Primero, obtenemos el carrito activo del usuario
        carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
            if (error) {
                console.error('Error al obtener carrito:', error);
                return res.status(500).json({ error: 'Error al obtener carrito' });
            }
    
            let id_carrito;
    
            if (!carritoActivo || carritoActivo.length === 0) {
                // Si el usuario no tiene carrito, creamos uno nuevo
                carrito.crearCarrito(id_usuario, (error, nuevoCarritoId) => {
                    if (error) {
                        console.error('Error al crear carrito:', error);
                        return res.status(500).json({ error: 'Error al crear carrito' });
                    }
    
                    id_carrito = nuevoCarritoId;
                    agregarProducto(id_carrito);
                });
            } else {
                // Si el usuario ya tiene un carrito, usamos su ID
                id_carrito = carritoActivo[0].id;
                agregarProducto(id_carrito);
            }
        });
    
        function agregarProducto(id_carrito) {
            carrito.agregarProductoCarrito(id_carrito, id_producto, cantidad, (error) => {
                if (error) {
                    console.error('Error al agregar producto:', error);
                    return res.status(500).json({ error: 'Error al agregar producto al carrito' });
                }
    
                carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
                    if (error) {
                        console.error('Error al obtener productos:', error);
                        return res.status(500).json({ error: 'Error al obtener productos' });
                    }
    
                    const cantidadTotal = productos.reduce((acc, producto) => acc + producto.cantidad, 0);
                    console.log(`🛒 Nueva cantidad total del carrito: ${cantidadTotal}`);
                    res.status(200).json({ cantidadTotal });
                });
            });
        }
    },
    verCarrito: (req, res) => {
        // Verificar si el usuario está autenticado 
        if (!req.session || !req.session.usuario || !req.session.usuario.id) {
            return res.status(401).send('Debes iniciar sesión para acceder al carrito');
        }
    
        const id_usuario = req.session.usuario.id;
    
        // Obtener el carrito activo del usuario
        carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
            if (error) {
                console.error('Error al obtener el carrito:', error);
                return res.status(500).send('Error al obtener el carrito');
            }
    
            if (!carritoActivo || carritoActivo.length === 0) {
                // Si no hay productos en el carrito, renderiza con cantidad y total 0
                return res.render('carrito', { 
                    productos: [], 
                    cantidadProductosCarrito: 0, 
                    total: 0, 
                    cantidadCarrito: 0 // Aseguramos que cantidadCarrito esté definida
                });
            }
    
            const id_carrito = carritoActivo[0].id;
    
            // Obtener los productos del carrito con las imágenes
            carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
                if (error) {
                    console.error('Error al obtener los productos del carrito:', error);
                    return res.status(500).send('Error al obtener los productos del carrito');
                }
    
                console.log('Productos cargados en el carrito:', productos);
    
                // Calcular la cantidad total de productos (suma de las cantidades de cada uno)
                const cantidadTotal = productos.reduce((acc, p) => acc + p.cantidad, 0);
    
                // Calcular el total del carrito (precio total de los productos)
                const total = productos.reduce((acc, p) => acc + p.total, 0).toFixed(2);
    
                // Renderiza la vista del carrito con la cantidad total de unidades
                res.render('carrito', { 
                    productos, 
                    cantidadProductosCarrito: cantidadTotal, // Suma total de unidades
                    total, 
                    cantidadCarrito: cantidadTotal // Actualiza el globo con el total de unidades
                });
            });
        });
    },
    actualizarCantidad: (req, res) => {
        const { id, accion } = req.body;
    
        // Validar si el usuario tiene sesión activa
        if (!req.session || !req.session.usuario || !req.session.usuario.id) {
            console.error('Error: Sesión no iniciada o usuario no definido.');
            return res.status(401).json({ error: 'Sesión no válida. Inicia sesión nuevamente.' });
        }
    
        console.log(`Actualizando producto con ID: ${id}, Acción: ${accion}`);
    
        // Verificar si el producto existe
        carrito.obtenerProductoPorId(id, (error, producto) => {
            if (error) {
                console.error('Error al obtener el producto:', error);
                return res.status(500).json({ error: 'Error al buscar el producto' });
            }
            if (!producto) {
                console.error('Producto no encontrado con ID:', id);
                return res.status(404).json({ error: 'Producto no encontrado' });
            }
    
            console.log('Producto encontrado:', producto);
    
            // Calcular la nueva cantidad
            let nuevaCantidad = producto.cantidad;
            if (accion === 'aumentar') nuevaCantidad++;
            if (accion === 'disminuir' && nuevaCantidad > 1) nuevaCantidad--;
    
            console.log(`Nueva cantidad calculada: ${nuevaCantidad}`);
    
            // Actualizar la cantidad en la base de datos
            carrito.actualizarCantidad(id, nuevaCantidad, (error) => {
                if (error) {
                    console.error('Error al actualizar la cantidad:', error);
                    return res.status(500).json({ error: 'Error al actualizar la cantidad' });
                }
    
                console.log(`Cantidad actualizada con éxito: ${nuevaCantidad}`);
    
                // Obtener el carrito actualizado
                carrito.obtenerCarritoPorUsuario(req.session.usuario.id, (error, productos) => {
                    if (error) {
                        console.error('Error al obtener el carrito actualizado:', error);
                        return res.status(500).json({ error: 'Error al obtener el carrito actualizado' });
                    }
    
                    const cantidadTotal = productos.reduce((acc, p) => acc + p.cantidad, 0);
                    console.log(`Cantidad total actualizada en el carrito: ${cantidadTotal}`);
    
                    res.status(200).json({ 
                        mensaje: 'Cantidad actualizada', 
                        nuevaCantidad, 
                        cantidadTotal 
                    });
                });
            });
        });
    },
    
    obtenerCantidadCarrito: (req, res) => {
        const id_usuario = req.session.usuario.id;
    
        carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
            if (error) {
                console.error('Error al obtener el carrito activo:', error);
                return res.status(500).json({ error: 'Error al obtener el carrito activo' });
            }
    
            if (!carritoActivo || carritoActivo.length === 0) {
                return res.status(200).json({ cantidadTotal: 0 }); // Si no hay carrito, la cantidad es 0
            }
    
            const id_carrito = carritoActivo[0].id;
    
            carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
                if (error) {
                    console.error('Error al obtener los productos del carrito:', error);
                    return res.status(500).json({ error: 'Error al obtener los productos del carrito' });
                }
    
                const cantidadTotal = productos.reduce((acc, producto) => acc + producto.cantidad, 0);
    
                res.status(200).json({ cantidadTotal });
            });
        });
    },    
    eliminarProducto: (req, res) => {
        const { id } = req.body;
    
        if (!id) {
            return res.status(400).json({ error: 'ID del producto no proporcionado' });
        }
    
        carrito.eliminarProductoPorId(id, (error) => {
            if (error) {
                console.error('Error al eliminar el producto del carrito:', error);
                return res.status(500).json({ error: 'Error al eliminar el producto' });
            }
    
            res.status(200).json({ mensaje: 'Producto eliminado del carrito' });
        });
    },

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
