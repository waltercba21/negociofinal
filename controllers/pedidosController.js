const pedidos = require('../models/pedidos');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

module.exports = {
    obtenerPedidos: (req, res) => {
        console.log("📢 Solicitando todos los pedidos (sin filtro de estado)");
    
        pedidos.obtenerPedidos((error, pedidos) => {
            if (error) {
                console.error("❌ Error al obtener pedidos:", error);
                return res.status(500).json({ error: "Error al obtener los pedidos" });
            }
            console.log("✅ Enviando todos los pedidos a la vista:", pedidos);
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
            const io = req.app.get("io");  // Obtener `io` correctamente
            io.emit("nuevoPedido", { id_pedido, estado: "preparación" });

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
            const io = req.app.get("io");  // Obtener `io` correctamente
            io.emit("nuevoPedido", { id_pedido, estado: "finalizado" });

            res.json({ mensaje: "Pedido marcado como finalizado" });
        });
    },
    obtenerDetallePedido: (req, res) => {
        const id_carrito = req.params.id;
        console.log(`🔍 Obteniendo detalle desde el controlador para carrito ID: ${id_carrito}`);
    
        pedidos.obtenerDetallePedido(id_carrito, (error, detalle) => {
            if (error) {
                console.error("❌ Error al obtener detalle desde el modelo:", error);
                return res.status(500).json({ error: "Error al obtener el detalle del pedido" });
            }
    
            if (!detalle) {
                return res.status(404).json({ error: "Pedido no encontrado" });
            }
    
            // Formatear la fecha en el controlador
            detalle.fecha = new Date(detalle.fecha).toLocaleDateString('es-AR');
    
            res.json(detalle);
        });
    },
    generarPDFPreparacion: (req, res) => {
        const id_carrito = req.params.id;
      
        pedidos.obtenerDetallePedido(id_carrito, (error, detalle) => {
          if (error || !detalle) {
            console.error("❌ No se pudo generar el PDF:", error);
            return res.status(500).send("Error al generar PDF");
          }
      
          const filePath = path.join(__dirname, `../temp/preparacion_${id_carrito}.pdf`);
          const doc = new PDFDocument({ margin: 40 });
      
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
          const stream = fs.createWriteStream(filePath);
          doc.pipe(stream);
      
          // 🧾 ENCABEZADO
          doc.font("Arial", 14).font("Helvetica-Bold").text("ORDEN DE PREPARACION DE PEDIDO", { align: "center" });
          doc.moveDown();
          doc.font("Helvetica").fontSize(11);
          doc.text(`Cliente: ${detalle.cliente}`);
          doc.text(`Teléfono: ${detalle.telefono || '---'}`);
          doc.text(`Fecha: ${detalle.fecha}`);
          doc.moveDown(1);
      
          // 📊 TABLA
          const col_codigo = 35;
          const col_producto = 75;
          const col_cantidad = 20;
          const col_unitario = 30;
          const col_subtotal = 30;
          const x_start = doc.x;
      
          doc.font("Helvetica-Bold", 9);
          doc.cell = (w, h, txt, opts = {}) => doc.cell(w, h, txt, opts.border || 1, opts.align || "L");
      
          doc.cell(col_codigo, 7, "Código", { align: "L" });
          doc.cell(col_producto, 7, "Producto", { align: "L" });
          doc.cell(col_cantidad, 7, "Cant.", { align: "C" });
          doc.cell(col_unitario, 7, "P. Unitario", { align: "R" });
          doc.cell(col_subtotal, 7, "Subtotal", { align: "R" });
          doc.moveDown(0.3);
      
          doc.font("Helvetica", 8);
          detalle.productos.forEach(prod => {
            const y = doc.y;
            const nombre_lines = doc.splitTextToSize(prod.nombre, col_producto);
            const row_height = nombre_lines.length * 4.5;
      
            doc.y = y;
            doc.x = x_start;
            doc.cell(col_codigo, row_height, prod.codigo, { align: "L" });
            doc.cell(col_producto, row_height, prod.nombre, { align: "L" });
            doc.cell(col_cantidad, row_height, String(prod.cantidad), { align: "C" });
            doc.cell(col_unitario, row_height, `$${prod.precio_unitario.toLocaleString('es-AR')}`, { align: "R" });
            doc.cell(col_subtotal, row_height, `$${prod.subtotal.toLocaleString('es-AR')}`, { align: "R" });
          });
      
          // 🧮 TOTAL
          doc.font("Helvetica-Bold", 9);
          doc.cell(col_codigo + col_producto + col_cantidad + col_unitario, 7, "TOTAL:", { align: "R" });
          doc.cell(col_subtotal, 7, `$${detalle.total.toLocaleString('es-AR')}`, { align: "R" });
          doc.moveDown(2);
      
          // 📝 PIE
          doc.font("Helvetica", 8);
          doc.text("El producto se entrega en perfectas condiciones y fue revisado previamente.");
          doc.moveDown(1);
          doc.text("Firma del cliente: ______________________");
          doc.text("Aclaración: ______________________");
          doc.text("DNI: __________________");
      
          doc.end();
      
          stream.on('finish', () => {
            res.download(filePath, `pedido_${id_carrito}.pdf`, (err) => {
              if (err) console.error("❌ Error al enviar el PDF:", err);
              fs.unlink(filePath, () => {});
            });
          });
        });
      },
};
