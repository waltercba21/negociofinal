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
    generarPDFPreparacion : (req, res) => {
        const id_carrito = req.params.id;
      
        pedidos.obtenerDetallePedido(id_carrito, (error, detalle) => {
          if (error || !detalle) {
            console.error("❌ No se pudo generar el PDF:", error);
            return res.status(500).send("Error al generar PDF");
          }
      
          // Ruta temporal
          const filePath = path.join(__dirname, `../temp/preparacion_${id_carrito}.pdf`);
          const doc = new PDFDocument();
      
          // Crear carpeta si no existe
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
      
          // Escribir PDF en disco
          const stream = fs.createWriteStream(filePath);
          doc.pipe(stream);
      
          // Encabezado
          doc.fontSize(16).text("ORDEN DE PREPARACION DE PEDIDO", { align: "center" }).moveDown();
          doc.fontSize(12);
          doc.text(`Cliente: ${detalle.cliente}`);
          doc.text(`Teléfono: ${detalle.telefono || '---'}`);
          doc.text(`Fecha: ${detalle.fecha}`);
          doc.moveDown(1);
      
          // Tabla de productos
          doc.font("Helvetica-Bold", 11);
          doc.text("Código", 50, doc.y, { continued: true });
          doc.text("Producto", 120, doc.y, { continued: true });
          doc.text("Cant.", 300, doc.y, { continued: true });
          doc.text("P. Unitario", 360, doc.y, { continued: true });
          doc.text("Subtotal", 450);
          doc.moveDown(0.5);
          doc.font("Helvetica", 10);
      
          detalle.productos.forEach(prod => {
            doc.text(prod.codigo, 50, doc.y, { continued: true });
            doc.text(prod.nombre, 120, doc.y, { continued: true });
            doc.text(String(prod.cantidad), 300, doc.y, { continued: true });
            doc.text(`$${prod.precio_unitario}`, 360, doc.y, { continued: true });
            doc.text(`$${prod.subtotal}`, 450);
          });
      
          doc.moveDown();
          doc.font("Helvetica-Bold").fontSize(12).text(`TOTAL: $${detalle.total}`, { align: "right" });
          doc.moveDown(2);
      
          // Pie
          doc.font("Helvetica").fontSize(10);
          doc.text("El producto se entrega en perfectas condiciones y fue revisado previamente.");
          doc.moveDown(2);
          doc.text("Firma del cliente: ______________________", { continued: true });
          doc.text("   Aclaración: ______________________", { continued: true });
          doc.text("   DNI: __________________");
      
          doc.end();
      
          // Cuando el archivo esté listo, enviarlo
          stream.on('finish', () => {
            res.download(filePath, `pedido_${id_carrito}.pdf`, (err) => {
              if (err) console.error("❌ Error al enviar el PDF:", err);
              fs.unlink(filePath, () => {}); // Borrar archivo temporal
            });
          });
        });
      },
    
};
