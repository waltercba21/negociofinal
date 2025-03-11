const pedidos = require('../models/pedidos');

module.exports = {
    obtenerPedidos: (req, res) => {
        const estado = req.query.estado || null;
        console.log(`📢 Solicitando pedidos con estado: ${estado}`);
    
        pedidos.obtenerPedidos(estado, (error, pedidos) => {
            if (error) {
                console.error("❌ Error al obtener pedidos:", error);
                return res.status(500).json({ error: "Error al obtener los pedidos" });
            }
            console.log("✅ Enviando pedidos a la vista:", pedidos);
            res.render("pedidos", { pedidos });
        });
    },
    
    obtenerPedidosPendientes: (req, res) => {
        pedidos.obtenerCantidadPedidosPendientes((error, cantidad) => {
            if (error) {
                return res.status(500).json({ error: "Error al obtener pedidos pendientes" });
            }
            res.json({ cantidad });
        });
    },

    marcarPedidoComoPreparado: (req, res) => {
        const id_pedido = req.params.id;
        console.log(`📢 Marcando pedido ${id_pedido} como "preparación"`);

        pedidos.actualizarEstadoPedido(id_pedido, "preparación", (error) => {
            if (error) {
                console.error("❌ Error al actualizar el pedido a 'preparación':", error);
                return res.status(500).json({ error: "Error al actualizar el pedido a 'preparación'" });
            }

            console.log("✅ Pedido actualizado a 'preparación'. Enviando evento Socket.io...");
            const io = req.app.get('io');  // 🔹 Obtener `io` desde `app`
            io.emit('nuevoPedido', { id_pedido, estado: "preparación" });

            res.json({ mensaje: "Pedido marcado como en preparación" });
        });
    },
    
    marcarPedidoComoFinalizado: (req, res) => {
        const id_pedido = req.params.id;
        console.log(`📢 Marcando pedido ${id_pedido} como "finalizado"`);

        pedidos.actualizarEstadoPedido(id_pedido, "finalizado", (error) => {
            if (error) {
                console.error("❌ Error al actualizar el pedido a 'finalizado':", error);
                return res.status(500).json({ error: "Error al actualizar el pedido a 'finalizado'" });
            }

            console.log("✅ Pedido actualizado a 'finalizado'. Enviando evento Socket.io...");
            const io = req.app.get('io');  // 🔹 Obtener `io` desde `app`
            io.emit('nuevoPedido', { id_pedido, estado: "finalizado" });

            res.json({ mensaje: "Pedido marcado como finalizado" });
        });
    },
};
