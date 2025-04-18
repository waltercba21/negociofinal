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
    obtenerDetallePedido: (req, res) => {
        const carritoId = req.params.id;
        console.log(`🔍 Solicitando detalle para carrito ID: ${carritoId}`);
    
        const pool = require('../config/conexion');
        const query = `
            SELECT u.nombre AS cliente, c.creado_en AS fecha,
                   p.codigo, p.nombre AS nombre_producto, pc.cantidad, p.precio_venta,
                   (pc.cantidad * p.precio_venta) AS subtotal
            FROM carritos c
            JOIN usuarios u ON c.usuario_id = u.id
            JOIN productos_carrito pc ON c.id = pc.carrito_id
            JOIN productos p ON pc.producto_id = p.id
            WHERE c.id = ?
        `;
    
        pool.query(query, [carritoId], (error, resultados) => {
            if (error) {
                console.error("❌ Error al obtener el detalle del pedido:", error);
                return res.status(500).json({ error: "Error al obtener el detalle del pedido" });
            }
    
            if (resultados.length === 0) {
                return res.status(404).json({ error: "Pedido no encontrado" });
            }
    
            const cliente = resultados[0].cliente;
            const fecha = resultados[0].fecha;
            let total = 0;
    
            const productos = resultados.map(r => {
                total += r.subtotal;
                return {
                    codigo: r.codigo,
                    nombre: r.nombre_producto,
                    cantidad: r.cantidad,
                    precio_unitario: r.precio_venta,
                    subtotal: r.subtotal
                };
            });
    
            res.json({
                cliente,
                fecha: new Date(fecha).toLocaleDateString('es-AR'),
                total,
                productos
            });
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
