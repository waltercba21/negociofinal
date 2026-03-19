const administracion = require('../models/administracion')
const path = require('path');
const PDFDocument = require('pdfkit');

// Formato DD/MM/YYYY — usado en vistas y PDFs
function formatFechaDMY(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Formato YYYY-MM-DD — usado para queries SQL
function formatDate(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return [year, month, day].join('-');
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
    comprobante_pago: null
  };

  administracion.insertFactura(nuevaFactura, function (error, insertId) {
    if (error) {
      console.error("❌ Error al insertar factura:", error);
      return res.status(500).json({ message: 'Error al crear factura' });
    }
    res.json({ message: 'Factura creada exitosamente', insertId });
  });
},

    listadoFacturas : function(req, res) {
        administracion.getFacturas(function(error, facturas) {
            if (error) {
                console.error(error);
                res.status(500).send('Error al obtener las facturas');
            } else {
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
    
            // Formatear las fechas de la factura
            factura.fecha = formatFechaDMY(factura.fecha);
            factura.fecha_pago = formatFechaDMY(factura.fecha_pago);
    
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

  administracion.insertPresupuesto(nuevoPresupuesto, (error, insertId) => {
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



  if (!desde || !hasta) {
    return res.status(400).send('Debés especificar fecha desde y hasta');
  }

  administracion.getPresupuestosEntreFechas(desde, hasta, proveedor, condicion, (err, presupuestos) => {
    if (err) {
      console.error("❌ Error al obtener presupuestos:", err);
      return res.status(500).send('Error al generar el resumen');
    }


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
  const { tipo } = req.query;

  // ✅ Si piden Notas de Crédito, usar el endpoint correcto
  if (tipo === 'nota_credito') {
    // Adaptamos los nombres de query del buscador (documentos) -> (notas-credito)
    req.query.proveedor = req.query.proveedor || '';
    req.query.desde = req.query.fechaDesde || null;
    req.query.hasta = req.query.fechaHasta || null;

    // El buscador tiene solo "numero": lo mapeamos a numeroNC
    req.query.numeroNC = (req.query.numero || '').trim();
    req.query.numeroFactura = ''; // si luego agregás campo, lo conectamos

    return module.exports.listarNotasCreditoAPI(req, res);
  }

  // ✅ Si no, sigue como siempre (facturas/presupuestos)
  const { proveedor, fechaDesde, fechaHasta, condicion, numero } = req.query;

  administracion.obtenerDocumentosFiltrados(
    tipo,
    proveedor,
    fechaDesde,
    fechaHasta,
    condicion,
    numero,
    (err, resultados) => {
      if (err) {
        console.error('❌ Error en listarDocumentos:', err);
        return res.status(500).json({ error: 'Error al obtener documentos' });
      }
      res.json(resultados);
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
},
eliminarFactura: (req, res) => {
  administracion.deleteFacturaById(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar factura' });
    res.json({ message: 'Factura eliminada correctamente' });
  });
},
eliminarPresupuesto: (req, res) => {
  administracion.deletePresupuestoById(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar presupuesto' });
    res.json({ message: 'Presupuesto eliminado correctamente' });
  });
},
generarPDFDeudaPendiente : async (req, res) => {
  try {
    administracion.obtenerDocumentosFiltrados(null, null, null, null, 'pendiente', null, (err, docs) => {
      if (err) {
        console.error('❌ Error al obtener documentos:', err);
        return res.status(500).send('Error al generar el PDF');
      }

      const hoy = new Date();
      const vencidos = [];
      const proximos = [];
      const aTiempo = [];

      docs.forEach(doc => {
        const venc = new Date(doc.fecha_pago);
        const dias = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
        doc.fechaFormateada = formatFechaDMY(venc);

        if (dias < 0) vencidos.push(doc);
        else if (dias <= 7) proximos.push(doc);
        else aTiempo.push(doc);
      });

      const docPDF = new PDFDocument({ margin: 40, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      docPDF.pipe(res);

      // Encabezado principal
      docPDF.fontSize(16).font('Helvetica-Bold').text('Deuda Pendiente por Vencimiento', { align: 'center' });
      docPDF.moveDown();
      docPDF.fontSize(10).font('Helvetica').text(`Fecha de generación: ${formatFechaDMY(hoy)}`, { align: 'right' });
      docPDF.moveDown();

      let primeraSeccion = true;
      let totalVencidos = 0;
      let totalProximos = 0;
      let totalATiempo = 0;

      const renderGrupoPDF = (titulo, grupo, color) => {
        if (!grupo.length) return 0;

        if (!primeraSeccion) {
          docPDF.addPage();
        } else {
          primeraSeccion = false;
        }

        docPDF
          .moveDown()
          .fillColor(color)
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(titulo)
          .moveDown()
          .fillColor('black');

        const colX = [50, 140, 260, 370, 470];

        const renderHeader = () => {
          const y = docPDF.y;
          docPDF.fontSize(10).font('Helvetica-Bold');
          docPDF.text('Tipo', colX[0], y);
          docPDF.text('Proveedor', colX[1], y);
          docPDF.text('N°', colX[2], y);
          docPDF.text('Vencimiento', colX[3], y);
          docPDF.text('Importe', colX[4], y);
          docPDF.moveDown(0.5);
          docPDF.font('Helvetica');
        };

        renderHeader();

        let total = 0;
        grupo.forEach(d => {
          if (docPDF.y > 750) {
            docPDF.addPage();
            renderHeader();
          }

          const y = docPDF.y;

          docPDF.text(d.tipo.toUpperCase(), colX[0], y);
          docPDF.text(d.nombre_proveedor, colX[1], y, { width: 110 });
          docPDF.text(d.numero, colX[2], y);
          docPDF.text(d.fechaFormateada, colX[3], y);
          docPDF.text(`$${parseFloat(d.importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, colX[4], y);

          docPDF.moveDown(0.5);
          total += parseFloat(d.importe || 0);
        });

        docPDF.moveDown(1).font('Helvetica-Bold');
        const totalFormatted = total.toLocaleString('es-AR', { minimumFractionDigits: 2 });
        docPDF.text(`Total ${titulo}: $${totalFormatted}`, 50, docPDF.y, {
          align: 'right',
          width: 500
        });

        return total;
      };

      // Render de los 3 grupos
      totalVencidos = renderGrupoPDF('Documentos Vencidos', vencidos, 'red');
      totalProximos = renderGrupoPDF('Prontos a Vencer (≤ 7 días)', proximos, 'orange');
      totalATiempo = renderGrupoPDF('Documentos en Fecha', aTiempo, 'green');

      docPDF.end();
    });
  } catch (err) {
    console.error('❌ Error en PDF deuda pendiente:', err);
    res.status(500).send('Error interno al generar el PDF');
  }
},
objetivos: (req, res) => {
  // Más adelante podés inyectar métricas ya calculadas
  res.render('objetivos', {
    // Ejemplos de placeholders para arrancar (opcional):
    kpis: {
      diario: 0,
      semanal: 0,
      mensual: 0,
      anual: 0
    }
  });
},
apiObjetivosCompras: (req, res) => {
  const periodo = (req.query.periodo || 'diario').toLowerCase();
  const tipo    = (req.query.tipo || 'TOTAL').toUpperCase();

  const fechas = {
    desde: req.query.desde || null, // formato 'YYYY-MM-DD'
    hasta: req.query.hasta || null
  };
  if (fechas.desde && !fechas.hasta) fechas.hasta = fechas.desde;

  administracion.obtenerTotalesPeriodoCompras(periodo, fechas, (errT, totales) => {
    if (errT) {
      console.error('[apiObjetivosCompras] Totales:', errT);
      return res.status(500).json({ ok: false, error: 'Error al calcular totales' });
    }
    administracion.obtenerSeriesCompras(periodo, fechas, (errS, series) => {
      if (errS) {
        console.error('[apiObjetivosCompras] Series:', errS);
        return res.status(500).json({ ok: false, error: 'Error al calcular series' });
      }
      const dataSerie = series[tipo] || series.TOTAL;
      const kpi = { totalPeriodo: (totales[tipo] != null ? totales[tipo] : totales.TOTAL) };
      return res.json({
        ok: true,
        periodo, tipo, kpi,
        series: {
          labels: series.etiquetas,
          data: dataSerie,
          A: series.A, B: series.B, TOTAL: series.TOTAL
        },
        totales
      });
    });
  });
},
apiObjetivosVentas: function (req, res) {
  const periodo = (req.query.periodo || 'mensual').toLowerCase();
  const tipo    = (req.query.tipo || 'TOTAL').toUpperCase();
  const fechas  = (req.query.desde && req.query.hasta) ? { desde: req.query.desde, hasta: req.query.hasta } : null;

  try {
    // 1) Totales del período
    administracion.obtenerTotalesPeriodoVentas(periodo, fechas, (errTot, totales) => {
      if (errTot) {
        console.error('[apiObjetivosVentas] Error en totales:', errTot);
        return res.status(500).json({ ok: false, error: 'Error al calcular totales.' });
      }

      // 2) Series
      administracion.obtenerSeriesVentas(periodo, fechas, (errSer, seriesRaw) => {
        if (errSer) {
          console.error('[apiObjetivosVentas] Error en series:', errSer);
          return res.status(500).json({ ok: false, error: 'Error al calcular series.' });
        }

        // Normalizar estructura de respuesta a la de compras
        const labels = (seriesRaw.etiquetas || []);
        const series = {
          labels,
          A: seriesRaw.A || [],
          B: seriesRaw.B || [],
          TOTAL: seriesRaw.TOTAL || []
        };

        // KPI: según tipo pedido
        const kpi = {
          totalPeriodo: (tipo === 'A') ? totales.A
                         : (tipo === 'B') ? totales.B
                         : totales.TOTAL
        };

        res.json({ ok: true, totales, series, kpi });
      });
    });
  } catch (e) {
    console.error('[apiObjetivosVentas] Excepción:', e);
    res.status(500).json({ ok: false, error: 'Error inesperado.' });
  }
},
// ====== GASTOS ======
gastos: (req, res) => {
  const hoy = formatDate(new Date());
  // Traigo últimos 30 días por defecto para mostrar en tabla
  const desde = formatDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  const hasta = hoy;

  administracion.listarGastos(desde, hasta, null, (err, rows) => {
    if (err) {
      console.error("❌ Error al listar gastos:", err);
      return res.status(500).send("Error al listar gastos");
    }
    // Lista base de categorías (rápida)
    const categorias = [
      'luz','agua','gas','municipalidad','rentas provincia',
      'contador','empleados','alquiler','internet','limpieza','seguro','otros'
    ];
    res.render('gastos', { hoy, gastos: rows || [], categorias });
  });
},
postGasto: (req, res) => {
  const data = {
    categoria: (req.body.categoria || '').trim(),
    tipo: req.body.tipo,  // 👉 Agregar este campo para capturar el tipo
    fecha: req.body.fecha,
    monto: parseFloat(req.body.monto || 0) || 0,
    descripcion: (req.body.descripcion || '').trim(),
    administrador: req.body.administrador || (req.user?.nombre || 'admin')
  };

  if (!data.categoria || !data.fecha || !data.monto) {
    return res.status(400).send('Faltan datos obligatorios (categoria, fecha, monto)');
  }

  administracion.insertGasto(data, (err, result) => {
    if (err) {
      console.error("❌ Error al guardar gasto:", err);
      return res.status(500).send("Error al guardar gasto");
    }
    // ... (resto del código)
    res.redirect('/administracion/gastos');
  });
},
eliminarGasto: (req, res) => {
  const id = req.params.id;
  administracion.deleteGasto(id, (err) => {
    if (err) {
      console.error("❌ Error al eliminar gasto:", err);
      return res.status(500).send("Error al eliminar gasto");
    }
    // Redirigir de nuevo a la vista de gastos una vez eliminado
    res.redirect('/administracion/gastos');
  });
},


listarGastos: (req, res) => {
  const { desde, hasta, categoria } = req.query;
  administracion.listarGastos(desde || null, hasta || null, categoria || null, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al obtener gastos' });
    res.json(rows || []);
  });
},
apiObjetivosGastos: (req, res) => {
  const periodo   = (req.query.periodo || 'mensual').toLowerCase();
  const tipo      = (req.query.tipo || 'TOTAL').toUpperCase(); // 'A' | 'B' | 'TOTAL'
  const categoria = (req.query.categoria || '').trim() || null;

  const fechas = { desde: req.query.desde || null, hasta: req.query.hasta || null };
  if (fechas.desde && !fechas.hasta) fechas.hasta = fechas.desde;

  try {
    administracion.obtenerTotalesPeriodoGastos(periodo, fechas, tipo, categoria, (errTot, totales) => {
      if (errTot) {
        console.error('[apiObjetivosGastos] Totales:', errTot);
        return res.status(500).json({ ok: false, error: 'Error al calcular totales.' });
      }

      administracion.obtenerSeriesGastos(periodo, fechas, tipo, categoria, (errSer, series) => {
        if (errSer) {
          console.error('[apiObjetivosGastos] Series:', errSer);
          return res.status(500).json({ ok: false, error: 'Error al calcular series.' });
        }

        return res.json({
          ok: true,
          periodo, tipo, categoria: categoria || 'TODAS',
          totales,   // {A,B,TOTAL} o {A} / {B}
          series     // {etiquetas, A,B,TOTAL} o {etiquetas, A} / {etiquetas, B}
        });
      });
    });
  } catch (e) {
    console.error('[apiObjetivosGastos] Excepción:', e);
    res.status(500).json({ ok: false, error: 'Error inesperado.' });
  }
},
// ===== CATALOGOS =====
getCategorias: (req, res) => {
  administracion.listarCategorias((err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al listar categorías' });
    res.json(rows || []);
  });
},
crearCategoria: (req, res) => {
  const nombre = (req.body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  administracion.crearCategoria(nombre, (err, r) => {
    if (err) return res.status(500).json({ error: 'Error al crear categoría' });
    res.json({ ok: true, id: r.insertId });
  });
},
editarCategoria: (req, res) => {
  const id = req.params.id;
  const nombre = (req.body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  administracion.actualizarCategoria(id, nombre, (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar categoría' });
    res.json({ ok: true });
  });
},
eliminarCategoria: (req, res) => {
  const id = req.params.id;
  administracion.eliminarCategoria(id, (err) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar categoría' });
    res.json({ ok: true });
  });
},

getMarcas: (req, res) => {
  administracion.listarMarcas((err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al listar marcas' });
    res.json(rows || []);
  });
},
crearMarca: (req, res) => {
  const nombre = (req.body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  administracion.crearMarca(nombre, (err, r) => {
    if (err) return res.status(500).json({ error: 'Error al crear marca' });
    res.json({ ok: true, id: r.insertId });
  });
},
editarMarca: (req, res) => {
  const id = req.params.id;
  const nombre = (req.body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  administracion.actualizarMarca(id, nombre, (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar marca' });
    res.json({ ok: true });
  });
},
eliminarMarca: (req, res) => {
  const id = req.params.id;
  administracion.eliminarMarca(id, (err) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar marca' });
    res.json({ ok: true });
  });
},

getModelos: (req, res) => {
  const marcaId = req.query.marca_id || null;
  administracion.listarModelos(marcaId, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al listar modelos' });
    res.json(rows || []);
  });
},
crearModelo: (req, res) => {
  const nombre = (req.body.nombre || '').trim();
  const marca_id = req.body.marca_id;
  if (!nombre || !marca_id) return res.status(400).json({ error: 'Nombre y marca_id requeridos' });
  administracion.crearModelo({ nombre, marca_id }, (err, r) => {
    if (err) return res.status(500).json({ error: 'Error al crear modelo' });
    res.json({ ok: true, id: r.insertId });
  });
},
editarModelo: (req, res) => {
  const id = req.params.id;
  const nombre = (req.body.nombre || '').trim();
  const marca_id = req.body.marca_id;
  if (!nombre || !marca_id) return res.status(400).json({ error: 'Nombre y marca_id requeridos' });
  administracion.actualizarModelo(id, { nombre, marca_id }, (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar modelo' });
    res.json({ ok: true });
  });
},
eliminarModelo: (req, res) => {
  const id = req.params.id;
  administracion.eliminarModelo(id, (err) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar modelo' });
    res.json({ ok: true });
  });
},
// ================== NOTAS DE CRÉDITO ==================
  postNotaCredito: (req, res) => {
  const tiposValidos = ['descuento', 'devolucion_mercaderia', 'diferencia_precio'];
  const ivasValidos  = ['21', '10.5'];

  const tipo = (req.body.tipo || 'descuento').trim();
  const iva  = (req.body.iva  || '21').trim();

  const data = {
    id_proveedor:        Number(req.body.id_proveedor || 0),
    fecha:               req.body.fecha,
    numero_nota_credito: (req.body.numero_nota_credito || '').trim(),
    // numero_factura es opcional: la NC se vincula a facturas en la Carta de Pago
    numero_factura:      (req.body.numero_factura || '').trim() || '-',
    tipo:                tiposValidos.includes(tipo) ? tipo : 'descuento',
    iva:                 ivasValidos.includes(iva)   ? iva  : '21',
    importe_total:       parseFloat(req.body.importe_total || 0) || 0
  };

  if (req.body.id_factura !== undefined && req.body.id_factura !== null && req.body.id_factura !== '') {
    data.id_factura = Number(req.body.id_factura);
  }

  // Solo validamos los campos realmente obligatorios
  if (!data.id_proveedor || !data.fecha || !data.numero_nota_credito) {
    return res.status(400).json({ error: 'Faltan datos obligatorios: proveedor, fecha y número de NC' });
  }
  if (!(data.importe_total > 0)) {
    return res.status(400).json({ error: 'El importe total debe ser mayor a 0' });
  }

  // (opcional) chequeo duplicado
  if (typeof administracion.verificarNotaCreditoDuplicada === 'function') {
    administracion.verificarNotaCreditoDuplicada(
      data.id_proveedor,
      data.fecha,
      data.numero_nota_credito,
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al verificar duplicado' });
        if (rows && rows.length > 0) return res.status(409).json({ error: 'Nota de crédito duplicada' });

        administracion.insertNotaCredito(data, (a, b) => {
          // soporta ambos estilos de callback (por si lo dejaste como en facturas o como en mi snippet)
          const errIns = (a && a.code) ? a : (b && b.code) ? b : null;
          if (errIns) {
            console.error('❌ Error al insertar nota de crédito:', errIns);
            return res.status(500).json({ error: 'Error al crear nota de crédito' });
          }
          const insertId =
            (a && a.insertId) ? a.insertId :
            (b && b.insertId) ? b.insertId :
            (typeof a === 'number') ? a :
            (typeof b === 'number') ? b :
            null;

          return res.json({ message: 'Nota de crédito creada exitosamente', insertId });
        });
      }
    );
  } else {
    administracion.insertNotaCredito(data, (err, info) => {
      if (err) {
        console.error('❌ Error al insertar nota de crédito:', err);
        return res.status(500).json({ error: 'Error al crear nota de crédito' });
      }
      res.json({ message: 'Nota de crédito creada exitosamente', insertId: info?.insertId || null });
    });
  }
},

listarNotasCreditoAPI: (req, res) => {
  const filtros = {
    proveedor: req.query.proveedor || '',
    desde: req.query.desde || null,
    hasta: req.query.hasta || null,
    condicionTipo: req.query.tipo || '',
    condicionIVA: req.query.iva || '',
    numeroNC: req.query.numeroNC || '',
    numeroFactura: req.query.numeroFactura || ''
  };

  const hayFiltros = Object.values(filtros).some(v => v !== null && String(v).trim() !== '');

  const fn = (hayFiltros && typeof administracion.filtrarNotasCredito === 'function')
    ? administracion.filtrarNotasCredito
    : administracion.getNotasCredito;

  if (!fn) return res.status(500).json({ error: 'Modelo de notas de crédito no disponible' });

  if (fn === administracion.filtrarNotasCredito) {
    return fn.call(administracion, filtros, (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al listar notas de crédito' });
      res.json(rows || []);
    });
  }

  fn.call(administracion, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al listar notas de crédito' });
    res.json(rows || []);
  });
},

getNotaCreditoByIdAPI: (req, res) => {
  const id = req.params.id;
  administracion.getNotaCreditoById(id, (err, nota) => {
    if (err) return res.status(500).json({ error: 'Error al buscar nota de crédito' });
    if (!nota) return res.status(404).json({ error: 'Nota de crédito no encontrada' });
    res.json(nota);
  });
},

actualizarNotaCredito: (req, res) => {
  const id = req.params.id;

  const datos = {
    id_proveedor: Number(req.body.id_proveedor || 0),
    fecha: req.body.fecha,
    numero_nota_credito: (req.body.numero_nota_credito || '').trim(),
    numero_factura: (req.body.numero_factura || '').trim(),
    tipo: (req.body.tipo || '').trim(),
    iva: (req.body.iva || '').trim(),
    importe_total: parseFloat(req.body.importe_total || 0) || 0
  };

  if (req.body.id_factura !== undefined) datos.id_factura = req.body.id_factura === '' ? null : Number(req.body.id_factura);

  administracion.updateNotaCreditoById(id, datos, (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar nota de crédito' });
    res.json({ message: 'Nota de crédito actualizada correctamente' });
  });
},

eliminarNotaCredito: (req, res) => {
  const id = req.params.id;
  administracion.deleteNotaCreditoById(id, (err) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar nota de crédito' });
    res.json({ message: 'Nota de crédito eliminada correctamente' });
  });
},

verificarNotaCreditoDuplicadaAPI: (req, res) => {
  const { proveedor, fecha, numero } = req.query;
  if (!proveedor || !fecha || !numero) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  administracion.verificarNotaCreditoDuplicada(proveedor, fecha, numero, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al verificar duplicado' });
    res.json({ existe: (rows || []).length > 0 });
  });
},

// ── API: resumen de compras del período (totales + IVA desglosado por alícuota) ──
// ── API: resumen de compras del período (totales + IVA desglosado por alícuota) ──
resumenComprasPorPeriodo: (req, res) => {
  const { desde, hasta, proveedor, condicion } = req.query;
  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Faltan parámetros: desde y hasta (YYYY-MM-DD)' });
  }

  administracion.getFacturasEntreFechas(desde, hasta, proveedor || null, condicion || null, (err, facturas) => {
    if (err) {
      console.error('❌ [resumenComprasPorPeriodo]', err);
      return res.status(500).json({ error: 'Error al obtener facturas' });
    }

    const porAlicuota = {};
    let totalGeneral = 0, netoGeneral = 0, ivaGeneral = 0;

    (facturas || []).forEach(f => {
      const total   = parseFloat(f.importe_factura || 0);
      const ivaPorc = parseFloat(f.iva || 0);
      const neto    = ivaPorc > 0 ? total / (1 + ivaPorc / 100) : total;
      const iva     = total - neto;
      const key     = String(ivaPorc);

      if (!porAlicuota[key]) porAlicuota[key] = { alicuota: ivaPorc, cant: 0, neto: 0, iva: 0, total: 0 };
      porAlicuota[key].cant  += 1;
      porAlicuota[key].neto  += neto;
      porAlicuota[key].iva   += iva;
      porAlicuota[key].total += total;
      totalGeneral += total;
      netoGeneral  += neto;
      ivaGeneral   += iva;
    });

    const alicuotas = Object.values(porAlicuota).map(a => ({
      alicuota: a.alicuota,
      cant:     a.cant,
      neto:     +a.neto.toFixed(2),
      iva:      +a.iva.toFixed(2),
      total:    +a.total.toFixed(2),
    })).sort((a, b) => b.alicuota - a.alicuota);

    res.json({
      desde, hasta,
      cant_total:    (facturas || []).length,
      neto_total:    +netoGeneral.toFixed(2),
      iva_total:     +ivaGeneral.toFixed(2),
      total_general: +totalGeneral.toFixed(2),
      alicuotas,
    });
  });
},

// ── PDF: resumen de compras del período con IVA desglosado por alícuota ───────
generarResumenComprasPeriodoPDF: (req, res) => {
  const { desde, hasta, proveedor, condicion } = req.query;
  if (!desde || !hasta) {
    return res.status(400).send('Debés especificar fecha desde y hasta');
  }

  administracion.getFacturasEntreFechas(desde, hasta, proveedor || null, condicion || null, (err, facturas) => {
    if (err) {
      console.error('❌ [generarResumenComprasPeriodoPDF]', err);
      return res.status(500).send('Error al generar el PDF');
    }

    const fmtM = n => (+n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // f.fecha puede ser Date (MySQL) o string — formatFechaDMY ya maneja ambos
    const fmtFecha = f => formatFechaDMY(f.fecha);

    const porAlicuota = {};
    let totalGeneral = 0, netoGeneral = 0, ivaGeneral = 0;

    (facturas || []).forEach(f => {
      const total   = parseFloat(f.importe_factura || 0);
      const ivaPorc = parseFloat(f.iva || 0);
      const neto    = ivaPorc > 0 ? total / (1 + ivaPorc / 100) : total;
      const iva     = total - neto;
      const key     = String(ivaPorc);

      if (!porAlicuota[key]) porAlicuota[key] = { alicuota: ivaPorc, cant: 0, neto: 0, iva: 0, total: 0 };
      porAlicuota[key].cant  += 1;
      porAlicuota[key].neto  += neto;
      porAlicuota[key].iva   += iva;
      porAlicuota[key].total += total;
      totalGeneral += total;
      netoGeneral  += neto;
      ivaGeneral   += iva;
    });

    const alicuotas = Object.values(porAlicuota).sort((a, b) => b.alicuota - a.alicuota);

    const genTs = new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Cordoba', dateStyle: 'short', timeStyle: 'medium'
    }).format(new Date());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="COMPRAS_${desde}_${hasta}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    const left  = 40;
    const right = doc.page.width - 40;
    const W     = right - left;

    doc.fillColor('#0B2A6B').font('Helvetica-Bold').fontSize(18)
      .text('AUTOFAROS', left, 40, { width: W });
    doc.fillColor('#000').font('Helvetica').fontSize(9)
      .text('FAWA S.A.S. · Responsable Inscripto', left, 62, { width: W });
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(13)
      .text('RESUMEN DE COMPRAS A PROVEEDORES', left, 80, { width: W });
    doc.fillColor('#444').font('Helvetica').fontSize(9)
      .text(`Período: ${formatFechaDMY(desde)} al ${formatFechaDMY(hasta)}`
        + (condicion ? `  |  Condición: ${condicion.toUpperCase()}` : ''), left, 96, { width: W });
    doc.fillColor('#666').fontSize(8).text(`Generado: ${genTs}`, left, 108, { width: W });
    doc.moveTo(left, 120).lineTo(right, 120).strokeColor('#ccc').lineWidth(0.8).stroke();
    doc.lineWidth(1);
    doc.y = 130;

    if (!facturas || !facturas.length) {
      doc.fillColor('#666').font('Helvetica').fontSize(11)
        .text('Sin compras en el período seleccionado.', left, doc.y + 20);
      doc.end();
      return;
    }

    // Ancho total disponible: right - left = ~515px
    // 7 columnas: Fecha | N°Factura | Proveedor | IVA% | Neto | IVA$ | Total
    const cFecha = left;        const wFecha = 62;   // 62
    const cNum   = left + 62;   const wNum   = 90;   // 152
    const cProv  = left + 152;  const wProv  = 110;  // 262
    const cIvaP  = left + 262;  const wIvaP  = 35;   // 297
    const cNeto  = left + 297;  const wNeto  = 72;   // 369
    const cIva   = left + 369;  const wIva   = 68;   // 437
    const cTotal = left + 437;  const wTotal = right - (left + 437); // ~78

    const drawTableHeader = () => {
      const y = doc.y;
      doc.rect(left, y, W, 14).fillColor('#e8edf5').fill();
      doc.fillColor('#1a2a4a').font('Helvetica-Bold').fontSize(7);
      doc.text('Fecha',      cFecha, y+3, { width: wFecha });
      doc.text('N° Factura', cNum,   y+3, { width: wNum   });
      doc.text('Proveedor',  cProv,  y+3, { width: wProv  });
      doc.text('IVA%',       cIvaP,  y+3, { width: wIvaP, align: 'center' });
      doc.text('Neto',       cNeto,  y+3, { width: wNeto, align: 'right' });
      doc.text('IVA $',      cIva,   y+3, { width: wIva,  align: 'right' });
      doc.text('Total',      cTotal, y+3, { width: wTotal,align: 'right' });
      doc.y = y + 17;
    };

    const ensureRoom = (extra = 16) => {
      if (doc.y + extra > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        doc.fillColor('#0B2A6B').font('Helvetica-Bold').fontSize(10)
          .text('AUTOFAROS — Compras (continuación)', left, 40, { width: W });
        doc.y = 58;
        drawTableHeader();
      }
    };

    drawTableHeader();

    let even = false;
    facturas.forEach(f => {
      ensureRoom(16);
      const y      = doc.y;
      const rowH   = 14;
      const total  = parseFloat(f.importe_factura || 0);
      const ivaPorc = parseFloat(f.iva || 0);
      const neto   = ivaPorc > 0 ? total / (1 + ivaPorc / 100) : total;
      const iva    = total - neto;

      if (even) doc.rect(left, y, W, rowH).fillColor('#f7f9fc').fill();
      even = !even;

      doc.fillColor('#000').font('Helvetica').fontSize(7);
      doc.text(fmtFecha(f),                              cFecha, y+3, { width: wFecha });
      doc.text(String(f.numero_factura || '-'),           cNum,   y+3, { width: wNum   });
      doc.text(String(f.proveedor || '-'),                cProv,  y+3, { width: wProv  });
      doc.text(ivaPorc ? `${ivaPorc}%` : '-',            cIvaP,  y+3, { width: wIvaP, align: 'center' });
      doc.text(`$ ${fmtM(neto)}`,                        cNeto,  y+3, { width: wNeto, align: 'right' });
      doc.fillColor('#92400e').font('Helvetica-Bold')
        .text(`$ ${fmtM(iva)}`,                          cIva,   y+3, { width: wIva,  align: 'right' });
      doc.fillColor('#000').font('Helvetica')
        .text(`$ ${fmtM(total)}`,                        cTotal, y+3, { width: wTotal, align: 'right' });

      doc.moveTo(left, y+rowH).lineTo(right, y+rowH).strokeColor('#e8edf5').lineWidth(0.3).stroke();
      doc.lineWidth(1);
      doc.y = y + rowH + 1;
    });

    // Fila TOTAL
    ensureRoom(100);
    doc.moveDown(0.4);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#aaa').lineWidth(0.8).stroke();
    doc.lineWidth(1);
    const ty = doc.y + 4, totH = 16;
    doc.rect(left, ty, W, totH).fillColor('#dce3ef').fill();
    doc.fillColor('#1a2a4a').font('Helvetica-Bold').fontSize(7);
    doc.text(`TOTAL — ${facturas.length} comprobante${facturas.length !== 1 ? 's' : ''}`,
      cFecha, ty+4, { width: wFecha + wNum + wProv + wIvaP });
    doc.text(`$ ${fmtM(netoGeneral)}`,  cNeto,  ty+4, { width: wNeto, align: 'right' });
    doc.fillColor('#92400e')
      .text(`$ ${fmtM(ivaGeneral)}`,    cIva,   ty+4, { width: wIva,  align: 'right' });
    doc.fillColor('#1a2a4a')
      .text(`$ ${fmtM(totalGeneral)}`,  cTotal, ty+4, { width: wTotal,align: 'right' });
    doc.y = ty + totH + 20;

    // Cuadro IVA por alícuota
    ensureRoom(40 + alicuotas.length * 20 + 50);
    const bx = left, bw = W, lineH = 18;
    const boxH = 14 + lineH + (alicuotas.length * lineH) + 14 + lineH + 8;
    const by   = doc.y;
    doc.rect(bx, by, bw, boxH).fillColor('#fffbeb').fill();
    doc.rect(bx, by, bw, boxH).strokeColor('#f59e0b').lineWidth(0.8).stroke();
    doc.lineWidth(1);

    let ly = by + 12;
    doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(10)
      .text('RESUMEN DE IVA — COMPRAS DEL PERÍODO', bx + 14, ly, { width: bw - 28 });
    ly += lineH;
    doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(8);
    doc.text('Alícuota',  bx + 14,  ly, { width: 80 });
    doc.text('Facturas',  bx + 100, ly, { width: 60,  align: 'center' });
    doc.text('Base Neta', bx + 180, ly, { width: 110, align: 'right' });
    doc.text('IVA $',     bx + 300, ly, { width: 100, align: 'right' });
    doc.text('Total',     bx + 410, ly, { width: bw - 424, align: 'right' });
    ly += 12;
    doc.moveTo(bx+14, ly).lineTo(bx+bw-14, ly).strokeColor('#f59e0b').lineWidth(0.4).stroke();
    doc.lineWidth(1);
    ly += 4;

    alicuotas.forEach(a => {
      doc.fillColor('#333').font('Helvetica').fontSize(9)
        .text(`IVA ${a.alicuota}%`,  bx + 14,  ly, { width: 80 });
      doc.text(String(a.cant),        bx + 100, ly, { width: 60,  align: 'center' });
      doc.text(`$ ${fmtM(a.neto)}`,  bx + 180, ly, { width: 110, align: 'right' });
      doc.fillColor('#92400e').font('Helvetica-Bold')
        .text(`$ ${fmtM(a.iva)}`,    bx + 300, ly, { width: 100, align: 'right' });
      doc.fillColor('#333').font('Helvetica')
        .text(`$ ${fmtM(a.total)}`,  bx + 410, ly, { width: bw - 424, align: 'right' });
      ly += lineH;
    });

    doc.moveTo(bx+14, ly-2).lineTo(bx+bw-14, ly-2).strokeColor('#f59e0b').lineWidth(0.5).stroke();
    doc.lineWidth(1);
    ly += 4;
    doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(10)
      .text('IVA TOTAL A CONSIDERAR:', bx + 14, ly, { width: bw * 0.55 });
    doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(11)
      .text(`$ ${fmtM(ivaGeneral)}`, bx + 14, ly, { width: bw - 28, align: 'right' });
    doc.y = by + boxH + 16;

    doc.fillColor('#000').font('Helvetica').fontSize(9)
      .text(`Base neta total: $ ${fmtM(netoGeneral)}`, left, doc.y, { width: W, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(12)
      .text(`TOTAL COMPRADO: $ ${fmtM(totalGeneral)}`, left, doc.y + 4, { width: W, align: 'right' });

    doc.end();
  });
},


}