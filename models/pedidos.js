const pool = require('../config/conexion');

module.exports = {
    obtenerPedidos: (estado, callback) => {
        let query = `
            SELECT c.id AS id_pedido, u.nombre AS cliente, c.estado, c.tipo_envio, 
                   COALESCE(SUM(pc.cantidad * p.precio_venta), 0) AS total
            FROM carritos c
            JOIN usuarios u ON c.usuario_id = u.id
            LEFT JOIN productos_carrito pc ON c.id = pc.carrito_id
            LEFT JOIN productos p ON pc.producto_id = p.id
            WHERE c.estado IN ('pendiente', 'preparación', 'listo para entrega')  -- ✅ Filtro correcto
            GROUP BY c.id, u.nombre, c.estado, c.tipo_envio
            ORDER BY c.creado_en DESC;
        `;
    
        pool.query(query, (error, resultados) => {
            if (error) {
                console.error("❌ Error al obtener pedidos:", error);
                return callback(error, null);
            }
            console.log("✅ Pedidos obtenidos en la BD:", resultados);
            callback(null, resultados);
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
