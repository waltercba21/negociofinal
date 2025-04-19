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
          doc.font("Helvetica-Bold").fontSize(14).text("ORDEN DE PREPARACION DE PEDIDO", { align: "center" });
          doc.moveDown();
          doc.font("Helvetica").fontSize(11);
          doc.text(`Cliente: ${detalle.cliente}`);
          doc.text(`Teléfono: ${detalle.telefono || '---'}`);
          doc.text(`Fecha: ${detalle.fecha}`);
          doc.moveDown(1);
      
          // 📦 COLUMNAS
          const col_codigo = 35;
          const col_producto = 75;
          const col_cantidad = 20;
          const col_unitario = 30;
          const col_subtotal = 30;
      
          // 🧱 ENCABEZADO TABLA
          doc.font("Helvetica-Bold").fontSize(9);
          doc.cell = undefined; // asegurarse que no esté definida
          doc.cell = (x, y, w, h, text, align = "L") => {
            doc.rect(x, y, w, h).stroke();
            doc.text(text, x + 2, y + 2, { width: w - 4, align });
          };
      
          const startX = doc.x;
          let y = doc.y;
      
          doc.cell(startX, y, col_codigo, 7, "Código");
          doc.cell(startX + col_codigo, y, col_producto, 7, "Producto");
          doc.cell(startX + col_codigo + col_producto, y, col_cantidad, 7, "Cant.", "C");
          doc.cell(startX + col_codigo + col_producto + col_cantidad, y, col_unitario, 7, "P. Unitario", "R");
          doc.cell(startX + col_codigo + col_producto + col_cantidad + col_unitario, y, col_subtotal, 7, "Subtotal", "R");
      
          y += 7;
      
          // 🧾 FILAS DE PRODUCTOS
          doc.font("Helvetica").fontSize(8);
      
          detalle.productos.forEach(prod => {
            const nombre = prod.nombre;
            const lineHeight = 4;
            const nombre_lines = doc.splitTextToSize(nombre, col_producto);
            const row_height = nombre_lines.length * lineHeight;
      
            // Código
            doc.rect(startX, y, col_codigo, row_height).stroke();
            doc.text(prod.codigo, startX + 2, y + 2);
      
            // Producto multilínea
            doc.rect(startX + col_codigo, y, col_producto, row_height).stroke();
            doc.text(nombre, startX + col_codigo + 2, y + 2, {
              width: col_producto - 4,
              align: "left"
            });
      
            // Cantidad
            doc.rect(startX + col_codigo + col_producto, y, col_cantidad, row_height).stroke();
            doc.text(String(prod.cantidad), startX + col_codigo + col_producto + 2, y + 2, {
              width: col_cantidad - 4,
              align: "center"
            });
      
            // Precio unitario
            doc.rect(startX + col_codigo + col_producto + col_cantidad, y, col_unitario, row_height).stroke();
            doc.text(`$${prod.precio_unitario.toLocaleString('es-AR')}`, startX + col_codigo + col_producto + col_cantidad + 2, y + 2, {
              width: col_unitario - 4,
              align: "right"
            });
      
            // Subtotal
            doc.rect(startX + col_codigo + col_producto + col_cantidad + col_unitario, y, col_subtotal, row_height).stroke();
            doc.text(`$${prod.subtotal.toLocaleString('es-AR')}`, startX + col_codigo + col_producto + col_cantidad + col_unitario + 2, y + 2, {
              width: col_subtotal - 4,
              align: "right"
            });
      
            y += row_height;
            doc.y = y;
          });
      
          // 🧮 TOTAL
          doc.font("Helvetica-Bold").fontSize(9);
          const totalX = startX + col_codigo + col_producto + col_cantidad + col_unitario;
          doc.rect(startX, y, col_codigo + col_producto + col_cantidad + col_unitario, 7).stroke();
          doc.text("TOTAL:", startX, y + 2, {
            width: col_codigo + col_producto + col_cantidad + col_unitario - 4,
            align: "right"
          });
          doc.rect(totalX, y, col_subtotal, 7).stroke();
          doc.text(`$${detalle.total.toLocaleString('es-AR')}`, totalX + 2, y + 2, {
            width: col_subtotal - 4,
            align: "right"
          });
      
          doc.y = y + 20;
      
          // 🖊 PIE
          doc.moveDown(2);
          doc.font("Helvetica").fontSize(8);
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
