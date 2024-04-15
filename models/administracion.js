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
    getFacturas : function(callback) {
        pool.query('SELECT facturas.*, proveedores.nombre AS nombre_proveedor FROM facturas LEFT JOIN proveedores ON facturas.id_proveedor = proveedores.id', function(error, results) {
            if (error) throw error;
            callback(results);
        });
    },
    getFacturasFiltradas : function(filtro, callback) {
        let query = 'SELECT facturas.*, proveedores.nombre AS nombre_proveedor FROM facturas LEFT JOIN proveedores ON facturas.id_proveedor = proveedores.id WHERE 1=1';
        if (filtro.id_proveedor && filtro.id_proveedor !== 'null') {
            query += ' AND facturas.id_proveedor = ' + pool.escape(filtro.id_proveedor);
        }
        if (filtro.fecha && filtro.fecha !== 'null') {
            let fecha = new Date(filtro.fecha);
            let fechaFormateada = fecha.toISOString().split('T')[0];
            query += ' AND DATE(facturas.fecha) = ' + pool.escape(fechaFormateada);
        }
        if (filtro.fecha_pago && filtro.fecha_pago !== 'null') {
            let fechaPago = new Date(filtro.fecha_pago);
            let fechaPagoFormateada = fechaPago.toISOString().split('T')[0];
            query += ' AND DATE(facturas.fecha_pago) = ' + pool.escape(fechaPagoFormateada);
        }
        if (filtro.condicion && filtro.condicion !== 'null') {
            query += ' AND facturas.condicion = ' + pool.escape(filtro.condicion);
        }
        pool.query(query, function(error, results) {
            if (error) throw error;
            callback(results);
        });
    },
    getFacturaById : function(id, callback) {
        pool.query('SELECT * FROM facturas WHERE id = ?', [id], function(error, results) {
            if (error) throw error;
            if (results.length > 0) {
                callback(null, results[0]);
            } else {
                callback(new Error('No se encontró ninguna factura con el id ' + id));
            }
        });
    },
    deleteFacturaById : function(id, callback) {
        pool.query('DELETE FROM facturas WHERE id = ?', [id], function(error, results) {
            if (error) throw error;
            callback(null, results);
        });
    },
    updateFacturaById : function(id, factura, callback) {
        pool.query('UPDATE facturas SET ? WHERE id = ?', [factura, id], function(error, results) {
            if (error) throw error;
            callback(results);
        });
    },
}