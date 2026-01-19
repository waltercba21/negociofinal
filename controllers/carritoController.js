const carrito = require('../models/carrito'); // ✅ Esta línea debe estar al inicio del archivo
const mercadopago = require('mercadopago');
const producto = require('../models/producto');
const { io } = require('../app');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const COSTO_DELIVERY = 5000;


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

  console.log("🧪 [CTRL] /carrito/agregar HIT", {
    body: req.body,
    userId: req.session?.usuario?.id,
    userEmail: req.session?.usuario?.email,
  });

  // Validar sesión
  if (!req.session || !req.session.usuario || !req.session.usuario.id) {
    console.log("🧪 [CTRL] sesión inválida");
    return res.status(401).json({ error: "Sesión no válida. Inicia sesión nuevamente." });
  }

  const id_usuario = req.session.usuario.id;
  const productoId = Number(id_producto);
  const cantSolicitada = Number(cantidad);

  if (!productoId || !Number.isFinite(cantSolicitada) || cantSolicitada <= 0) {
    console.log("🧪 [CTRL] datos inválidos", { productoId, cantSolicitada });
    return res.status(400).json({ error: "Datos inválidos." });
  }

  console.log("🧪 [CTRL] datos OK", { id_usuario, productoId, cantSolicitada });

  // 1) Obtener carrito activo del usuario
  carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
    if (error) {
      console.error("🧪 [CTRL] error obtenerCarritoActivo:", error);
      return res.status(500).json({ error: "Error al obtener carrito" });
    }

    console.log("🧪 [CTRL] obtenerCarritoActivo ->", carritoActivo);

    if (!carritoActivo || carritoActivo.length === 0) {
      console.log("🧪 [CTRL] no hay carrito, creando...");
      carrito.crearCarrito(id_usuario, (error, nuevoCarritoId) => {
        if (error) {
          console.error("🧪 [CTRL] error crearCarrito:", error);
          return res.status(500).json({ error: "Error al crear carrito" });
        }
        console.log("🧪 [CTRL] carrito creado:", { nuevoCarritoId });
        agregarConValidacion(nuevoCarritoId);
      });
    } else {
      const id_carrito = carritoActivo[0].id;
      console.log("🧪 [CTRL] usando carrito existente:", { id_carrito });
      agregarConValidacion(id_carrito);
    }
  });

  function agregarConValidacion(id_carrito) {
    console.log("🧪 [CTRL] validar stock para", { id_carrito, productoId, cantSolicitada });

    // 2) Traer stock real del producto
    carrito.obtenerStockProducto(productoId, (error, prod) => {
      if (error) {
        console.error("🧪 [CTRL] error obtenerStockProducto:", error);
        return res.status(500).json({ error: "Error al verificar stock" });
      }
      if (!prod) {
        console.log("🧪 [CTRL] producto no encontrado en DB", { productoId });
        return res.status(404).json({ error: "Producto no encontrado" });
      }

      const stockActual = Number(prod.stock_actual) || 0;
      const stockMinimo = Number(prod.stock_minimo) || 0;

      console.log("🧪 [CTRL] stock DB:", { productoId, stockActual, stockMinimo });

      // Pulgar abajo => no compra inmediata
      if (stockActual < stockMinimo) {
        console.log("🧪 [CTRL] 409 pulgar abajo", { stockActual, stockMinimo });
        return res.status(409).json({
          error:
            "Producto pendiente de ingreso o a pedido. Comunicate con nosotros al 3513820440.",
          stockDisponible: stockActual,
        });
      }

      if (stockActual <= 0) {
        console.log("🧪 [CTRL] 409 sin stock", { stockActual });
        return res.status(409).json({
          error: "No hay stock disponible para este producto.",
          stockDisponible: stockActual,
        });
      }

      // 3) Ver si ya existe en el carrito
      carrito.obtenerItemEnCarrito(id_carrito, productoId, (error, item) => {
        if (error) {
          console.error("🧪 [CTRL] error obtenerItemEnCarrito:", error);
          return res.status(500).json({ error: "Error al verificar carrito" });
        }

        console.log("🧪 [CTRL] item en carrito:", item);

        const yaEnCarrito = item ? Number(item.cantidad) || 0 : 0;
        const nuevaCantidadTotal = yaEnCarrito + cantSolicitada;

        console.log("🧪 [CTRL] cantidad calc:", {
          yaEnCarrito,
          cantSolicitada,
          nuevaCantidadTotal,
          stockActual,
        });

        if (nuevaCantidadTotal > stockActual) {
          const maxAgregable = Math.max(0, stockActual - yaEnCarrito);
          console.log("🧪 [CTRL] 409 excede stock", {
            stockActual,
            yaEnCarrito,
            cantSolicitada,
            maxAgregable,
          });

          return res.status(409).json({
            error: `No hay stock suficiente: intentaste agregar ${cantSolicitada} unidad(es) y el stock disponible para entrega inmediata es ${stockActual}. Solo podés agregar ${maxAgregable} unidad(es) más. Si necesitás más, comunicate al 3513820440.`,
            stockDisponible: stockActual,
            maxAgregable,
          });
        }

        // 4) Insert o Update
        if (item) {
          console.log("🧪 [CTRL] update cantidad", {
            itemId: item.id,
            nuevaCantidadTotal,
          });

          carrito.actualizarCantidad(item.id, nuevaCantidadTotal, (error) => {
            if (error) {
              console.error("🧪 [CTRL] error actualizarCantidad:", error);
              return res.status(500).json({ error: "Error al agregar producto al carrito" });
            }
            console.log("🧪 [CTRL] update OK");
            responderCarrito(id_carrito);
          });
        } else {
          console.log("🧪 [CTRL] insert producto_carrito", {
            id_carrito,
            productoId,
            cantSolicitada,
          });

          carrito.agregarProductoCarrito(id_carrito, productoId, cantSolicitada, (error) => {
            if (error) {
              console.error("🧪 [CTRL] error agregarProductoCarrito(modelo):", error);
              return res.status(500).json({ error: "Error al agregar producto al carrito" });
            }
            console.log("🧪 [CTRL] insert OK");
            responderCarrito(id_carrito);
          });
        }
      });
    });
  }

  function responderCarrito(id_carrito) {
    carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
      if (error) {
        console.error("🧪 [CTRL] error obtenerProductosCarrito:", error);
        return res.status(500).json({ error: "Error al obtener productos" });
      }

      const cantidadTotal = productos.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0);
      console.log("🧪 [CTRL] respuesta OK", { id_carrito, cantidadTotal });

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
    return res.status(401).send("Debes iniciar sesión para acceder al carrito");
  }

  const id_usuario = req.session.usuario.id;

  carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
    if (error) {
      console.error("Error al obtener el carrito:", error);
      return res.status(500).send("Error al obtener el carrito");
    }

    carrito.obtenerPedidosUsuario(id_usuario, (err2, pedidos) => {
      if (err2) {
        console.error("Error al obtener pedidos del usuario:", err2);
        pedidos = [];
      }

      if (!carritoActivo || carritoActivo.length === 0) {
        return res.render("carrito", {
          productos: [],
          cantidadProductosCarrito: 0,
          total: 0,
          cantidadCarrito: 0,
          estadoCarrito: null,
          pedidos
        });
      }

      const id_carrito = carritoActivo[0].id;
      const estadoCarrito = carritoActivo[0].estado;

      carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
        if (error) {
          console.error("Error al obtener los productos del carrito:", error);
          return res.status(500).send("Error al obtener los productos del carrito");
        }

        const cantidadTotal = productos.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0);
        const cantidadUnica = productos.length;
        const total = productos.reduce((acc, p) => acc + (Number(p.total) || 0), 0).toFixed(2);

        return res.render("carrito", {
          productos,
          cantidadProductosCarrito: cantidadTotal,
          total,
          cantidadCarrito: cantidadUnica,
          estadoCarrito,
          pedidos
        });
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
  const traceId = req.body?.traceId || `srv_${Date.now()}`;

  if (!req.body || !req.body.tipo_envio) {
    console.log(`[${traceId}] ❌ guardarEnvio: falta tipo_envio`, req.body);
    return res.status(400).json({ error: "Debe seleccionar un tipo de envío." });
  }

  const id_usuario = req.session.usuario.id;
  const tipo_envio = String(req.body.tipo_envio);
  let direccion = req.body.direccion ? String(req.body.direccion).trim() : null;

  console.log(`[${traceId}] ▶ guardarEnvio body`, { id_usuario, tipo_envio, direccion });

  if (tipo_envio === "delivery" && (!direccion || direccion.length < 5)) {
    console.log(`[${traceId}] ❌ guardarEnvio: dirección inválida`);
    return res.status(400).json({ error: "Debe ingresar una dirección válida para delivery." });
  }

  carrito.obtenerCarritoActivo(id_usuario, (error, carritos) => {
    if (error) {
      console.log(`[${traceId}] ❌ obtenerCarritoActivo error`, error);
      return res.status(500).json({ error: "Error al obtener carrito" });
    }
    if (!carritos || carritos.length === 0) {
      console.log(`[${traceId}] ❌ no hay carrito activo`);
      return res.status(400).json({ error: "No hay un carrito activo" });
    }

    const id_carrito = carritos[0].id;
    console.log(`[${traceId}] ✅ carrito activo`, carritos[0]);

    // retiro => direccion null
    if (tipo_envio !== "delivery") {
      direccion = null;
    }

    carrito.guardarEnvio(id_carrito, tipo_envio, direccion, (errSave) => {
      if (errSave) {
        console.log(`[${traceId}] ❌ guardarEnvio(modelo) error`, errSave);
        return res.status(500).json({ error: "Error al guardar envío" });
      }

      // leer lo guardado para verificar
      carrito.obtenerEnvioCarrito(id_carrito, (errE, envioDB) => {
        if (errE) console.log(`[${traceId}] ⚠ obtenerEnvioCarrito error`, errE);

        console.log(`[${traceId}] ✅ envio guardado DB`, { id_carrito, envioDB });

        return res.status(200).json({
          success: true,
          id_carrito,
          envioDB: envioDB || null,
          mensaje: "✅ Envío guardado correctamente"
        });
      });
    });
  });
},

