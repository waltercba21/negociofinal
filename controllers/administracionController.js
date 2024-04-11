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
    presupuestos: (req, res) => {
        res.render('presupuestos');
    }
}