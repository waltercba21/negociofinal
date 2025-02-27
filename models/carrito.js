const pool = require('../config/conexion');

module.exports = {
    obtenerCarritoActivo: (usuario_id, callback) => {
        const query = 'SELECT * FROM carritos WHERE usuario_id = ?';
        pool.query(query, [usuario_id], (error, resultados) => {
            if (error) return callback(error);
            callback(null, resultados.length > 0 ? resultados : []); // Si no hay carrito, devuelve un array vacío
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
            LEFT JOIN imagenes_producto ip ON pc.producto_id = ip.producto_id
            WHERE pc.carrito_id = ?;
        `;

        pool.query(query, [id_carrito], (error, resultados) => {
            if (error) return callback(error);

            if (!Array.isArray(resultados)) {
                console.error("❌ obtenerProductosCarrito NO devolvió un array.");
                return callback(null, { productos: [], total: 0 });
            }

            const productos = Array.isArray(resultados) ? resultados : [];
            const total = productos.reduce((acc, p) => acc + (p.total || 0), 0);

            callback(null, { productos, total });
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
guardarEnvio: (id_carrito, tipo_envio, direccion, ciudad, codigo_postal, callback) => {
    const query = `
        UPDATE carritos 
        SET tipo_envio = ?, direccion_envio = ?, ciudad_envio = ?, codigo_postal = ? 
        WHERE id = ?`;
    
    pool.query(query, [tipo_envio, direccion, ciudad, codigo_postal, id_carrito], (error, resultados) => {
        if (error) {
            return callback(error);
        }
        callback(null, resultados);
    });
    
},
obtenerEnvioCarrito: (id_carrito, callback) => {
    const query = "SELECT tipo_envio, direccion FROM carritos WHERE id = ?";
    pool.query(query, [id_carrito], (error, resultados) => {
        if (error) return callback(error);
        callback(null, resultados.length > 0 ? resultados[0] : null);
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
};
