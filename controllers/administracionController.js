const administracion = require('../models/administracion')
const path = require('path');
const PdfPrinter = require('pdfmake');

const fonts = {
  Roboto: {
    normal: path.join(__dirname, '../node_modules/pdfmake/fonts/Roboto-Regular.ttf'),
    bold: path.join(__dirname, '../node_modules/pdfmake/fonts/Roboto-Medium.ttf'),
    italics: path.join(__dirname, '../node_modules/pdfmake/fonts/Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, '../node_modules/pdfmake/fonts/Roboto-MediumItalic.ttf')
  }
};

const printer = new PdfPrinter(fonts);
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

    const docDefinition = {
      content: [
        { text: tipo.toUpperCase(), style: 'header' },
        { text: `Proveedor: ${data.nombre_proveedor}` },
        { text: `Número: ${tipo === 'factura' ? data.numero_factura : data.numero_presupuesto}` },
        { text: `Fecha: ${new Date(data.fecha).toLocaleDateString()}` },
        { text: `Vencimiento: ${new Date(data.fecha_pago).toLocaleDateString()}` },
        { text: `Administrador: ${data.administrador}` },
        { text: `Condición: ${data.condicion}` },
        tipo === 'factura' ? [
          { text: `Importe Bruto: $${data.importe_bruto}` },
          { text: `IVA: ${data.iva}%` },
          { text: `Total: $${data.importe_factura}` }
        ] : [
          { text: `Importe Total: $${data.importe}` }
        ],
        { text: ' ' },
        { text: 'Productos Asociados', style: 'subheader' },
        productos.length > 0 ? {
          table: {
            widths: ['*', 'auto'],
            body: [
              ['Producto', 'Cantidad'],
              ...productos.map(p => [p.nombre, p.cantidad])
            ]
          }
        } : { text: 'Comprobante sin productos.' }
      ],
      styles: {
        header: { fontSize: 16, bold: true },
        subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error('❌ Error al generar PDF individual:', error);
    res.status(500).send('Error al generar el PDF');
  }
},
generarResumenPresupuestosPDF : (req, res) => {
  const { desde, hasta } = req.query;
  console.log(`📊 Generar resumen presupuestos: desde=${desde}, hasta=${hasta}`);

  if (!desde || !hasta) {
    console.warn('❗ Rango de fechas incompleto en resumen presupuestos');
    return res.status(400).send('Debe especificar fecha desde y hasta');
  }

  const printer = new PdfPrinter(fonts);

  administracion.getPresupuestosEntreFechas(desde, hasta, (err, rows) => {
    if (err) {
      console.error('❌ Error al obtener presupuestos:', err);
      return res.status(500).send('Error al generar el resumen de presupuestos');
    }

    console.log(`✅ ${rows.length} presupuestos encontrados`);

    let total = 0;
    const body = [['Fecha', 'Número', 'Proveedor', 'Condición', 'Importe']];

    rows.forEach(row => {
      body.push([
        new Date(row.fecha).toLocaleDateString(),
        row.numero_presupuesto,
        row.proveedor,
        row.condicion,
        `$${row.importe}`
      ]);
      total += parseFloat(row.importe);
    });

    body.push([
      { text: 'Total Presupuestado:', colSpan: 4, alignment: 'right', bold: true }, {}, {}, {},
      { text: `$${total.toFixed(2)}`, bold: true }
    ]);

    const docDefinition = {
      content: [
        { text: 'Resumen de Presupuestos', style: 'header' },
        { text: `Desde: ${desde} - Hasta: ${hasta}`, margin: [0, 5, 0, 10] },
        {
          table: { widths: ['auto', 'auto', '*', 'auto', 'auto'], body },
          layout: 'lightHorizontalLines'
        }
      ],
      styles: {
        header: { fontSize: 16, bold: true }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(res);
    pdfDoc.end();
  });
},
generarResumenFacturasPDF : (req, res) => {
  const { desde, hasta } = req.query;
  console.log(`📊 Generar resumen facturas: desde=${desde}, hasta=${hasta}`);

  if (!desde || !hasta) {
    console.warn('❗ Rango de fechas incompleto en resumen facturas');
    return res.status(400).send('Debe especificar fecha desde y hasta');
  }

  const printer = new PdfPrinter(fonts);

  administracion.getFacturasEntreFechas(desde, hasta, (err, rows) => {
    if (err) {
      console.error('❌ Error al obtener facturas:', err);
      return res.status(500).send('Error al generar el resumen');
    }

    console.log(`✅ ${rows.length} facturas encontradas`);

    let total = 0;
    const body = [['Fecha', 'Número', 'Proveedor', 'Condición', 'Importe']];

    rows.forEach(row => {
      body.push([
        new Date(row.fecha).toLocaleDateString(),
        row.numero_factura,
        row.proveedor,
        row.condicion,
        `$${row.importe_factura}`
      ]);
      total += parseFloat(row.importe_factura);
    });

    body.push([
      { text: 'Total Compras:', colSpan: 4, alignment: 'right', bold: true }, {}, {}, {},
      { text: `$${total.toFixed(2)}`, bold: true }
    ]);

    const docDefinition = {
      content: [
        { text: 'Resumen de Facturas', style: 'header' },
        { text: `Desde: ${desde} - Hasta: ${hasta}`, margin: [0, 5, 0, 10] },
        {
          table: { widths: ['auto', 'auto', '*', 'auto', 'auto'], body },
          layout: 'lightHorizontalLines'
        }
      ],
      styles: {
        header: { fontSize: 16, bold: true }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(res);
    pdfDoc.end();
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

      
}