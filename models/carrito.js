const pool = require('../config/conexion');

module.exports = {
obtenerCarritoActivo: (usuario_id, callback) => {
  const query = `
    SELECT id, estado, tipo_envio, direccion, actualizado_en
    FROM carritos
    WHERE usuario_id = ? AND estado = 'carrito'
    ORDER BY id DESC
    LIMIT 1
  `;
  pool.query(query, [usuario_id], (error, resultados) => {
    if (error) return callback(error);
    callback(null, resultados || []);
  });
},
obtenerPedidosUsuario: (usuario_id, callback) => {
  const query = `
    SELECT
      c.id AS id_carrito,
      c.estado,
      c.actualizado_en AS fecha_compra,
      IFNULL(SUM(pc.cantidad), 0) AS unidades,
      IFNULL(SUM(pc.cantidad * p.precio_venta), 0) AS total
    FROM carritos c
    LEFT JOIN productos_carrito pc ON pc.carrito_id = c.id
    LEFT JOIN productos p ON p.id = pc.producto_id
    WHERE c.usuario_id = ? AND c.estado <> 'carrito'
    GROUP BY c.id, c.estado, c.actualizado_en
    ORDER BY c.actualizado_en DESC
    LIMIT 30
  `;
  pool.query(query, [usuario_id], (error, rows) => {
    if (error) return callback(error);
    callback(null, rows || []);
  });
},

obtenerPedidoUsuarioPorId: (usuario_id, id_carrito, callback) => {
  const query = `
    SELECT id AS id_carrito, estado, tipo_envio, direccion, actualizado_en AS fecha_compra
    FROM carritos
    WHERE id = ? AND usuario_id = ? AND es_pedido = 1
    LIMIT 1
  `;
  pool.query(query, [id_carrito, usuario_id], (error, rows) => {
    if (error) return callback(error);
    callback(null, rows && rows.length ? rows[0] : null);
  });
},
cerrarCarrito: (usuario_id, id_carrito, nuevoEstado, callback) => {
  const query = `
    UPDATE carritos
    SET estado = ?, es_pedido = 1, actualizado_en = NOW()
    WHERE id = ? AND usuario_id = ? AND estado = 'carrito'
  `;
  pool.query(query, [nuevoEstado, id_carrito, usuario_id], (err, result) => {
    if (err) return callback(err);
    callback(null, result.affectedRows || 0); // ✅ devuelve cuántas filas cerró
  });
},

crearCarrito: (usuario_id, callback) => {
  const query = `
    INSERT INTO carritos (usuario_id, estado, actualizado_en)
    VALUES (?, 'carrito', NOW())
  `;
  pool.query(query, [usuario_id], (error, result) => {
    if (error) return callback(error);
    callback(null, result.insertId);
  });
},
agregarProductoCarrito: (id_carrito, id_producto, cantidad, callback) => {
  const queryPrecio = "SELECT precio_venta FROM productos WHERE id = ?";
  pool.query(queryPrecio, [id_producto], (error, resultados) => {
    if (error) return callback(error);
    if (resultados.length > 0) {
      const query = "INSERT INTO productos_carrito (carrito_id, producto_id, cantidad) VALUES (?, ?, ?)";
      pool.query(query, [id_carrito, id_producto, cantidad], (error, resultados) => {
        if (error) return callback(error);
        callback(null, resultados);
      });
    } else {
      callback(new Error("Producto no encontrado"));
    }
  });
},

  obtenerProductosCarrito: (id_carrito, callback) => {
    const query = `
        SELECT pc.id, p.nombre, pc.cantidad, p.precio_venta, 
               (pc.cantidad * p.precio_venta) AS total, ip.imagen
        FROM productos_carrito pc
        JOIN productos p ON pc.producto_id = p.id
        LEFT JOIN imagenes_producto ip 
            ON pc.producto_id = ip.producto_id
        WHERE pc.carrito_id = ?;
    `;

    pool.query(query, [id_carrito], (error, resultados) => {
        if (error) {
            console.error('❌ Error en la consulta de productos con imágenes:', error);
            return callback(error);
        }


        // Agrupar los productos por ID y asignar solo una imagen
        const productosMap = {};

        resultados.forEach(p => {
            // Si el producto ya está en el map, no lo repetimos
            if (!productosMap[p.id]) {
                // Si hay imagen, la asignamos. Si no, usamos una predeterminada.
                productosMap[p.id] = {
                    ...p,
                    imagen: p.imagen || 'default_image.jpg',  // Imagen predeterminada si no hay imagen
                    cantidad: p.cantidad,
                    total: p.total
                };
            }
        });

        // Convertir el mapa de productos a un array
        const productos = Object.values(productosMap);

        // Asegurar que precio_venta y total sean números
        const productosConPrecios = productos.map(p => ({
            ...p,
            precio_venta: parseFloat(p.precio_venta) || 0,
            total: parseFloat(p.total) || 0
        }));

        callback(null, productosConPrecios);
    });
},
obtenerStockProducto: (producto_id, callback) => {
  const query = `SELECT id, stock_actual, stock_minimo FROM productos WHERE id = ? LIMIT 1`;
  pool.query(query, [producto_id], (error, rows) => {
    if (error) return callback(error);
    callback(null, rows && rows.length ? rows[0] : null);
  });
},

obtenerItemEnCarrito: (carrito_id, producto_id, callback) => {
  const query = `
    SELECT id, cantidad
    FROM productos_carrito
    WHERE carrito_id = ? AND producto_id = ?
    LIMIT 1
  `;
  pool.query(query, [carrito_id, producto_id], (error, rows) => {
    if (error) return callback(error);
    callback(null, rows && rows.length ? rows[0] : null);
  });
},
obtenerProductoCarritoConStock: (idItemCarrito, callback) => {
  const query = `
    SELECT pc.id, pc.carrito_id, pc.producto_id, pc.cantidad,
           p.stock_actual, p.stock_minimo
    FROM productos_carrito pc
    JOIN productos p ON p.id = pc.producto_id
    WHERE pc.id = ?
    LIMIT 1
  `;
  pool.query(query, [idItemCarrito], (error, rows) => {
    if (error) return callback(error);
    callback(null, rows && rows.length ? rows[0] : null);
  });
},

obtenerProductoPorId: (id, callback) => {
    const query = 'SELECT * FROM productos_carrito WHERE id = ?';
    pool.query(query, [id], (error, resultados) => {
        if (error) return callback(error);
        callback(null, resultados[0]);
    });
},

actualizarCantidad: (id, cantidad, callback) => {
    const query = 'UPDATE productos_carrito SET cantidad = ? WHERE id = ?';
    pool.query(query, [cantidad, id], callback);
}, 
eliminarProductoPorId: (id, callback) => {
    const query = 'DELETE FROM productos_carrito WHERE id = ?';
    pool.query(query, [id], callback);
},
guardarEnvio: (id_carrito, tipo_envio, direccion, callback) => {
  const qEnvio = `
    INSERT INTO envios (carrito_id, tipo_envio, direccion)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      tipo_envio = VALUES(tipo_envio),
      direccion = VALUES(direccion)
  `;

  const qCarrito = `
    UPDATE carritos
    SET tipo_envio = ?, direccion = ?, actualizado_en = NOW()
    WHERE id = ?
  `;

  pool.query(qEnvio, [id_carrito, tipo_envio, direccion ?? null], (err) => {
    if (err) return callback(err);

    pool.query(qCarrito, [tipo_envio, direccion ?? null, id_carrito], (err2, r2) => {
      if (err2) return callback(err2);
      return callback(null, r2);
    });
  });
},
obtenerEnvioCarrito: (id_carrito, callback) => {
  const query = `
    SELECT tipo_envio, direccion
    FROM envios
    WHERE carrito_id = ?
    ORDER BY id DESC
    LIMIT 1
  `;
  pool.query(query, [id_carrito], (error, resultados) => {
    if (error) return callback(error);
    callback(null, resultados.length > 0 ? resultados[0] : null);
  });
},
obtenerDireccionEnvio: (id_carrito, callback) => {
  const query = `
    SELECT direccion
    FROM envios
    WHERE carrito_id = ?
    ORDER BY id DESC
    LIMIT 1
  `;
  pool.query(query, [id_carrito], (error, resultados) => {
    if (error) return callback(error);
    callback(null, resultados.length > 0 ? resultados[0].direccion : null);
  });
},

actualizarDireccionEnvio: (id_carrito, nuevaDireccion, callback) => {
  const q1 = `UPDATE envios SET direccion = ? WHERE carrito_id = ?`;
  const q2 = `UPDATE carritos SET direccion = ?, actualizado_en = NOW() WHERE id = ?`;

  pool.query(q1, [nuevaDireccion, id_carrito], (err) => {
    if (err) return callback(err);

    pool.query(q2, [nuevaDireccion, id_carrito], (err2, r2) => {
      if (err2) return callback(err2);
      return callback(null, r2);
    });
  });
},
finalizarCompra: (id_carrito, callback) => {
        const query = 'UPDATE carritos SET actualizado_en = CURRENT_TIMESTAMP WHERE id = ?';
        pool.query(query, [id_carrito], (error, resultados) => {
            if (error) {
                return callback(error);
            }
            callback(null, resultados);
        });
    },
actualizarEstado: (id_carrito, nuevoEstado, callback) => {
        const query = "UPDATE carritos SET estado = ? WHERE id = ?";
        pool.query(query, [nuevoEstado, id_carrito], callback);
    },

    vaciarCarrito: (id_carrito, callback) => {
    
        if (!id_carrito) {
            console.error("❌ [ERROR] No se proporcionó un ID de carrito válido.");
            return callback(new Error("ID de carrito no válido."));
        }
    
        const query = "DELETE FROM productos_carrito WHERE carrito_id = ?";
        
        pool.query(query, [id_carrito], (error, resultados) => {
            if (error) {
                console.error("❌ [ERROR] Fallo al vaciar el carrito:", error);
                return callback(error);
            }
    
    
            if (resultados.affectedRows === 0) {
            }
    
            callback(null, resultados);
        });
    },    
obtenerUltimoPedido: (usuario_id, callback) => {
  const query = `
    SELECT id AS id_carrito, estado, tipo_envio, direccion, actualizado_en AS fecha_compra
    FROM carritos
    WHERE usuario_id = ?
      AND estado <> 'carrito'
      AND es_pedido = 1
    ORDER BY actualizado_en DESC
    LIMIT 1
  `;
  pool.query(query, [usuario_id], (error, rows) => {
    if (error) return callback(error);
    callback(null, rows || []);
  });
},
actualizarEnvio: (id_carrito, tipo_envio, direccion, callback) => {
  const q1 = `
    UPDATE envios
    SET tipo_envio = ?, direccion = ?
    WHERE carrito_id = ?
  `;
  const q2 = `
    UPDATE carritos
    SET tipo_envio = ?, direccion = ?, actualizado_en = NOW()
    WHERE id = ?
  `;

  pool.query(q1, [tipo_envio, direccion ?? null, id_carrito], (err) => {
    if (err) return callback(err);
    pool.query(q2, [tipo_envio, direccion ?? null, id_carrito], callback);
  });
},
  obtenerPorId: (id, cb) => {
    const q = `
      SELECT id, nombre, apellido, email, celular, direccion, localidad, provincia
      FROM usuarios
      WHERE id = ?
      LIMIT 1
    `;
    pool.query(q, [id], (err, rows) => {
      if (err) return cb(err);
      cb(null, rows && rows.length ? rows[0] : null);
    });
  },
  obtenerCarritoPorId: (id_carrito, callback) => {
  const query = `
    SELECT id AS id_carrito, estado, tipo_envio, direccion, 
           actualizado_en AS fecha_compra, es_pedido
    FROM carritos
    WHERE id = ?
    LIMIT 1
  `;
  pool.query(query, [id_carrito], (err, rows) => {
    if (err) return callback(err);
    callback(null, rows?.[0] || null);
  });
},

};