actualizarDireccionEnvio: (req, res) => {
  const id_usuario = req.session.usuario.id;

  const tipo_envio = req.body.tipo_envio ? String(req.body.tipo_envio) : null;
  let direccion = req.body.direccion ? String(req.body.direccion).trim() : null;

  if (!tipo_envio) {
    return res.status(400).json({ error: "Falta tipo_envio." });
  }

  // si es retiro, la direccion debe ser null
  if (tipo_envio !== "delivery") {
    direccion = null;
  }

  carrito.obtenerCarritoActivo(id_usuario, (error, carritos) => {
    if (error) return res.status(500).json({ error: "Error al obtener carrito" });
    if (!carritos || carritos.length === 0) return res.status(400).json({ error: "No hay un carrito activo" });

    const id_carrito = carritos[0].id;

    carrito.guardarEnvio(id_carrito, tipo_envio, direccion, (err2) => {
      if (err2) return res.status(500).json({ error: "Error al actualizar envío" });
      return res.status(200).json({ success: true });
    });
  });
},

   confirmarDatos: (req, res) => {
  if (!req.session?.usuario?.id) return res.status(401).send("Debes iniciar sesión para acceder a esta página.");

  const id_usuario = req.session.usuario.id;

  carrito.obtenerCarritoActivo(id_usuario, (error, carritos) => {
    if (error) return res.status(500).send("Error al obtener el carrito");

    if (!carritos || carritos.length === 0) {
      return res.render("confirmarDatos", { productos: [], envio: null, total: 0, cantidadProductosCarrito: 0 });
    }

    const id_carrito = carritos[0].id;

    carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
      if (error) return res.status(500).send("Error al obtener productos del carrito");

      const subtotal = productos.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
      const total = subtotal.toFixed(2);
      const cantidadTotal = productos.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0);

      carrito.obtenerEnvioCarrito(id_carrito, (error, envio) => {
        if (error) return res.status(500).send("Error al obtener datos de envío");

        if (envio && envio.tipo_envio === 'delivery') envio.costo_envio = COSTO_DELIVERY;
        if (envio && envio.tipo_envio !== 'delivery') envio.costo_envio = 0;

        return res.render("confirmarDatos", { productos, envio, total, cantidadProductosCarrito: cantidadTotal });
      });
    });
  });
},
vistaPago: (req, res) => {
  const id_usuario = req.session.usuario.id;

  carrito.obtenerCarritoActivo(id_usuario, (error, carritos) => {
    if (error) return res.status(500).send("Error al obtener el carrito");
    if (!carritos || carritos.length === 0) return res.redirect('/carrito');

    const id_carrito = carritos[0].id;

    carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
      if (error) return res.status(500).send("Error al obtener productos");

      carrito.obtenerEnvioCarrito(id_carrito, (error, envio) => {
        if (error) return res.status(500).send("Error al obtener envío");
        if (!envio || !envio.tipo_envio) return res.redirect('/carrito/envio');

        const subtotal = productos.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
        const costoEnvio = (envio.tipo_envio === 'delivery') ? COSTO_DELIVERY : 0;
        const total = (subtotal + costoEnvio).toFixed(2);

        envio.costo_envio = costoEnvio;

        return res.render('pago', {
          productos,
          envio,
          subtotal: subtotal.toFixed(2),
          total
        });
      });
    });
  });
},
procesarPago: async (req, res) => {
  try {
    const id_usuario = req.session.usuario.id;

    const carritos = await new Promise((resolve, reject) => {
      carrito.obtenerCarritoActivo(id_usuario, (err, r) => err ? reject(err) : resolve(r));
    });
    if (!carritos || carritos.length === 0) return res.status(400).json({ error: "No hay un carrito activo" });

    const id_carrito = carritos[0].id;

    const productos = await new Promise((resolve, reject) => {
      carrito.obtenerProductosCarrito(id_carrito, (err, r) => err ? reject(err) : resolve(r));
    });
    if (!productos || productos.length === 0) return res.status(400).json({ error: "No hay productos en el carrito" });

    const envio = await new Promise((resolve, reject) => {
      carrito.obtenerEnvioCarrito(id_carrito, (err, r) => err ? reject(err) : resolve(r));
    });
    if (!envio || !envio.tipo_envio) return res.status(400).json({ error: "Falta seleccionar envío" });

    const items = productos.map(p => ({
      title: p.nombre,
      unit_price: Number(p.precio_venta),
      quantity: Number(p.cantidad),
      currency_id: "ARS"
    }));

    if (envio.tipo_envio === "delivery") {
      items.push({
        title: "Envío (Delivery)",
        unit_price: COSTO_DELIVERY,
        quantity: 1,
        currency_id: "ARS"
      });
    }

    const preference = {
      items,
      external_reference: String(id_carrito),
      back_urls: {
        success: "https://www.autofaros.com.ar/carrito/pago-exito",
        failure: "https://www.autofaros.com.ar/carrito/pago-error",
        pending: "https://www.autofaros.com.ar/carrito/pago-pendiente"
      },
      auto_return: "approved"
    };

    const response = await mercadopago.preferences.create(preference);
    return res.json({ preferenceId: response.body.id });

  } catch (error) {
    console.error("❌ Error en `procesarPago`:", error);
    return res.status(500).json({ error: "Error al procesar el pago" });
  }
},

