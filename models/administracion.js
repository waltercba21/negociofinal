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
    }
}