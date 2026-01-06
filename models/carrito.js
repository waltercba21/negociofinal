const pool = require('../config/conexion');

module.exports = {
    obtenerCarritoActivo: (usuario_id, callback) => {
        const query = 'SELECT id, estado FROM carritos WHERE usuario_id = ?';
        pool.query(query, [usuario_id], (error, resultados) => {
            if (error) {
                return callback(error);
            }
            callback(null, resultados);
        });
    },
    crearCarrito: (usuario_id, callback) => {
        const query = 'INSERT INTO carritos (usuario_id) VALUES (?)';
        pool.query(query, [usuario_id], (error, resultados) => {
            if (error) {
                return callback(error);
            }
            callback(null, resultados.insertId);
        });
    },
    agregarProductoCarrito: (id_carrito, id_producto, cantidad, callback) => {
        const queryPrecio = 'SELECT precio_venta FROM productos WHERE id = ?';

        pool.query(queryPrecio, [id_producto], (error, resultados) => {
            if (error) {
                return callback(error);
            }

            if (resultados.length > 0) {
                const precio = resultados[0].precio_venta;
                const query = 'INSERT INTO productos_carrito (carrito_id, producto_id, cantidad) VALUES (?, ?, ?)';

                pool.query(query, [id_carrito, id_producto, cantidad], (error, resultados) => {
                    if (error) {
                        return callback(error);
                    }
                    callback(null, resultados);
                });
            } else {
                callback(new Error('Producto no encontrado'));
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

        console.log('✅ Resultados de productos con imágenes:', resultados);

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
    const query = `
        INSERT INTO envios (carrito_id, tipo_envio, direccion) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE tipo_envio = VALUES(tipo_envio), 
                                direccion = VALUES(direccion);
    `;

    pool.query(query, [id_carrito, tipo_envio, direccion], (error, resultados) => {
        if (error) {
            console.error("❌ Error al guardar envío:", error);
            return callback(error);
        }
        callback(null, resultados);
    });
},
obtenerEnvioCarrito: (id_carrito, callback) => {
    const query = "SELECT tipo_envio, direccion FROM envios WHERE carrito_id = ?";
    pool.query(query, [id_carrito], (error, resultados) => {
        if (error) return callback(error);
        callback(null, resultados.length > 0 ? resultados[0] : null);
    });
},
obtenerDireccionEnvio: (id_carrito, callback) => {
    const query = "SELECT direccion FROM envios WHERE carrito_id = ?";
    pool.query(query, [id_carrito], (error, resultados) => {
        if (error) return callback(error);
        callback(null, resultados.length > 0 ? resultados[0].direccion : null);
    });
},

actualizarDireccionEnvio: (id_carrito, nuevaDireccion, callback) => {
    const query = `
        UPDATE envios 
        SET direccion = ? 
        WHERE carrito_id = ?
    `;
    pool.query(query, [nuevaDireccion, id_carrito], (error, resultados) => {
        if (error) return callback(error);
        callback(null, resultados);
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
        console.log(`🛒 [DEBUG] Intentando vaciar el carrito con ID: ${id_carrito}`);
    
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
    
            console.log(`✅ [INFO] Productos eliminados del carrito: ${resultados.affectedRows}`);
    
            if (resultados.affectedRows === 0) {
                console.warn("⚠️ [WARN] No se eliminaron productos. Puede que el carrito ya esté vacío o que el ID sea incorrecto.");
            }
    
            callback(null, resultados);
        });
    },    
    obtenerUltimoPedido: (usuario_id, callback) => {
        console.log(`🔍 Buscando el último carrito para el usuario: ${usuario_id}`);

        const query = `
            SELECT id AS id_carrito, estado, tipo_envio, direccion, actualizado_en AS fecha_compra
            FROM carritos
            WHERE usuario_id = ?
            ORDER BY actualizado_en DESC
            LIMIT 1;
        `;

        pool.query(query, [usuario_id], (error, resultados) => {
            if (error) {
                console.error("❌ Error al obtener el último carrito:", error);
                return callback(error);
            }

            if (resultados.length === 0) {
                console.warn("⚠️ No se encontró un carrito finalizado para el usuario:", usuario_id);
                return callback(null, []);
            }

            console.log("✅ Último carrito obtenido:", resultados[0]);
            callback(null, resultados);
        });
    }
    
    
    
};