finalizarCompra: async (req, res) => {
  try {
    const id_usuario = req.session.usuario.id;

    // 1) Obtener carrito ACTIVO (= pendiente)
    const carritos = await new Promise((resolve, reject) => {
      carrito.obtenerCarritoActivo(id_usuario, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });

    if (!carritos || carritos.length === 0) {
      return res.redirect("/carrito");
    }

    const id_carrito = carritos[0].id;

    // 2) Validar que tenga productos (si está vacío, no finalizar)
    const productos = await new Promise((resolve, reject) => {
      carrito.obtenerProductosCarrito(id_carrito, (error, rows) => {
        if (error) return reject(error);
        resolve(rows || []);
      });
    });

    if (productos.length === 0) {
      return res.redirect("/carrito");
    }

    // 3) Definir estado final del pedido (NO puede ser 'pendiente')
    const tipoEnvio = carritos[0].tipo_envio;

    // Si tipo_envio aún no está definido, podés mandarlo a "preparación" por defecto
    let nuevoEstado = "preparación";

    if (tipoEnvio === "delivery") nuevoEstado = "listo para entrega";
    if (tipoEnvio === "local") nuevoEstado = "preparación";

    // ✅ Cerrar pedido (NO borrar items)
    await new Promise((resolve, reject) => {
      carrito.cerrarCarrito(id_carrito, nuevoEstado, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });

    // ✅ Crear un carrito nuevo vacío (pendiente) para seguir comprando
    await new Promise((resolve, reject) => {
      carrito.crearCarrito(id_usuario, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });

    // Guardar pedido para comprobante/vista pago éxito
    req.session.ultimoPedidoId = id_carrito;

    io.emit("nuevoPedido", {
      mensaje: `📦 Nuevo pedido recibido (${id_carrito})`,
      id_carrito,
      usuario: id_usuario,
      estado: nuevoEstado,
    });

    return res.redirect(`/carrito/pago-exito?pedido=${id_carrito}`);
  } catch (error) {
    console.error("❌ [ERROR] en `finalizarCompra`:", error);
    return res.status(500).json({ error: "Error al finalizar la compra" });
  }
},

 vistaPagoExitoso: async (req, res) => {
  try {
    const id_usuario = req.session.usuario.id;
    const pedidoId = Number(req.query.pedido) || Number(req.session.ultimoPedidoId);

    let pedido = null;

    if (pedidoId) {
      pedido = await new Promise((resolve, reject) => {
        carrito.obtenerPedidoUsuarioPorId(id_usuario, pedidoId, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    }

    // fallback: último pedido NO activo
    if (!pedido) {
      const ult = await new Promise((resolve, reject) => {
        carrito.obtenerUltimoPedido(id_usuario, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      pedido = ult && ult.length ? ult[0] : null;
    }

    if (!pedido) {
      return res.render("pagoExito", { productos: [], estadoCarrito: null, total: 0, pedidoId: null });
    }

    const productos = await new Promise((resolve, reject) => {
      carrito.obtenerProductosCarrito(pedido.id_carrito, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const total = productos.reduce((acc, p) => acc + (Number(p.total) || 0), 0).toFixed(2);

    return res.render("pagoExito", {
      productos,
      estadoCarrito: pedido.estado,
      total,
      pedidoId: pedido.id_carrito
    });
  } catch (error) {
    console.error("❌ Error al cargar la vista de pago exitoso:", error);
    res.status(500).send("Error al cargar la página de pago exitoso.");
  }
},
generarComprobante: async (req, res) => {
  try {
    const id_usuario = req.session.usuario.id;
    const idPedido = Number(req.params.id);

    let pedido = null;

    if (idPedido) {
      pedido = await new Promise((resolve, reject) => {
        carrito.obtenerPedidoUsuarioPorId(id_usuario, idPedido, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    } else {
      const ult = await new Promise((resolve, reject) => {
        carrito.obtenerUltimoPedido(id_usuario, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      pedido = ult && ult.length ? ult[0] : null;
    }

    if (!pedido) {
      return res.status(404).json({ error: "No se encontró un pedido." });
    }

    const productos = await new Promise((resolve, reject) => {
      carrito.obtenerProductosCarrito(pedido.id_carrito, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=comprobante_${pedido.id_carrito}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text("AUTOFAROS", { align: "center" });
    doc.fontSize(14).text("COMPROBANTE DE COMPRA", { align: "center" });
    doc.fontSize(10).text("NO VÁLIDO COMO FACTURA", { align: "center" });

    doc.moveDown().fontSize(12).text(`Fecha: ${pedido.fecha_compra ? new Date(pedido.fecha_compra).toLocaleDateString() : "-"}`);
    doc.text(`Número de Pedido: ${pedido.id_carrito}`);
    doc.text(`Estado: ${pedido.estado}`);
    if (pedido.tipo_envio) doc.text(`Tipo de Envío: ${pedido.tipo_envio}`);
    if (pedido.direccion) doc.text(`Dirección: ${pedido.direccion}`);

    doc.moveDown();
    doc.fontSize(12).text("Productos:", { underline: true });

    productos.forEach((p, i) => {
      doc.text(`${i + 1}. ${p.nombre} - ${p.cantidad} x $${p.precio_venta} = $${p.total}`);
    });

    const totalCompra = productos.reduce((acc, p) => acc + (Number(p.total) || 0), 0).toFixed(2);
    doc.moveDown();
    doc.text(`Total: $${totalCompra}`, { bold: true });

    doc.end();
  } catch (error) {
    console.error("❌ Error al generar el comprobante:", error);
    res.status(500).json({ error: "Error al generar el comprobante" });
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
