const pool = require('../config/conexion');
const conexion = require('../config/conexion')

module.exports ={
    getProveedores : function(callback) {
        pool.query('SELECT id, nombre FROM proveedores', function(error, results) {
            if (error) throw error;
            callback(results);
        });
    },
    insertFactura : function(factura, callback) {
        pool.query('INSERT INTO facturas SET ?', factura, function(error, results) {
            if (error) throw error;
            callback(results);
        });
    },
}