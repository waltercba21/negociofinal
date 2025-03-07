const pedidos = require('../models/pedidos');
const { io } = require('../app');

module.exports = {
    obtenerPedidos: (req, res) => {
        const estado = req.query.estado || null;

        pedidos.obtenerPedidos(estado, (error, pedidos) => {
            if (error) {
                return res.status(500).json({ error: "Error al obtener los pedidos" });
            }
            res.render("pedidos", { pedidos });  // Renderiza la vista con la lista de pedidos
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

        pedidos.actualizarEstadoPedido(id_pedido, "preparación", (error) => {
            if (error) {
                return res.status(500).json({ error: "Error al actualizar el pedido a 'preparación'" });
            }
            io.emit('pedidoActualizado', { id_pedido, estado: "preparación" });
            res.json({ mensaje: "Pedido marcado como en preparación" });
        });
    },

    marcarPedidoComoFinalizado: (req, res) => {
        const id_pedido = req.params.id;

        pedidos.actualizarEstadoPedido(id_pedido, "finalizado", (error) => {
            if (error) {
                return res.status(500).json({ error: "Error al actualizar el pedido a 'finalizado'" });
            }
            io.emit('pedidoActualizado', { id_pedido, estado: "finalizado" });
            res.json({ mensaje: "Pedido marcado como finalizado" });
        });
    }
};
