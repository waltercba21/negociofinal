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
                res.render('facturasAdministracion', { proveedores: proveedores });
            }
        });
    },
    postFactura: async function (req, res) {
        console.log("Datos recibidos en req.body:", req.body);
    
        let nuevaFactura = {
            id_proveedor: req.body.id_proveedor,
            fecha: req.body.fecha,
            numero_factura: req.body.numero_factura,
            fecha_pago: req.body.fecha_pago,
            importe: req.body.importe,
            condicion: req.body.condicion,
            comprobante_pago: req.file ? req.file.filename : null
        };
    
        let productosFactura = [];
        if (req.body.invoiceItems) {
            try {
                productosFactura = JSON.parse(req.body.invoiceItems);
                console.log("Cantidad de productos recibidos:", productosFactura.length);
            } catch (error) {
                console.error("Error al parsear productos:", error);
                return res.status(400).json({ message: 'Datos de productos inválidos' });
            }
        } else {
            return res.status(400).json({ message: 'No se enviaron productos' });
        }
    
        try {
            // Insertamos la factura y obtenemos su ID
            let facturaID = await new Promise((resolve, reject) => {
                administracion.insertFactura(nuevaFactura, function (id) {
                    if (id) {
                        resolve(id);
                    } else {
                        reject(new Error("Error al insertar factura"));
                    }
                });
            });
    
            console.log("Factura creada con ID:", facturaID);
    
            // Iteramos sobre los productos de manera asíncrona
            for (let item of productosFactura) {
                if (item.id && item.cantidad) {
                    let itemFactura = {
                        factura_id: facturaID,
                        producto_id: item.id,
                        cantidad: item.cantidad
                    };
                    console.log("Item para insertar en la factura:", itemFactura);
    
                    // Insertamos el ítem en la factura
                    await new Promise((resolve, reject) => {
                        administracion.insertarItemFactura(itemFactura, function (error) {
                            if (error) reject(error);
                            else resolve();
                        });
                    });
    
                    // Actualizamos el stock del producto
                    await new Promise((resolve, reject) => {
                        administracion.actualizarStockProducto(item.id, item.cantidad, function (error) {
                            if (error) reject(error);
                            else resolve();
                        });
                    });
    
                } else {
                    console.error("Item de factura inválido:", item);
                    return res.status(400).json({ message: 'Item de factura inválido' });
                }
            }
    
            res.json({
                message: 'Factura guardada exitosamente',
                facturaID: facturaID
            });
    
        } catch (error) {
            console.error("Error en la inserción de la factura:", error);
            res.status(500).json({ message: 'Error interno del servidor' });
        }
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
    apiFacturas: function(req, res) {
        let filtro = {
            id_proveedor: req.body.proveedor,
            fecha: req.body.fechaFactura,
            fecha_pago: req.body.fechaPago,
            condicion: req.body.condicion,
            fechaDesde: req.body.fechaDesde,
            fechaHasta: req.body.fechaHasta
        };
    
        // Convertir las fechas al formato yyyy-mm-dd
        for (let key in filtro) {
            if (filtro[key] && key.includes('fecha')) {
                let date = new Date(filtro[key]);
                let day = String(date.getDate()).padStart(2, '0');
                let month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses son 0-indexados, así que añadimos 1
                let year = date.getFullYear();
                filtro[key] = `${year}-${month}-${day}`;
            }
        }
    
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
}