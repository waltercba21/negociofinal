const administracion = require('../models/administracion')
const path = require('path');
const PDFDocument = require('pdfkit');


function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('-');
}
function formatFechaDMY(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

module.exports = {
    administracion: (req, res) => {
        administracion.getProveedores((error, proveedores) => {
            if (error) {
                console.error("❌ Error al obtener proveedores:", error);
                res.status(500).send("Error al obtener proveedores");
            } else {
                res.render('administracion', { proveedores });
            }
        });
    },
    getProveedorByIdAPI: (req, res) => {
        const id = req.params.id;
        administracion.getProveedorById(id, (err, proveedor) => {
          if (err || !proveedor) {
            return res.status(404).json({ message: 'Proveedor no encontrado' });
          }
          res.json(proveedor);
        });
      },
      
      crearProveedor: (req, res) => {
        const nuevoProveedor = req.body;
        administracion.insertProveedor(nuevoProveedor, (err, result) => {
          if (err) {
            console.error("❌ Error al crear proveedor:", err);
            return res.status(500).json({ message: 'Error al crear proveedor' });
          }
          res.json({ message: 'Proveedor creado exitosamente' });
        });
      },
      
      editarProveedor: (req, res) => {
        const id = req.params.id;
        const datosActualizados = req.body;
        administracion.updateProveedor(id, datosActualizados, (err, result) => {
          if (err) {
            console.error("❌ Error al actualizar proveedor:", err);
            return res.status(500).json({ message: 'Error al actualizar proveedor' });
          }
          res.json({ message: 'Proveedor actualizado exitosamente' });
        });
      },
      
      eliminarProveedor: (req, res) => {
        const id = req.params.id;
        administracion.deleteProveedor(id, (err, result) => {
          if (err) {
            console.error("❌ Error al eliminar proveedor:", err);
            return res.status(500).json({ message: 'Error al eliminar proveedor' });
          }
          res.json({ message: 'Proveedor eliminado exitosamente' });
        });
      },
      getProveedoresAPI: (req, res) => {
        administracion.getProveedores((err, proveedores) => {
          if (err) {
            console.error("❌ Error al obtener proveedores desde API:", err);
            return res.status(500).json({ error: 'Error al obtener proveedores' });
          }
          res.json(proveedores);
        });
      },
      
    facturas: (req, res) => {
        administracion.getProveedores(function(error, proveedores) {
            if (error) {
                console.error(error);
                res.status(500).send('Error al obtener los proveedores');
            } else {
                res.render('facturasAdministracion', { proveedores: proveedores });
            }
        });
    },
postFactura: function (req, res) {
  const nuevaFactura = {
    id_proveedor: req.body.id_proveedor,
    fecha: req.body.fecha,
    numero_factura: req.body.numero_factura,
    importe_bruto: req.body.importe_bruto,
    iva: req.body.iva,
    importe_factura: req.body.importe_factura,
    fecha_pago: req.body.fecha_pago,
    condicion: req.body.condicion,
    administrador: req.body.administrador, // 👈 ESTE ES EL NUEVO CAMPO
    comprobante_pago: req.file ? req.file.filename : null
  };

  administracion.insertFactura(nuevaFactura, function (insertId, error) {
    if (error) {
      console.error("❌ Error al insertar factura:", error);
      return res.status(500).json({ message: 'Error al crear factura' });
    }
    console.log("✅ Factura creada con ID:", insertId);
    res.json({ message: 'Factura creada exitosamente', insertId });
  });
},

    listadoFacturas : function(req, res) {
        administracion.getFacturas(function(error, facturas) {
            if (error) {
                console.error(error);
                res.status(500).send('Error al obtener las facturas');
            } else {
                console.log('Facturas:', facturas); // Agrega esta línea
                administracion.getProveedores(function(error, proveedores) {
                    if (error) {
                        console.error(error);
                        res.status(500).send('Error al obtener los proveedores');
                    } else {
                        res.render('listadoFacturasAdmin', { 
                            facturas: facturas, 
                            proveedores: proveedores,
                            parseDate: function(dateString) {
                                if (typeof dateString === 'string') {
                                    var parts = dateString.split('-');
                                    if (parts.length === 3) {
                                        var date = new Date(parts[0], parts[1] - 1, parts[2]);
                                        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                                    }
                                }
                                return '';
                            }
                        });
                    }
                });
            }
        });
    },
    getModificarFactura : function(req, res) {
        console.log("getModificarFactura called with id:", req.params.id);
        let id = req.params.id;
        administracion.getFacturaById(id, function(err, factura) {
            if (err) {
                console.error(err);
                res.status(500).send('Error al obtener la factura');
            } else if (factura) {
                // Formatea las fechas
                factura.fecha = formatDate(factura.fecha);
                factura.fecha_pago = formatDate(factura.fecha_pago);
    
                administracion.getProveedores(function(error, proveedores) {
                    if (error) {
                        console.error(error);
                        res.status(500).send('Error al obtener los proveedores');
                    } else {
                        res.render('modificarFactura', { factura: factura, proveedores: proveedores });
                    }
                });
            } else {
                res.redirect('/administracion/listadoFacturas');
            }
        });
    },
    getEliminarFactura : function(req, res) {
        let id = req.params.id;
        administracion.deleteFacturaById(id, function() {
            res.redirect('/administracion/listadoFacturas');
        });
    },
    postModificarFactura: function (req, res) {
        const id = req.params.id;
    
        administracion.getFacturaById(id, function (err, facturaActual) {
            if (err) {
                console.error(err);
                return res.status(500).send('Error al obtener la factura');
            }
    
            const facturaModificada = {
                id_proveedor: req.body.id_proveedor,
                fecha: req.body.fecha,
                numero_factura: req.body.numero_factura,
                importe_bruto: req.body.importe_bruto,
                iva: req.body.iva,
                importe_factura: req.body.importe_factura,
                fecha_pago: req.body.fecha_pago,
                condicion: req.body.condicion,
                comprobante_pago: req.file ? req.file.filename : facturaActual.comprobante_pago
            };
    
            administracion.updateFacturaById(id, facturaModificada, function () {
                res.redirect('/administracion/listadoFacturas');
            });
        });
    },    
    postEliminarFactura: function(req, res) {
        let id = req.params.id;
        administracion.deleteFacturaById(id, function(err, results) {
            if (err) {
                console.error('Error al eliminar la factura:', err);
                res.status(500).send('Error al eliminar la factura');
            } else {
                console.log('Factura eliminada con éxito:', results);
                res.redirect('/administracion/listadoFacturas');
            }
        });
    },
    verDetalle: (req, res) => {
        const facturaID = req.params.id;
    
        administracion.getFacturaById(facturaID, (error, factura) => {
            if (error) {
                return res.status(500).send('Error al obtener la factura');
            }
    
            // Formatear las fechas antes de pasar a la vista
            const formatDate = (date) => {
                const d = new Date(date);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0'); // Los meses van de 0 a 11
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
            };
    
            // Formatear las fechas de la factura
            factura.fecha = formatDate(factura.fecha);
            factura.fecha_pago = formatDate(factura.fecha_pago);
    
            administracion.getProductosByFacturaId(facturaID, (error, productos) => {
                if (error) {
                    return res.status(500).send('Error al obtener los productos de la factura');
                }
    
                res.render('detalleFactura', {
                    factura: factura,
                    productos: productos
                });
            });
        });
    },    
    generarPDFProveedor : function(req, res) {
        var printer = new pdfmake(fonts);
        var idProveedor = req.query.proveedorListado;
    
        // Obtén los detalles del proveedor
        administracion.getProveedorById(idProveedor, function(error, proveedor) {
            if (error) throw error;
    
            // Obtén las facturas del proveedor
            administracion.getFacturasByProveedorId(idProveedor, function(error, facturas) {
                if (error) throw error;
    
                var docDefinition = {
                    content: [
                        'Listado de facturas del proveedor ' + proveedor.nombre, // usa el nombre del proveedor
                        {
                            table: {
                                body: [
                                    ['ID', 'Fecha', 'Número de Factura', 'Fecha de Pago', 'Importe', 'Condición'],
                                    ...facturas.map(factura => [
                                        factura.id, 
                                        new Date(factura.fecha).toLocaleDateString(), // formatea la fecha
                                        factura.numero_factura, 
                                        new Date(factura.fecha_pago).toLocaleDateString(), // formatea la fecha de pago
                                        factura.importe, 
                                        factura.condicion
                                    ])
                                ]
                            }
                        }
                    ]
                };
    
                var pdfDoc = printer.createPdfKitDocument(docDefinition);
                pdfDoc.pipe(res);
                pdfDoc.end();
            })
        });
    },
    guardarItemsFactura: async (req, res) => {
        const { facturaId, items } = req.body;
      
        if (!facturaId || !Array.isArray(items)) {
          return res.status(400).json({ error: 'Datos incompletos' });
        }
      
        try {
          for (const item of items) {
            const itemFactura = {
              factura_id: facturaId,
              producto_id: item.id,
              cantidad: item.cantidad
            };
      
            await new Promise((resolve, reject) => {
              administracion.insertarItemFactura(itemFactura, (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            });
      
            await new Promise((resolve, reject) => {
              administracion.actualizarStockProducto(item.id, item.cantidad, (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            });
          }
      
          res.json({ message: 'Productos agregados y stock actualizado correctamente' });
        } catch (err) {
          console.error('❌ Error al guardar productos en factura:', err);
          res.status(500).json({ error: 'Error al guardar productos de factura' });
        }
      },

  postPresupuesto: (req, res) => {
  const nuevoPresupuesto = {
    id_proveedor: req.body.id_proveedor,
    fecha: req.body.fecha,
    numero_presupuesto: req.body.numero_presupuesto,
    fecha_pago: req.body.fecha_pago,
    importe: req.body.importe,
    condicion: req.body.condicion,
    administrador: req.body.administrador

  };

  administracion.insertPresupuesto(nuevoPresupuesto, (insertId, error) => {
    if (error) {
      console.error("❌ Error al guardar presupuesto:", error);
      return res.status(500).json({ message: 'Error al crear presupuesto' });
    }

    res.json({ message: 'Presupuesto creado exitosamente', insertId });
  });
},
generarPDFIndividual : async (req, res) => {
  const tipo = req.params.tipo;
  const id = req.params.id;
  console.log(`🧾 Generar PDF individual: tipo=${tipo}, id=${id}`);

  try {
    let data;

    if (tipo === 'factura') {
      data = await new Promise((resolve, reject) => {
        administracion.obtenerFacturaPorId(id, (err, datos) => err ? reject(err) : resolve(datos));
      });
    } else if (tipo === 'presupuesto') {
      data = await new Promise((resolve, reject) => {
        administracion.obtenerPresupuestoPorId(id, (err, datos) => err ? reject(err) : resolve(datos));
      });
    } else {
      console.warn('❌ Tipo inválido en generarPDFIndividual');
      return res.status(400).send('Tipo inválido');
    }

    console.log('✅ Datos obtenidos:', data);
    const productos = data.productos || [];

    
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(16).text(tipo === 'factura' ? 'FACTURA' : 'PRESUPUESTO', { align: 'center' });
    doc.moveDown();

    // Datos principales
    doc.fontSize(11);
    doc.text(`Proveedor: ${data.nombre_proveedor}`);
    doc.text(`Número: ${tipo === 'factura' ? data.numero_factura : data.numero_presupuesto}`);
    doc.text(`Fecha: ${formatFechaDMY(data.fecha)}`);
    doc.text(`Vencimiento: ${formatFechaDMY(data.fecha_pago)}`);
    doc.text(`Administrador: ${data.administrador}`);
    doc.text(`Condición: ${data.condicion}`);
    doc.moveDown();

    if (tipo === 'factura') {
      doc.text(`Importe Bruto: $${data.importe_bruto}`);
      doc.text(`IVA: ${data.iva}%`);
      doc.text(`Importe Total: $${data.importe_factura}`);
    } else {
      doc.text(`Importe Total: $${data.importe}`);
    }

    doc.moveDown().fontSize(13).text('Productos Asociados', { underline: true });
    doc.moveDown();

    if (productos.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Producto', 50, doc.y);
      doc.text('Cantidad', 300, doc.y);
      doc.moveDown();

      doc.font('Helvetica');
      productos.forEach(p => {
        doc.text(p.nombre, 50, doc.y);
        doc.text(p.cantidad.toString(), 300, doc.y);
        doc.moveDown();
      });
    } else {
      doc.fontSize(11).text('Comprobante sin productos asociados.');
    }

    doc.end();
  } catch (error) {
    console.error('❌ Error al generar PDF individual:', error);
    res.status(500).send('Error al generar el PDF');
  }
},
generarResumenPresupuestosPDF : (req, res) => {
  const { desde, hasta, proveedor, condicion } = req.query;


  console.log(`📄 Generar PDF resumen presupuestos: desde=${desde}, hasta=${hasta}, proveedor=${proveedor}`);

  if (!desde || !hasta) {
    return res.status(400).send('Debés especificar fecha desde y hasta');
  }

  administracion.getPresupuestosEntreFechas(desde, hasta, proveedor, condicion, (err, presupuestos) => {
    if (err) {
      console.error("❌ Error al obtener presupuestos:", err);
      return res.status(500).send('Error al generar el resumen');
    }

    console.log(`✅ ${presupuestos.length} presupuestos encontrados`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(16).text('Resumen de Presupuestos', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Período: ${formatFechaDMY(desde)} al ${formatFechaDMY(hasta)}`);

    if (proveedor) doc.text(`Proveedor filtrado: ${proveedor}`);
    if (condicion) doc.text(`Condición filtrada: ${condicion.toUpperCase()}`);
    doc.moveDown();

    // Posiciones fijas para columnas
    const colX = [50, 130, 250, 390, 470];
    let y = doc.y;

    doc.font('Helvetica-Bold');
doc.text('Fecha', colX[0], y);
doc.text('N° Presupuesto', colX[1], y);
doc.text('Proveedor', colX[2], y);
doc.text('Condición', colX[3], y);
doc.text('Importe', colX[4], y);

    y += 20;

    doc.font('Helvetica');
    let total = 0;

    presupuestos.forEach(p => {
      if (y > 750) {
        doc.addPage();
        y = 40;
      }

      doc.text(formatFechaDMY(p.fecha), colX[0], y);
      doc.text(p.numero_presupuesto, colX[1], y);
      doc.text(p.proveedor, colX[2], y, { width: 130 });
      doc.text(p.condicion, colX[3], y);
      doc.text(`$${p.importe}`, colX[4], y);
      y += 18;

      total += parseFloat(p.importe);
    });

    y += 20;
    doc.font('Helvetica-Bold').text(`Total presupuestado: $${total.toFixed(2)}`, colX[4], y, { align: 'right' });

    doc.end();
  });
},
generarResumenFacturasPDF : (req, res) => {
  const { desde, hasta, proveedor, condicion } = req.query;

  console.log(`📄 Generar PDF resumen facturas: desde=${desde}, hasta=${hasta}`);

  if (!desde || !hasta) {
    return res.status(400).send('Debés especificar fecha desde y hasta');
  }

  administracion.getFacturasEntreFechas(desde, hasta, proveedor, condicion, (err, facturas) => {
    if (err) {
      console.error("❌ Error al obtener facturas:", err);
      return res.status(500).send('Error al generar el resumen');
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(16).text('Resumen de Facturas', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Período: ${formatFechaDMY(desde)} al ${formatFechaDMY(hasta)}`);
    if (condicion) doc.text(`Condición filtrada: ${condicion.toUpperCase()}`);
    doc.moveDown();

    const startY = doc.y;
    let y = startY;
    const colX = [50, 130, 250, 390, 470];

    // Encabezados
    doc.font('Helvetica-Bold');
    doc.text('Fecha', colX[0], y);
    doc.text('N° Factura', colX[1], y);
    doc.text('Proveedor', colX[2], y);
    doc.text('Condición', colX[3], y);
    doc.text('Importe', colX[4], y);
    y += 20;

    doc.font('Helvetica');
    let total = 0;

    facturas.forEach(f => {
      if (y > 750) {
        doc.addPage();
        y = 40;
      }

      doc.text(formatFechaDMY(f.fecha), colX[0], y);
      doc.text(f.numero_factura, colX[1], y);
      doc.text(f.proveedor, colX[2], y, { width: 130 });
      doc.text(f.condicion, colX[3], y);
      doc.text(`$${f.importe_factura}`, colX[4], y);
      y += 18;

      total += parseFloat(f.importe_factura);
    });

    y += 20;
    doc.font('Helvetica-Bold').text(`Total compras: $${total.toFixed(2)}`, colX[4], y, { align: 'right' });

    doc.end();
  });
},
guardarItemsPresupuesto: async (req, res) => {
  const { presupuestoId, items } = req.body;

  if (!presupuestoId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Datos inválidos para productos del presupuesto' });
  }

  try {
    for (const item of items) {
      const itemPresupuesto = {
        presupuesto_id: presupuestoId,
        producto_id: item.id,
        cantidad: item.cantidad
      };

      // Guardar ítem
      await new Promise((resolve, reject) => {
        administracion.insertarItemPresupuesto(itemPresupuesto, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      // Actualizar stock
      await new Promise((resolve, reject) => {
        administracion.actualizarStockProducto(item.id, item.cantidad, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    }

    res.json({ message: 'Productos del presupuesto guardados y stock actualizado correctamente' });
  } catch (err) {
    console.error("❌ Error al guardar productos del presupuesto:", err);
    res.status(500).json({ error: 'Error al guardar productos del presupuesto' });
  }
},
listarDocumentos: (req, res) => {
  const { tipo, proveedor, fechaDesde, fechaHasta, condicion } = req.query;

  administracion.obtenerDocumentosFiltrados(
    tipo,
    proveedor,
    fechaDesde,
    fechaHasta,
    condicion,
    (err, resultados) => {
      if (err) {
        console.error('❌ Error en listarDocumentos:', err);
        return res.status(500).json({ error: 'Error al obtener documentos' });
      }

      // 🔁 Agregamos el campo "numero" según el tipo
      const resultadosConNumero = resultados.map(r => ({
        ...r,
        numero: r.numero_factura || r.numero_presupuesto || '—'
      }));

      res.json(resultadosConNumero);
    }
  );
},


getFacturaById: (req, res) => {
  administracion.obtenerFacturaPorId(req.params.id, (err, datos) => {
    if (err) return res.status(500).json({ error: 'Error al buscar factura' });
    res.json(datos);
  });
},

getPresupuestoById: (req, res) => {
  administracion.obtenerPresupuestoPorId(req.params.id, (err, datos) => {
    if (err) return res.status(500).json({ error: 'Error al buscar presupuesto' });
    res.json(datos);
  });
},

  actualizarFactura: (req, res) => {
    administracion.editarFactura(req.params.id, req.body, (err, resultado) => {
      if (err) return res.status(500).json({ error: 'Error al actualizar factura' });
      res.json({ message: 'Factura actualizada correctamente' });
    });
  },

  actualizarPresupuesto: (req, res) => {
    administracion.editarPresupuesto(req.params.id, req.body, (err, resultado) => {
      if (err) return res.status(500).json({ error: 'Error al actualizar presupuesto' });
      res.json({ message: 'Presupuesto actualizado correctamente' });
    });
  },
verificarDocumentoDuplicado: (req, res) => {
  const { tipo, proveedor, fecha, numero } = req.query;

  if (!tipo || !proveedor || !fecha || !numero) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  administracion.verificarDocumentoDuplicado(tipo, proveedor, fecha, numero, (err, resultados) => {
    if (err) {
      console.error('❌ Error al verificar duplicado:', err);
      return res.status(500).json({ error: 'Error interno al verificar duplicado' });
    }

    return res.json({ existe: resultados.length > 0 });
  });
}

      
}