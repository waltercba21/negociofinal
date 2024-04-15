const conexion = require('../config/conexion')
const pool = require('../config/conexion');
const PDFDocument = require('pdfkit');
const streamBuffers = require('stream-buffers');
const administracion = require('../models/administracion')
var borrar = require('fs');
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
        res.render('administracion');
    },
    facturas: (req, res) => {
        administracion.getProveedores(function(proveedores) {
            res.render('facturas', { proveedores: proveedores });
        });
    },
    postFactura: function(req, res) {
        let nuevaFactura = {
            id_proveedor: req.body.id_proveedor,
            fecha: req.body.fecha,
            numero_factura: req.body.numero_factura,
            fecha_pago: req.body.fecha_pago,
            importe: req.body.importe,
            condicion: req.body.condicion,
            comprobante_pago: req.file.filename
        };
        administracion.insertFactura(nuevaFactura, function() {
            res.redirect('/administracion/facturas');
        });
    },
    listadoFacturas : function(req, res) {
        administracion.getFacturas(function(facturas) {
            administracion.getProveedores(function(proveedores) {
                res.render('listadoFacturas', { 
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
            });
        });
    },
    apiFacturas: function(req, res) {
        let filtro = {
            id_proveedor: req.body.proveedor,
            fecha: req.body.fechaFactura,
            fecha_pago: req.body.fechaPago,
            condicion: req.body.condicion
        };
        administracion.getFacturasFiltradas(filtro, function(facturas) {
            res.json(facturas);
        });
    },
    presupuestos: (req, res) => {
        res.render('presupuestos');
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
    
                administracion.getProveedores(function(proveedores) {
                    res.render('modificarFactura', { factura: factura, proveedores: proveedores });
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
    postModificarFactura: function(req, res) {
        let id = req.params.id;
        administracion.getFacturaById(id, function(err, facturaActual) {
            if (err) {
                console.error(err);
                res.status(500).send('Error al obtener la factura');
            } else {
                let facturaModificada = {
                    id_proveedor: req.body.id_proveedor,
                    fecha: req.body.fecha,
                    numero_factura: req.body.numero_factura,
                    fecha_pago: req.body.fecha_pago,
                    importe: req.body.importe,
                    condicion: req.body.condicion,
                    comprobante_pago: req.file ? req.file.filename : facturaActual.comprobante_pago
                };
                administracion.updateFacturaById(id, facturaModificada, function() {
                    res.redirect('/administracion/listadoFacturas');
                });
            }
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
generarPDF: function (req, res) {
    var doc = new PDFDocument;
    var buffer = new streamBuffers.WritableStreamBuffer({
        initialSize: (1024 * 1024),   
        incrementAmount: (1024 * 1024) 
    });
    doc.pipe(buffer);

    const proveedorId = req.query.proveedor; 
    if (!proveedorId) {
        return res.status(400).send('No se ha proporcionado un ID de proveedor');
    }

    factura.obtenerProveedores(conexion, function(error, proveedores) {
        if (error) { 
            console.log('Error al obtener proveedores:', error);
            return res.status(500).send('Error al generar el PDF');
        }

        var proveedor = proveedores.find(p => p.id == proveedorId);
        if (!proveedor) {
            return res.status(400).send('Proveedor no encontrado');
        }

        var nombreProveedor = proveedor.nombre;

        doc.fontSize(20)
           .text(nombreProveedor, 0, 50, {
               align: 'center',
               width: doc.page.width
           });

        factura.obtenerFacturasPorProveedor(conexion, proveedorId, function(error, facturas) {
            if (error) {
                console.log('Error al obtener facturas:', error);
                return res.status(500).send('Error al generar el PDF');
            }

            facturas.forEach(factura => {
                var importeFormateado = '$' + parseFloat(factura.importe).toFixed(2);
                var currentY = doc.y;
                if (currentY + 20 > doc.page.height - doc.page.margins.bottom) {
                    doc.addPage();
                }
                doc.fontSize(10)
                   .text(factura.id, 50, doc.y);
                doc.text(factura.fecha, doc.page.width - 150, doc.y, {
                       align: 'right'
                   });
                doc.text(factura.numero_factura, doc.page.width - 150, doc.y, {
                       align: 'right'
                   });
                doc.text(factura.fecha_pago, doc.page.width - 150, doc.y, {
                       align: 'right'
                   });
                doc.text(importeFormateado, doc.page.width - 150, doc.y, {
                       align: 'right'
                   });
                doc.text(factura.condicion, doc.page.width - 150, doc.y, {
                       align: 'right'
                   });
                doc.moveDown();
            });

            doc.end();
        });
    });

    buffer.on('finish', function() {
        const pdfData = buffer.getContents();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=facturas.pdf');
        res.send(pdfData);
    });
}
}