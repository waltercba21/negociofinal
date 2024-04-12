const conexion = require('../config/conexion')
const pool = require('../config/conexion');
const administracion = require('../models/administracion')
var borrar = require('fs');

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
            comprobante_pago: req.file.path
        };
        administracion.insertFactura(nuevaFactura, function() {
            res.redirect('/administracion/facturas');
        });
    },
    listadoFacturas : function(req, res) {
        administracion.getFacturas(function(facturas) {
            res.render('listadoFacturas', { facturas: facturas });
        });
    },
    presupuestos: (req, res) => {
        res.render('presupuestos');
    }
}