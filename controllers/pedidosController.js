const pedidos = require('../models/pedidos');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function emitirEstado(req, payload) {
  const io = req.app.get("io");
  if (!io) return;

  // Ideal: emitir al usuario (si tenés rooms). No rompe si no existe.
  if (payload.usuario_id) {
    io.to(`usuario_${payload.usuario_id}`).emit("pedidoActualizado", payload);
  }

  // Fallback: si aún no usás rooms, emit global (si no lo querés, borrá esta línea)
  io.emit("pedidoActualizado", payload);
}

module.exports = {
obtenerPedidos: (req, res) => {
  pedidos.obtenerPedidos((error, rows) => {
    console.log("📌 [ADMIN] obtenerPedidos() rows:", rows?.length || 0);
    if (rows && rows.length) {
      console.log("📌 [ADMIN] estados:", rows.map(r => r.estado));
    }

    if (error) {
      console.error("❌ [ADMIN] Error al obtener pedidos:", error);
      return res.status(500).json({ error: "Error al obtener los pedidos" });
    }
    return res.render("pedidos", { pedidos: rows || [] });
  });
},
obtenerPedidosPendientes: (req, res) => {
  pedidos.obtenerCantidadPedidosPendientes((error, cantidad) => {
    console.log("🔔 [ADMIN] cantidad pendientes:", cantidad);
    if (error) {
      console.error("❌ [ADMIN] Error al obtener pendientes:", error);
      return res.status(500).json({ error: "Error al obtener pedidos pendientes" });
    }
    res.json({ cantidad });
  });
},

confirmarPedido: (req, res) => {
  const id_pedido = Number(req.params.id);

  pedidos.obtenerPedidoPorId(id_pedido, (err, pedido) => {
    if (err) return res.status(500).json({ error: "Error al buscar el pedido" });
    if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

    const est = (pedido.estado || '').toLowerCase();

    if (est === 'finalizado') {
      return res.status(409).json({ error: "El pedido ya está finalizado." });
    }
    if (est === 'carrito') {
      return res.status(409).json({ error: "Este aún es un carrito abierto, no un pedido." });
    }
    if (est !== 'pendiente') {
      return res.status(409).json({ error: `No se puede confirmar desde estado: ${pedido.estado}` });
    }

    // ✅ NUEVO: confirma y descuenta stock en transacción
    pedidos.confirmarPedidoYDescontarStock(id_pedido, (errorTx) => {
      if (errorTx) {
        if (errorTx.code === 'STOCK_INSUFICIENTE') {
          return res.status(409).json({
            error: "No hay stock suficiente para confirmar el pedido.",
            detalle: errorTx.detalle
          });
        }
        if (errorTx.code === 'SIN_ITEMS') {
          return res.status(409).json({ error: "El pedido no tiene productos." });
        }
        return res.status(500).json({ error: "Error al confirmar el pedido y descontar stock." });
      }

      emitirEstado(req, { id_pedido, estado: "confirmado", usuario_id: pedido.usuario_id });
      return res.json({ mensaje: "Pedido confirmado y stock descontado." });
    });
  });
},

  marcarPedidoComoPreparado: (req, res) => {
    const id_pedido = Number(req.params.id);

    pedidos.obtenerPedidoPorId(id_pedido, (err, pedido) => {
      if (err) return res.status(500).json({ error: "Error al buscar el pedido" });
      if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

      const est = (pedido.estado || '').toLowerCase();

      if (est === 'finalizado') {
        return res.status(409).json({ error: "El pedido ya está finalizado." });
      }
      if (est === 'carrito') {
        return res.status(409).json({ error: "Este aún es un carrito abierto, no un pedido." });
      }
      if (est !== 'confirmado') {
        return res.status(409).json({ error: `Primero confirmá el pedido. Estado actual: ${pedido.estado}` });
      }

      pedidos.actualizarEstadoPedido(id_pedido, "preparación", (error2) => {
        if (error2) return res.status(500).json({ error: "Error al marcar el pedido a 'preparación'" });

        emitirEstado(req, { id_pedido, estado: "preparación", usuario_id: pedido.usuario_id });
        return res.json({ mensaje: "Pedido marcado como en preparación" });
      });
    });
  },

  marcarPedidoComoFinalizado: (req, res) => {
    const id_pedido = Number(req.params.id);

    pedidos.obtenerPedidoPorId(id_pedido, (err, pedido) => {
      if (err) return res.status(500).json({ error: "Error al buscar el pedido" });
      if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

      const est = (pedido.estado || '').toLowerCase();

      if (est === 'finalizado') {
        return res.status(409).json({ error: "El pedido ya está finalizado." });
      }
      if (est === 'carrito') {
        return res.status(409).json({ error: "Este aún es un carrito abierto, no un pedido." });
      }
      if (!['preparación','listo para entrega'].includes(est)) {
        return res.status(409).json({ error: `No se puede finalizar desde estado: ${pedido.estado}` });
      }

      pedidos.actualizarEstadoPedido(id_pedido, "finalizado", (error2) => {
        if (error2) return res.status(500).json({ error: "Error al marcar el pedido a 'finalizado'" });

        emitirEstado(req, { id_pedido, estado: "finalizado", usuario_id: pedido.usuario_id });
        return res.json({ mensaje: "Pedido marcado como finalizado" });
      });
    });
  },

  obtenerDetallePedido: (req, res) => {
    const id_carrito = req.params.id;

    pedidos.obtenerDetallePedido(id_carrito, (error, detalle) => {
      if (error) return res.status(500).json({ error: "Error al obtener el detalle del pedido" });
      if (!detalle) return res.status(404).json({ error: "Pedido no encontrado" });

      detalle.fecha = new Date(detalle.fecha).toLocaleDateString('es-AR');
      res.json(detalle);
    });
  },

  generarPDFPreparacion: (req, res) => {
    const id_carrito = req.params.id;

    pedidos.obtenerDetallePedido(id_carrito, (error, detalle) => {
      if (error || !detalle) return res.status(500).send("Error al generar PDF");

      const filePath = path.join(__dirname, `../temp/preparacion_${id_carrito}.pdf`);
      const doc = new PDFDocument({ margin: 40 });

      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.font("Helvetica-Bold").fontSize(14).text("ORDEN DE PREPARACION DE PEDIDO", { align: "center" });
      doc.moveDown();
      doc.font("Helvetica").fontSize(11);
      doc.text(`Cliente: ${detalle.cliente}`);
      doc.text(`Fecha: ${detalle.fecha}`);
      doc.moveDown(1);

      const col_codigo = 80, col_producto = 250, col_cantidad = 60, col_unitario = 80, col_subtotal = 80;
      const startX = doc.x;
      let y = doc.y;

      const cell = (x, y, w, h, text, align = "L") => {
        doc.rect(x, y, w, h).stroke();
        doc.text(String(text ?? ''), x + 4, y + 3, { width: w - 8, align });
      };

      doc.font("Helvetica-Bold").fontSize(9);
      cell(startX, y, col_codigo, 18, "Código");
      cell(startX + col_codigo, y, col_producto, 18, "Producto");
      cell(startX + col_codigo + col_producto, y, col_cantidad, 18, "Cant.", "C");
      cell(startX + col_codigo + col_producto + col_cantidad, y, col_unitario, 18, "P. Unit.", "R");
      cell(startX + col_codigo + col_producto + col_cantidad + col_unitario, y, col_subtotal, 18, "Subtotal", "R");
      y += 18;

      doc.font("Helvetica").fontSize(9);
      detalle.productos.forEach(prod => {
        const rowH = 18;
        cell(startX, y, col_codigo, rowH, prod.codigo);
        cell(startX + col_codigo, y, col_producto, rowH, prod.nombre);
        cell(startX + col_codigo + col_producto, y, col_cantidad, rowH, prod.cantidad, "C");
        cell(startX + col_codigo + col_producto + col_cantidad, y, col_unitario, rowH, `$${Number(prod.precio_unitario||0).toLocaleString('es-AR')}`, "R");
        cell(startX + col_codigo + col_producto + col_cantidad + col_unitario, y, col_subtotal, rowH, `$${Number(prod.subtotal||0).toLocaleString('es-AR')}`, "R");
        y += rowH;
      });

      doc.font("Helvetica-Bold").fontSize(10);
      doc.text(`TOTAL: $${Number(detalle.total||0).toLocaleString('es-AR')}`, startX, y + 10);

      doc.end();

      stream.on('finish', () => {
        res.download(filePath, `pedido_${id_carrito}.pdf`, (err) => {
          fs.unlink(filePath, () => {});
          if (err) console.error("❌ Error al enviar el PDF:", err);
        });
      });
    });
  },
};
