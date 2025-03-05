const carrito = require('../models/carrito');
const mercadopago = require('mercadopago');
const producto = require('../models/producto');

mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN
});

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
    obtenerCarritoID: (req, res) => {
        const id_usuario = req.session.usuario.id;
    
        carrito.obtenerCarritoActivo(id_usuario, (error, carritos) => {
            if (error) {
                console.error("❌ Error al obtener el carrito:", error);
                return res.status(500).json({ success: false, error: "Error al obtener el carrito" });
            }
    
            if (!carritos || carritos.length === 0) {
                return res.status(404).json({ success: false, error: "No se encontró un carrito activo" });
            }
    
            res.json({ success: true, carrito_id: carritos[0].id });
        });
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
                const cantidadTotal = productos.reduce((acc, p) => acc + p.cantidad, 0); 
                // Calcular la cantidad total de productos (suma de las cantidades de cada uno)
                const cantidadUnica = productos.length; 

    
                // Calcular el total del carrito (precio total de los productos)
                const total = productos.reduce((acc, p) => acc + p.total, 0).toFixed(2);
    
                // Renderiza la vista del carrito con la cantidad total de unidades
                res.render('carrito', { 
                    productos, 
                    cantidadProductosCarrito: cantidadTotal, // ✅ Total de unidades en el carrito
                    total, 
                    cantidadCarrito: cantidadUnica // ✅ Ítems únicos para la notificación
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
    
        // Verificar si el producto existe en el carrito
        carrito.obtenerProductoPorId(id, (error, producto) => {
            if (error) {
                console.error('❌ Error al obtener el producto:', error);
                return res.status(500).json({ error: 'Error al buscar el producto' });
            }
            if (!producto) {
                console.error('⚠️ Producto no encontrado con ID:', id);
                return res.status(404).json({ error: 'Producto no encontrado' });
            }
    
            console.log('✅ Producto encontrado:', producto);
    
            // Calcular la nueva cantidad
            let nuevaCantidad = producto.cantidad;
            if (accion === 'aumentar') nuevaCantidad++;
            if (accion === 'disminuir' && nuevaCantidad > 1) nuevaCantidad--;
    
            console.log(`🔢 Nueva cantidad calculada: ${nuevaCantidad}`);
    
            // Actualizar la cantidad en la base de datos
            carrito.actualizarCantidad(id, nuevaCantidad, (error) => {
                if (error) {
                    console.error('❌ Error al actualizar la cantidad:', error);
                    return res.status(500).json({ error: 'Error al actualizar la cantidad' });
                }
    
                console.log(`✅ Cantidad actualizada con éxito: ${nuevaCantidad}`);
    
                // Obtener el carrito activo del usuario (corrección aquí)
                carrito.obtenerCarritoActivo(req.session.usuario.id, (error, carritoActivo) => {
                    if (error || !carritoActivo || carritoActivo.length === 0) {
                        console.error('❌ Error al obtener el carrito activo:', error);
                        return res.status(500).json({ error: 'Error al obtener el carrito' });
                    }
    
                    const id_carrito = carritoActivo[0].id;
    
                    // Obtener los productos actualizados del carrito
                    carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
                        if (error) {
                            console.error('❌ Error al obtener productos del carrito:', error);
                            return res.status(500).json({ error: 'Error al obtener productos' });
                        }
    
                        // Calcular el total y la cantidad total de productos
                        let totalCarrito = 0;
                        productos.forEach(producto => {
                            const precioVenta = parseFloat(producto.precio_venta);
                            const cantidad = producto.cantidad;
                            totalCarrito += precioVenta * cantidad; // Calculando el total con el precio y la cantidad
                        });
    
                        const cantidadTotal = productos.reduce((acc, p) => acc + p.cantidad, 0);
                        console.log(`🛒 Cantidad total actualizada en el carrito: ${cantidadTotal}, Total del carrito: $${totalCarrito.toFixed(2)}`);
    
                        // Enviar la respuesta con los datos actualizados
                        res.status(200).json({
                            mensaje: 'Cantidad actualizada',
                            nuevaCantidad,
                            cantidadTotal,
                            totalCarrito: totalCarrito.toFixed(2), // Enviar el total del carrito
                            productos: productos // Incluir los productos actualizados
                        });
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
    envio: (req,res) => {
        res.render ('envio')
    },
    guardarEnvio: (req, res) => {
        console.log("📝 Datos recibidos en el servidor:", req.body);
    
        if (!req.body || !req.body.tipo_envio) {
            return res.status(400).json({ error: "Debe seleccionar un tipo de envío." });
        }
    
        const { tipo_envio, direccion } = req.body;
        const id_usuario = req.session.usuario.id;
    
        carrito.obtenerCarritoActivo(id_usuario, (error, carritos) => {
            if (error) return res.status(500).json({ error: "Error al obtener carrito" });
    
            if (!carritos || carritos.length === 0) {
                return res.status(400).json({ error: "No hay un carrito activo" });
            }
    
            const id_carrito = carritos[0].id;
    
            // Verificar si hay una dirección previa
            carrito.obtenerDireccionEnvio(id_carrito, (error, direccionExistente) => {
                if (error) return res.status(500).json({ error: "Error al obtener dirección de envío" });
    
                if (direccionExistente && direccionExistente !== direccion) {
                    return res.status(200).json({
                        confirmarCambio: true,
                        direccionExistente,
                        direccionNueva: direccion
                    });
                }
    
                // Si no hay dirección previa, guardar la nueva directamente
                carrito.guardarEnvio(id_carrito, tipo_envio, direccion, (error) => {
                    if (error) return res.status(500).json({ error: "Error al guardar envío" });
    
                    res.status(200).json({ success: true, mensaje: "✅ Envío guardado correctamente" });
                });
            });
        });
    },
    
    actualizarDireccionEnvio: (req, res) => {
        const { direccion } = req.body;
        const id_usuario = req.session.usuario.id;
    
        carrito.obtenerCarritoActivo(id_usuario, (error, carritos) => {
            if (error) return res.status(500).json({ error: "Error al obtener carrito" });
    
            if (!carritos || carritos.length === 0) {
                return res.status(400).json({ error: "No hay un carrito activo" });
            }
    
            const id_carrito = carritos[0].id;
    
            carrito.actualizarDireccionEnvio(id_carrito, direccion, (error) => {
                if (error) return res.status(500).json({ error: "Error al actualizar dirección" });
    
                res.status(200).json({ success: true, mensaje: "✅ Dirección actualizada correctamente" });
            });
        });
    },
    
    
    confirmarDatos: (req, res) => {
        if (!req.session || !req.session.usuario || !req.session.usuario.id) {
            return res.status(401).send("Debes iniciar sesión para acceder a esta página.");
        }
    
        const id_usuario = req.session.usuario.id;
    
        carrito.obtenerCarritoActivo(id_usuario, (error, carritos) => {
            if (error) {
                console.error("❌ Error al obtener el carrito:", error);
                return res.status(500).send("Error al obtener el carrito");
            }
    
            if (!carritos || carritos.length === 0) {
                console.warn("⚠️ No hay un carrito activo para este usuario.");
                return res.render("confirmarDatos", { 
                    productos: [], 
                    envio: null, 
                    total: 0, 
                    cantidadProductosCarrito: 0 
                });
            }
    
            const id_carrito = carritos[0].id;
    
            carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
                if (error) {
                    console.error("❌ Error al obtener productos del carrito:", error);
                    return res.status(500).send("Error al obtener productos del carrito");
                }
    
                const total = productos.reduce((acc, p) => acc + p.total, 0).toFixed(2);
                const cantidadTotal = productos.reduce((acc, p) => acc + p.cantidad, 0); 
    
                carrito.obtenerEnvioCarrito(id_carrito, (error, envio) => {
                    if (error) {
                        console.error("❌ Error al obtener datos de envío:", error);
                        return res.status(500).send("Error al obtener datos de envío");
                    }
    
                    console.log("✅ Confirmar Datos - Productos:", productos);
                    console.log("✅ Confirmar Datos - Envío:", envio);
    
                    res.render("confirmarDatos", {
                        productos, 
                        envio, 
                        total, 
                        cantidadProductosCarrito: cantidadTotal
                    });
                });
            });
        });
    },
    vistaPago: async (req, res) => {
        const id_usuario = req.session.usuario.id;
    
        try {
            carrito.obtenerCarritoActivo(id_usuario, async (error, carritos) => {
                if (error) {
                    console.error("❌ Error al obtener el carrito:", error);
                    return res.status(500).send("Error al obtener el carrito");
                }
    
                if (!carritos || carritos.length === 0) {
                    console.warn("⚠️ No hay un carrito activo.");
                    return res.redirect('/carrito'); // Redirigir al carrito si no hay productos
                }
    
                const id_carrito = carritos[0].id;
    
                carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
                    if (error) {
                        console.error("❌ Error al obtener productos:", error);
                        return res.status(500).send("Error al obtener productos");
                    }
    
                    const total = productos.reduce((acc, p) => acc + p.total, 0).toFixed(2);
    
                    res.render('pago', {
                        productos,
                        total
                    });
                });
            });
        } catch (error) {
            console.error("❌ Error inesperado en el servidor:", error);
            res.status(500).send("Error interno del servidor");
        }
    },
    procesarPago: async (req, res) => {
        try {
            const id_usuario = req.session.usuario.id;
    
            // Obtener carrito activo del usuario
            const carritos = await new Promise((resolve, reject) => {
                carrito.obtenerCarritoActivo(id_usuario, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });
    
            if (!carritos || carritos.length === 0) {
                console.warn("⚠️ No hay un carrito activo.");
                return res.status(400).json({ error: "No hay un carrito activo" });
            }
    
            const id_carrito = carritos[0].id;
    
            // Obtener productos en el carrito
            const productos = await new Promise((resolve, reject) => {
                carrito.obtenerProductosCarrito(id_carrito, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });
    
            if (!productos || productos.length === 0) {
                console.warn("⚠️ El carrito está vacío.");
                return res.status(400).json({ error: "No hay productos en el carrito" });
            }
    
            // Construir los items de la preferencia
            const items = productos.map(prod => ({
                title: prod.nombre,
                unit_price: parseFloat(prod.precio_venta),
                quantity: prod.cantidad,
                currency_id: 'ARS'
            }));
    
            // Verificar que el token de acceso esté disponible
            if (!process.env.MP_ACCESS_TOKEN) {
                console.error("❌ Error: MP_ACCESS_TOKEN no está configurado.");
                return res.status(500).json({ error: "Error interno del servidor" });
            }
    
            // Configurar Mercado Pago
            const mercadopago = require('mercadopago');
            mercadopago.configure({
                access_token: process.env.MP_ACCESS_TOKEN
            });
    
            // Crear preferencia de Mercado Pago
            let preference = {
                items: items,
                back_urls: {
                    success: "https://www.autofaros.com.ar/pago-exito",
                    failure: "https://www.autofaros.com.ar/pago-error",
                    pending: "https://www.autofaros.com.ar/pago-pendiente"
                },
                auto_return: "approved"
            };
            
            console.log("🔍 Enviando preferencia a Mercado Pago:", JSON.stringify(preference, null, 2));
    
            const response = await mercadopago.preferences.create(preference);
            
            console.log("✅ Preferencia creada con ID:", response.body.id);
            res.json({ preferenceId: response.body.id });
    
        } catch (error) {
            console.error("❌ Error en `procesarPago`:", error);
            res.status(500).json({ error: "Error al procesar el pago" });
        }
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
