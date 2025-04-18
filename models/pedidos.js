const pool = require('../config/conexion');

module.exports = {
    obtenerPedidos: (callback) => {
        let query = `
            SELECT c.id AS id_pedido, u.nombre AS cliente, c.estado, c.tipo_envio, 
                   COALESCE(SUM(pc.cantidad * p.precio_venta), 0) AS total,
                   c.creado_en AS fecha
            FROM carritos c
            JOIN usuarios u ON c.usuario_id = u.id
            LEFT JOIN productos_carrito pc ON c.id = pc.carrito_id
            LEFT JOIN productos p ON pc.producto_id = p.id
            GROUP BY c.id, u.nombre, c.estado, c.tipo_envio, c.creado_en
            ORDER BY c.creado_en DESC;
        `;
    
        pool.query(query, (error, resultados) => {
            if (error) {
                console.error("❌ Error al obtener pedidos:", error);
                return callback(error, null);
            }
            console.log("✅ Todos los pedidos obtenidos:", resultados);
            callback(null, resultados);
        });
    },
    obtenerDetallePedido: (id_carrito, callback) => {
        const query = `
            SELECT u.nombre AS cliente, c.creado_en AS fecha,
                   pp_min.codigo, p.nombre AS nombre_producto, pc.cantidad, p.precio_venta,
                   (pc.cantidad * p.precio_venta) AS subtotal
            FROM carritos c
            JOIN usuarios u ON c.usuario_id = u.id
            JOIN productos_carrito pc ON c.id = pc.carrito_id
            JOIN productos p ON pc.producto_id = p.id
            LEFT JOIN (
                SELECT pp1.producto_id, pp1.codigo
                FROM producto_proveedor pp1
                INNER JOIN (
                    SELECT producto_id, MIN(precio_lista) AS precio_minimo
                    FROM producto_proveedor
                    GROUP BY producto_id
                ) AS pp2
                ON pp1.producto_id = pp2.producto_id AND pp1.precio_lista = pp2.precio_minimo
            ) AS pp_min
            ON pp_min.producto_id = p.id
            WHERE c.id = ?
        `;
    
        pool.query(query, [id_carrito], (error, resultados) => {
            if (error) {
                console.error("❌ Error en modelo al obtener detalle del pedido:", error);
                return callback(error, null);
            }
    
            if (resultados.length === 0) {
                return callback(null, null);
            }
    
            const cliente = resultados[0].cliente;
            const fecha = resultados[0].fecha;
            let total = 0;
    
            const productos = resultados.map(r => {
                total += r.subtotal;
                return {
                    codigo: r.codigo || 'SIN CÓDIGO',
                    nombre: r.nombre_producto,
                    cantidad: r.cantidad,
                    precio_unitario: r.precio_venta,
                    subtotal: r.subtotal
                };
            });
    
            const detalle = {
                cliente,
                fecha,
                total,
                productos
            };
    
            callback(null, detalle);
        });
    },    
    obtenerCantidadPedidosPendientes: (callback) => {
        const query = "SELECT COUNT(*) AS cantidad FROM carritos WHERE estado IN ('pendiente', 'preparación')";
    
        pool.query(query, (error, resultados) => {
            if (error) {
                console.error("❌ Error en la consulta de pedidos pendientes:", error);
                return callback(error, null);
            }
            console.log("✅ Pedidos pendientes encontrados en la BD:", resultados[0].cantidad);
            callback(null, resultados[0].cantidad);
        });
    },
    actualizarEstadoPedido: (id_pedido, nuevoEstado, callback) => {
        const query = "UPDATE carritos SET estado = ? WHERE id = ?";
        pool.query(query, [nuevoEstado, id_pedido], (error, resultados) => {
            if (error) {
                console.error(`❌ Error al actualizar estado del pedido ${id_pedido}:`, error);
                return callback(error);
            }
            callback(null, resultados);
        });
    }
};
