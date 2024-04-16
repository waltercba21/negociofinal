const administracion = require('../models/administracion')
var pdfmake = require('pdfmake');
var fonts = {
    Roboto: {
        normal: 'node_modules/roboto-font/fonts/Roboto/roboto-regular-webfont.ttf',
        bold: 'node_modules/roboto-font/fonts/Roboto/roboto-bold-webfont.ttf',
        italics: 'node_modules/roboto-font/fonts/Roboto/roboto-italic-webfont.ttf',
        bolditalics: 'node_modules/roboto-font/fonts/Roboto/roboto-bolditalic-webfont.ttf'
    }
};
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
        administracion.getProveedores(function(error, proveedores) {
            if (error) {
                console.error(error);
                res.status(500).send('Error al obtener los proveedores');
            } else {
                res.render('facturas', { proveedores: proveedores });
            }
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
                    }
                });
            }
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
    generarPDFProveedor : function(req, res) {
        var printer = new pdfmake(fonts);
        var idProveedor = req.params.id;
    
        // Obtén las facturas del proveedor
        administracion.getFacturasByProveedorId(idProveedor, function(error, facturas) {
            if (error) throw error;
    
            var docDefinition = {
                content: [
                    'Listado de facturas del proveedor ' + idProveedor,
                    {
                        table: {
                            body: [
                                ['ID', 'Fecha', 'Número de Factura', 'Fecha de Pago', 'Importe', 'Condición'],
                                ...facturas.map(factura => [factura.id, factura.fecha, factura.numero_factura, factura.fecha_pago, factura.importe, factura.condicion])
                            ]
                        }
                    }
                ]
            };
    
            var pdfDoc = printer.createPdfKitDocument(docDefinition);
            pdfDoc.pipe(res);
            pdfDoc.end();
        })
},
}