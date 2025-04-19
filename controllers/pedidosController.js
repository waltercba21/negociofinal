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
      
          // Encabezado
          doc.font("Helvetica-Bold").fontSize(14).text("ORDEN DE PREPARACION DE PEDIDO", { align: "center" });
          doc.moveDown();
          doc.font("Helvetica").fontSize(11);
          doc.text(`Cliente: ${detalle.cliente}`);
          doc.text(`Teléfono: ${detalle.telefono || '---'}`);
          doc.text(`Fecha: ${detalle.fecha}`);
          doc.moveDown();
      
          // Columnas
          const col_codigo = 35;
          const col_producto = 75;
          const col_cantidad = 20;
          const col_unitario = 30;
          const col_subtotal = 30;
      
          // Encabezado tabla
          doc.font("Helvetica-Bold").fontSize(9);
          doc.text("Código", doc.x, doc.y, { width: col_codigo });
          doc.text("Producto", doc.x + col_codigo, doc.y, { width: col_producto });
          doc.text("Cant.", doc.x + col_codigo + col_producto, doc.y, { width: col_cantidad, align: "center" });
          doc.text("P. Unitario", doc.x + col_codigo + col_producto + col_cantidad, doc.y, { width: col_unitario, align: "right" });
          doc.text("Subtotal", doc.x + col_codigo + col_producto + col_cantidad + col_unitario, doc.y, { width: col_subtotal, align: "right" });
          doc.moveDown(0.5);
      
          // Contenido tabla
          doc.font("Helvetica").fontSize(8);
          detalle.productos.forEach(prod => {
            const y = doc.y;
            const x = doc.x;
      
            const nombre = prod.nombre;
            const nombre_height = doc.heightOfString(nombre, { width: col_producto });
            const row_height = Math.max(nombre_height, 8);
      
            doc.text(prod.codigo, x, y, { width: col_codigo });
            doc.text(nombre, x + col_codigo, y, { width: col_producto });
            doc.text(String(prod.cantidad), x + col_codigo + col_producto, y, { width: col_cantidad, align: "center" });
            doc.text(`$${prod.precio_unitario.toLocaleString('es-AR')}`, x + col_codigo + col_producto + col_cantidad, y, { width: col_unitario, align: "right" });
            doc.text(`$${prod.subtotal.toLocaleString('es-AR')}`, x + col_codigo + col_producto + col_cantidad + col_unitario, y, { width: col_subtotal, align: "right" });
      
            doc.moveDown(nombre_height / 8); // avance proporcional
          });
      
          // Total
          doc.moveDown(1);
          doc.font("Helvetica-Bold").fontSize(9);
          doc.text("TOTAL:", doc.x, doc.y, {
            width: col_codigo + col_producto + col_cantidad + col_unitario,
            align: "right"
          });
          doc.text(`$${detalle.total.toLocaleString('es-AR')}`, doc.x + col_codigo + col_producto + col_cantidad + col_unitario, doc.y, {
            width: col_subtotal,
            align: "right"
          });
      
          // Pie
          doc.moveDown(2);
          doc.font("Helvetica").fontSize(8);
          doc.text("El producto se entrega en perfectas condiciones y fue revisado previamente.");
          doc.moveDown();
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
