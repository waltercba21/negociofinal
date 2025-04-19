const pedidos = require('../models/pedidos');
const puppeteer = require('puppeteer');
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
    generarPDFPreparacion: async (req, res) => {
        const id_carrito = req.params.id;
      
        pedidos.obtenerDetallePedido(id_carrito, async (error, detalle) => {
          if (error || !detalle) {
            console.error("❌ No se pudo generar el PDF:", error);
            return res.status(500).send("Error al generar PDF");
          }
      
          const htmlContent = `
            <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; font-size: 12px; padding: 40px; }
                  h1 { text-align: center; }
                  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                  th, td { border: 1px solid #000; padding: 5px; text-align: left; }
                  .right { text-align: right; }
                  .center { text-align: center; }
                  .footer { margin-top: 30px; }
                </style>
              </head>
              <body>
                <h1>ORDEN DE PREPARACION DE PEDIDO</h1>
                <p><strong>Cliente:</strong> ${detalle.cliente}</p>
                <p><strong>Teléfono:</strong> ${detalle.telefono || '---'}</p>
                <p><strong>Fecha:</strong> ${detalle.fecha}</p>
      
                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Producto</th>
                      <th class="center">Cant.</th>
                      <th class="right">P. Unitario</th>
                      <th class="right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${detalle.productos.map(prod => `
                      <tr>
                        <td>${prod.codigo}</td>
                        <td>${prod.nombre}</td>
                        <td class="center">${prod.cantidad}</td>
                        <td class="right">$${prod.precio_unitario.toLocaleString('es-AR')}</td>
                        <td class="right">$${prod.subtotal.toLocaleString('es-AR')}</td>
                      </tr>
                    `).join('')}
                    <tr>
                      <td colspan="4" class="right"><strong>TOTAL:</strong></td>
                      <td class="right"><strong>$${detalle.total.toLocaleString('es-AR')}</strong></td>
                    </tr>
                  </tbody>
                </table>
      
                <div class="footer">
                  <p>El producto se entrega en perfectas condiciones y fue revisado previamente.</p>
                  <p>Firma del cliente: ______________________</p>
                  <p>Aclaración: ______________________</p>
                  <p>DNI: __________________</p>
                </div>
              </body>
            </html>
          `;
      
          const filePath = path.join(__dirname, `../temp/preparacion_${id_carrito}.pdf`);
          const browser = await puppeteer.launch({ headless: true });
          const page = await browser.newPage();
          await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
          await page.pdf({ path: filePath, format: 'A4', printBackground: true });
          await browser.close();
      
          res.download(filePath, `pedido_${id_carrito}.pdf`, (err) => {
            if (err) console.error("❌ Error al enviar el PDF:", err);
            fs.unlink(filePath, () => {});
          });
        });
      }
};
