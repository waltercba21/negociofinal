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
    agregarProductoCarrito: (req, res) => {
        try {
            console.log("📥 Datos recibidos en /carrito/agregar:", req.body);
    
            const usuario_id = req.session?.usuario?.id;
            if (!usuario_id) {
                console.error("❌ Error: Usuario no autenticado.");
                return res.status(401).send('Usuario no autenticado.');
            }
    
            const { id_producto, cantidad } = req.body;
    
            if (!id_producto || isNaN(cantidad) || cantidad <= 0) {
                console.error("❌ Error: Datos inválidos.", { id_producto, cantidad });
                return res.status(400).send('Datos inválidos.');
            }
    
            carrito.obtenerCarritoActivo(usuario_id, (error, carritoActivo) => {
                if (error) {
                    console.error("❌ Error al obtener el carrito activo:", error);
                    return res.status(500).send('Error al obtener el carrito.');
                }
    
                const id_carrito = carritoActivo?.length > 0 ? carritoActivo[0].id : null;
    
                // Si no hay carrito activo, crear uno
                if (!id_carrito) {
                    console.warn("⚠️ No hay un carrito activo. Creando uno nuevo...");
                    carrito.crearCarrito(usuario_id, (error, nuevoCarritoId) => {
                        if (error) {
                            console.error("❌ Error al crear un nuevo carrito:", error);
                            return res.status(500).send('Error al crear el carrito.');
                        }
                        console.log("🆕 Carrito creado con ID:", nuevoCarritoId);
                        // Mover la llamada a agregarProducto dentro del callback
                        agregarProducto(nuevoCarritoId);
                    });
                } else {
                    console.log("🛒 Carrito activo encontrado con ID:", id_carrito);
                    agregarProducto(id_carrito);
                }
            });
    
            function agregarProducto(id_carrito) {
                producto.obtenerProductoConImagenes(id_producto, (error, productoInfo) => {
                    if (error) {
                        console.error("❌ Error al obtener el producto:", error);
                        return res.status(500).send('Error al obtener el producto.');
                    }
    
                    if (!productoInfo || productoInfo.length === 0) {
                        console.warn("⚠️ Producto no encontrado.");
                        return res.status(404).send('Producto no encontrado.');
                    }
    
                    const precio = productoInfo.precio_venta; // Aquí estamos usando precio_venta
                    console.log("📦 Producto obtenido:", productoInfo);
    
                    // Aquí no insertamos precio, solo carrito_id, producto_id y cantidad
                    carrito.agregarProductoCarrito(id_carrito, id_producto, cantidad, (error, resultado) => {
                        if (error) {
                            console.error("❌ Error al agregar el producto al carrito:", error);
                            return res.status(500).send('Error al agregar el producto al carrito.');
                        }
    
                        console.log("✅ Producto agregado al carrito:", resultado);
                        res.status(200).json({ mensaje: 'Producto agregado al carrito' });
                    });
                });
            }
    
        } catch (error) {
            console.error("❌ Error inesperado en agregarProductoCarrito:", error);
            res.status(500).send('Error interno del servidor.');
        }
    },
    
    
    
    verCarrito: (req, res) => {
        // Validar la sesión y el usuario
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
    
            // Si no hay carrito activo, renderiza una vista vacía
            if (!carritoActivo || carritoActivo.length === 0) {
                return res.render('carrito', { productos: [], cantidadProductosCarrito: 0 });
            }
    
            const id_carrito = carritoActivo[0].id;
    
            // Obtener los productos del carrito
            carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
                if (error) {
                    console.error('Error al obtener los productos del carrito:', error);
                    return res.status(500).send('Error al obtener los productos del carrito');
                }
    
                // Calcular la cantidad total de productos en el carrito
                const cantidadTotal = productos.reduce((acc, p) => acc + (p.cantidad || 0), 0);
    
                res.render('carrito', { productos, cantidadProductosCarrito: cantidadTotal });
            });
        });
    },    
    actualizarCantidad: (req, res) => {
        const { id, accion } = req.body;
    
        carrito.obtenerProductoPorId(id, (error, producto) => {
            if (error || !producto) return res.status(500).json({ error: 'Producto no encontrado' });
    
            let nuevaCantidad = producto.cantidad;
    
            if (accion === 'aumentar') nuevaCantidad++;
            if (accion === 'disminuir' && nuevaCantidad > 1) nuevaCantidad--;
    
            carrito.actualizarCantidad(id, nuevaCantidad, (error) => {
                if (error) return res.status(500).json({ error: 'Error al actualizar la cantidad' });
                res.status(200).json({ mensaje: 'Cantidad actualizada' });
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
