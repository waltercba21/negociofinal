const carrito = require('../models/carrito'); // ✅ Esta línea debe estar al inicio del archivo
const mercadopago = require('mercadopago');
const producto = require('../models/producto');
const { io } = require('../app');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

console.log("✅ Módulo 'carrito' cargado correctamente.");

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
  agregarProductoCarrito: (req, res) => {
  const { id_producto, cantidad } = req.body;

  // Validar sesión
  if (!req.session || !req.session.usuario || !req.session.usuario.id) {
    return res.status(401).json({ error: 'Sesión no válida. Inicia sesión nuevamente.' });
  }

  const id_usuario = req.session.usuario.id;
  const productoId = Number(id_producto);
  const cantSolicitada = Number(cantidad);

  if (!productoId || !Number.isFinite(cantSolicitada) || cantSolicitada <= 0) {
    return res.status(400).json({ error: 'Datos inválidos.' });
  }

  // 1) Obtener carrito activo del usuario
  carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
    if (error) {
      console.error('Error al obtener carrito:', error);
      return res.status(500).json({ error: 'Error al obtener carrito' });
    }

    if (!carritoActivo || carritoActivo.length === 0) {
      // Crear carrito si no existe
      carrito.crearCarrito(id_usuario, (error, nuevoCarritoId) => {
        if (error) {
          console.error('Error al crear carrito:', error);
          return res.status(500).json({ error: 'Error al crear carrito' });
        }
        agregarConValidacion(nuevoCarritoId);
      });
    } else {
      agregarConValidacion(carritoActivo[0].id);
    }
  });

  function agregarConValidacion(id_carrito) {
    // 2) Traer stock real del producto
    carrito.obtenerStockProducto(productoId, (error, prod) => {
      if (error) {
        console.error('Error al obtener stock del producto:', error);
        return res.status(500).json({ error: 'Error al verificar stock' });
      }
      if (!prod) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      const stockActual = Number(prod.stock_actual) || 0;
      const stockMinimo = Number(prod.stock_minimo) || 0;

      // Pulgar abajo => no compra inmediata
      if (stockActual < stockMinimo) {
        return res.status(409).json({
          error: 'Producto pendiente de ingreso o a pedido. Comunicate con nosotros.',
          stockDisponible: stockActual
        });
      }

      if (stockActual <= 0) {
        return res.status(409).json({
          error: 'No hay stock disponible para este producto.',
          stockDisponible: stockActual
        });
      }

      // 3) Ver si ya existe en el carrito para evitar acumulación por múltiples clicks
      carrito.obtenerItemEnCarrito(id_carrito, productoId, (error, item) => {
        if (error) {
          console.error('Error al obtener item del carrito:', error);
          return res.status(500).json({ error: 'Error al verificar carrito' });
        }

        const yaEnCarrito = item ? Number(item.cantidad) || 0 : 0;
        const nuevaCantidadTotal = yaEnCarrito + cantSolicitada;

        if (nuevaCantidadTotal > stockActual) {
          const maxAgregable = Math.max(0, stockActual - yaEnCarrito);
          return res.status(409).json({
            error: `Stock disponible: ${stockActual}. Solo podés agregar ${maxAgregable} unidad(es) más.`,
            stockDisponible: stockActual,
            maxAgregable
          });
        }

        // 4) Insert o Update
        if (item) {
          // ya existe: update
          carrito.actualizarCantidad(item.id, nuevaCantidadTotal, (error) => {
            if (error) {
              console.error('Error al actualizar cantidad:', error);
              return res.status(500).json({ error: 'Error al agregar producto al carrito' });
            }
            responderCarrito(id_carrito);
          });
        } else {
          // no existe: insert
          carrito.agregarProductoCarrito(id_carrito, productoId, cantSolicitada, (error) => {
            if (error) {
              console.error('Error al agregar producto:', error);
              return res.status(500).json({ error: 'Error al agregar producto al carrito' });
            }
            responderCarrito(id_carrito);
          });
        }
      });
    });
  }

  function responderCarrito(id_carrito) {
    carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
      if (error) {
        console.error('Error al obtener productos:', error);
        return res.status(500).json({ error: 'Error al obtener productos' });
      }

      const cantidadTotal = productos.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0);
      console.log(`🛒 Nueva cantidad total del carrito: ${cantidadTotal}`);

      return res.status(200).json({ cantidadTotal });
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
        if (!req.session || !req.session.usuario || !req.session.usuario.id) {
            return res.status(401).send('Debes iniciar sesión para acceder al carrito');
        }
    
        const id_usuario = req.session.usuario.id;
    
        carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
            if (error) {
                console.error('Error al obtener el carrito:', error);
                return res.status(500).send('Error al obtener el carrito');
            }
    
            if (!carritoActivo || carritoActivo.length === 0) {
                return res.render('carrito', { 
                    productos: [], 
                    cantidadProductosCarrito: 0, 
                    total: 0, 
                    cantidadCarrito: 0,
                    estadoCarrito: null // Agregar estadoCarrito como null para evitar errores en la vista
                });
            }
    
            const id_carrito = carritoActivo[0].id;
            const estadoCarrito = carritoActivo[0].estado; // Extraer el estado del carrito
    
            carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
                if (error) {
                    console.error('Error al obtener los productos del carrito:', error);
                    return res.status(500).send('Error al obtener los productos del carrito');
                }
    
                console.log('Productos cargados en el carrito:', productos);
                const cantidadTotal = productos.reduce((acc, p) => acc + p.cantidad, 0); 
                const cantidadUnica = productos.length; 
    
                const total = productos.reduce((acc, p) => acc + p.total, 0).toFixed(2);
    
                res.render('carrito', { 
                    productos, 
                    cantidadProductosCarrito: cantidadTotal,
                    total, 
                    cantidadCarrito: cantidadUnica,
                    estadoCarrito 
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

  if (!id || !accion || !['aumentar', 'disminuir'].includes(accion)) {
    return res.status(400).json({ error: 'Datos inválidos.' });
  }

  console.log(`Actualizando producto con ID: ${id}, Acción: ${accion}`);

  // Verificar si el producto existe en el carrito (con stock)
  carrito.obtenerProductoCarritoConStock(id, (error, producto) => {
    if (error) {
      console.error('❌ Error al obtener el producto:', error);
      return res.status(500).json({ error: 'Error al buscar el producto' });
    }
    if (!producto) {
      console.error('⚠️ Producto no encontrado con ID:', id);
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    console.log('✅ Producto encontrado:', producto);

    const cantidadActual = Number(producto.cantidad) || 0;
    const stockActual = Number(producto.stock_actual) || 0;
    const stockMinimo = Number(producto.stock_minimo) || 0;

    // Calcular la nueva cantidad
    let nuevaCantidad = cantidadActual;
    if (accion === 'aumentar') nuevaCantidad = cantidadActual + 1;
    if (accion === 'disminuir') nuevaCantidad = Math.max(1, cantidadActual - 1);

    console.log(`🔢 Nueva cantidad calculada: ${nuevaCantidad}`);

    // ✅ VALIDACIÓN STOCK (solo aplica al aumentar)
    if (accion === 'aumentar') {
      // Si está “pulgar abajo” (stock_actual < stock_minimo) NO permitimos aumentar
      if (stockActual < stockMinimo) {
        return res.status(409).json({
          error: 'Producto pendiente de ingreso o a pedido. Comunicate con nosotros.',
          nuevaCantidad: cantidadActual,
          stockDisponible: stockActual
        });
      }

      // Si no hay stock real
      if (stockActual <= 0) {
        return res.status(409).json({
          error: 'No hay stock disponible para este producto.',
          nuevaCantidad: cantidadActual,
          stockDisponible: stockActual
        });
      }

      // Tope por stock real
      if (nuevaCantidad > stockActual) {
        return res.status(409).json({
          error: `Stock disponible: ${stockActual}. Si necesitás más, comunicate con nosotros.`,
          nuevaCantidad: cantidadActual,
          stockDisponible: stockActual
        });
      }
    }

    // Actualizar la cantidad en la base de datos
    carrito.actualizarCantidad(id, nuevaCantidad, (error) => {
      if (error) {
        console.error('❌ Error al actualizar la cantidad:', error);
        return res.status(500).json({ error: 'Error al actualizar la cantidad' });
      }

      console.log(`✅ Cantidad actualizada con éxito: ${nuevaCantidad}`);

      // Obtener el carrito activo del usuario
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
          productos.forEach((p) => {
            const precioVenta = parseFloat(p.precio_venta) || 0;
            const cant = Number(p.cantidad) || 0;
            totalCarrito += precioVenta * cant;
          });

          const cantidadTotal = productos.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0);
          console.log(`🛒 Cantidad total actualizada en el carrito: ${cantidadTotal}, Total del carrito: $${totalCarrito.toFixed(2)}`);

          // Enviar la respuesta con los datos actualizados
          res.status(200).json({
            mensaje: 'Cantidad actualizada',
            nuevaCantidad,
            cantidadTotal,
            totalCarrito: totalCarrito.toFixed(2),
            productos
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
                    success: "https://www.autofaros.com.ar/carrito/pago-exito",
                    failure: "https://www.autofaros.com.ar/carrito/pago-error",
                    pending: "https://www.autofaros.com.ar/carrito/pago-pendiente"
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
    finalizarCompra: async (req, res) => {
        try {
            const id_usuario = req.session.usuario.id;
        
            console.log("📌 [DEBUG] Iniciando proceso de finalización de compra para usuario:", id_usuario);
        
            // Obtener carrito activo del usuario
            const carritos = await new Promise((resolve, reject) => {
                carrito.obtenerCarritoActivo(id_usuario, (error, result) => {
                    if (error) {
                        console.error("❌ [ERROR] No se pudo obtener el carrito:", error);
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            });
    
            if (!carritos || carritos.length === 0) {
                console.warn("⚠️ [WARN] No hay un carrito activo para este usuario.");
                return res.redirect("/carrito");
            }
    
            const id_carrito = carritos[0].id;
            console.log("🛒 [DEBUG] Carrito activo encontrado con ID:", id_carrito);
    
            // Obtener tipo de envío
            const tipoEnvio = carritos[0].tipo_envio;
            let nuevoEstado = "pendiente"; // Estado por defecto
    
            if (tipoEnvio === "local") {
                nuevoEstado = "preparación"; // Pedido listo para retiro
            } else if (tipoEnvio === "delivery") {
                nuevoEstado = "listo para entrega"; // Pedido será enviado
            }
    
            // **Vaciar carrito antes de cambiar estado**
            console.log("🛒 [DEBUG] Llamando a `vaciarCarrito` antes de actualizar estado...");
            await new Promise((resolve, reject) => {
                carrito.vaciarCarrito(id_carrito, (error, result) => {
                    if (error) {
                        console.error("❌ [ERROR] Fallo al vaciar el carrito:", error);
                        reject(error);
                    } else {
                        console.log("✅ [INFO] Productos eliminados del carrito:", result.affectedRows);
                        resolve(result.affectedRows > 0);
                    }
                });
            });
    
            // **Verificar que el carrito realmente está vacío**
            const productosRestantes = await new Promise((resolve, reject) => {
                carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
                    if (error) {
                        console.error("❌ [ERROR] No se pudieron obtener los productos del carrito tras vaciarlo:", error);
                        reject(error);
                    } else {
                        resolve(productos);
                    }
                });
            });
    
            if (productosRestantes.length > 0) {
                console.warn("⚠️ [WARN] Algunos productos no se eliminaron. Reintentando...");
                await new Promise((resolve, reject) => {
                    carrito.vaciarCarrito(id_carrito, (error, result) => {
                        if (error) {
                            console.error("❌ [ERROR] Segundo intento fallido al vaciar el carrito:", error);
                            reject(error);
                        } else {
                            console.log("✅ [INFO] Carrito vaciado correctamente en segundo intento.");
                            resolve(result);
                        }
                    });
                });
            } else {
                console.log("✅ [INFO] Verificación confirmada: Carrito vacío.");
            }
    
            // **Actualizar estado del carrito después de vaciarlo**
            await new Promise((resolve, reject) => {
                carrito.actualizarEstado(id_carrito, nuevoEstado, (error, result) => {
                    if (error) {
                        console.error("❌ [ERROR] No se pudo actualizar el estado del carrito:", error);
                        reject(error);
                    } else {
                        console.log("✅ [INFO] Estado del carrito actualizado a:", nuevoEstado);
                        resolve(result);
                    }
                });
            });
    
            // 🔔 Emitir notificación en tiempo real a los administradores
            io.emit('nuevoPedido', {
                mensaje: `📦 Nuevo pedido recibido (${id_carrito})`,
                id_carrito,
                usuario: id_usuario,
                estado: nuevoEstado,
            });
    
            console.log("✅ [INFO] Redirigiendo a la vista de pago exitoso...");
            res.redirect("/carrito/pago-exito");
    
        } catch (error) {
            console.error("❌ [ERROR] en `finalizarCompra`:", error);
            res.status(500).json({ error: "Error al finalizar la compra" });
        }
    },    
    
    vistaPagoExitoso: async (req, res) => {
        try {
            const id_usuario = req.session.usuario.id;
    
            // Obtener carrito activo con su estado
            const carritos = await new Promise((resolve, reject) => {
                carrito.obtenerCarritoActivo(id_usuario, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });
    
            if (!carritos || carritos.length === 0) {
                return res.render('pagoExito', { productos: [], estadoCarrito: null, total: 0 });
            }
    
            const id_carrito = carritos[0].id;
            const estadoCarrito = carritos[0].estado || "pendiente"; // Estado del carrito
    
            // Obtener productos del carrito
            const productos = await new Promise((resolve, reject) => {
                carrito.obtenerProductosCarrito(id_carrito, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });
    
            const total = productos.reduce((acc, p) => acc + p.total, 0).toFixed(2);
    
            res.render('pagoExito', { productos, estadoCarrito, total });
        } catch (error) {
            console.error("❌ Error al cargar la vista de pago exitoso:", error);
            res.status(500).send("Error al cargar la página de pago exitoso.");
        }
    },
    obtenerPedidosPendientes: (req, res) => {
        carrito.obtenerCantidadPedidosPendientes((error, cantidad) => {
            if (error) {
                return res.status(500).json({ error: "Error al obtener pedidos pendientes" });
            }
            res.json({ cantidad });
        });
    },    
    obtenerPedidos: (req, res) => {
        carrito.obtenerPedidos((error, pedidos) => {
            if (error) {
                return res.status(500).render("error", { mensaje: "Error al obtener los pedidos" });
            }
            res.render("carrito/pedidos", { pedidos });
        });
    },
    
    marcarPedidoComoPreparado: (req, res) => {
        const id_pedido = req.params.id;
    
        carrito.actualizarEstado(id_pedido, "preparación", (error) => {
            if (error) {
                return res.status(500).json({ error: "Error al actualizar el pedido a 'preparación'" });
            }
            io.emit('pedidoActualizado', { id_pedido, estado: "preparación" });
            res.json({ mensaje: "Pedido marcado como en preparación" });
        });
    },
    
    marcarPedidoComoFinalizado: (req, res) => {
        const id_pedido = req.params.id;
    
        carrito.actualizarEstado(id_pedido, "finalizado", (error) => {
            if (error) {
                return res.status(500).json({ error: "Error al actualizar el pedido a 'finalizado'" });
            }
            io.emit('pedidoActualizado', { id_pedido, estado: "finalizado" });
            res.json({ mensaje: "Pedido marcado como finalizado" });
        });
    },
    generarComprobante: async (req, res) => {
        try {
            console.log("📄 Generando PDF del comprobante...");
    
            const id_usuario = req.session.usuario.id;
            console.log(`📌 Usuario autenticado, ID: ${id_usuario}`);
    
            // Obtener el último carrito del usuario
            const carritos = await new Promise((resolve, reject) => {
                carrito.obtenerUltimoPedido(id_usuario, (error, carrito) => {
                    if (error) {
                        console.error("❌ Error al obtener el último carrito:", error);
                        reject(error);
                    } else {
                        console.log("✅ Último carrito obtenido correctamente:", carrito);
                        resolve(carrito);
                    }
                });
            });
    
            if (!carritos || carritos.length === 0) {
                console.warn("⚠️ No se encontró un carrito finalizado para este usuario.");
                return res.status(404).json({ error: "No se encontró un pedido reciente." });
            }
    
            const carritoData = carritos[0];
    
            // Obtener los productos del carrito
            const productos = await new Promise((resolve, reject) => {
                carrito.obtenerProductosCarrito(carritoData.id_carrito, (error, productos) => {
                    if (error) {
                        console.error("❌ Error al obtener los productos del carrito:", error);
                        reject(error);
                    } else {
                        console.log("✅ Productos obtenidos:", productos);
                        resolve(productos);
                    }
                });
            });
    
            console.log("📄 Generando PDF en memoria...");
            const doc = new PDFDocument();
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=comprobante_${carritoData.id_carrito}.pdf`);
    
            // Enviar el PDF directamente como respuesta
            doc.pipe(res);
    
            doc.fontSize(20).text("AUTOFAROS", { align: "center" });
            doc.fontSize(14).text("COMPROBANTE DE RETIRO", { align: "center" });
            doc.fontSize(10).text("NO VÁLIDO COMO FACTURA", { align: "center" });
    
            doc.moveDown().fontSize(12).text(`Fecha: ${new Date(carritoData.fecha_compra).toLocaleDateString()}`);
            doc.text(`Número de Pedido: ${carritoData.id_carrito}`);
            doc.text(`Estado: ${carritoData.estado}`);
            doc.text(`Tipo de Envío: ${carritoData.tipo_envio}`);
            if (carritoData.direccion) {
                doc.text(`Dirección de Envío: ${carritoData.direccion}`);
            }
            doc.moveDown();
    
            doc.fontSize(12).text("Productos comprados:", { underline: true });
            productos.forEach((producto, index) => {
                doc.text(`${index + 1}. ${producto.nombre} - ${producto.cantidad} x $${producto.precio_venta} = $${producto.total}`);
            });
    
            const totalCompra = productos.reduce((acc, p) => acc + p.total, 0).toFixed(2);
            doc.moveDown();
            doc.text(`Total: $${totalCompra}`, { bold: true });
    
            doc.end();
            console.log("✅ PDF generado y enviado al usuario.");
    
        } catch (error) {
            console.error("❌ Error al generar el comprobante:", error);
            res.status(500).json({ error: "Error al generar el comprobante" });
        }
    }
    
};
