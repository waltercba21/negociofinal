const pool = require('../config/conexion');
const conexion = require('../config/conexion')

module.exports ={
    getProveedores : function(callback) {
        pool.query(`
          SELECT p.*, d.descuento 
          FROM proveedores p 
          LEFT JOIN descuentos_proveedor d ON d.proveedor_id = p.id
        `, function(error, results) {
          if (error) throw error;
          callback(null, results);
        });
      },
      
    insertFactura: function (factura, callback) {
        pool.query('INSERT INTO facturas SET ?', factura, function (error, results) {
            if (error) {
                console.error("❌ Error al insertar la factura:", error);
                return callback(null, error);
            }
            if (!results.insertId) {
                console.error("⚠️ La consulta de inserción no devolvió insertId.");
                return callback(null, new Error("Factura no insertada correctamente."));
            }
            console.log("✅ Factura insertada con ID:", results.insertId);
            callback(results.insertId, null);
        });
    },
    

    insertarItemFactura: function(itemFactura, callback) {
        console.log("📦 Insertando item en la factura:", itemFactura); 
        pool.query('INSERT INTO facturas_admin_items SET ?', itemFactura, function(error, results) {
            if (error) {
                console.error("❌ Error al insertar item en la base de datos:", error);
                return callback(error, null); // Devolvemos error en callback
            }
            console.log("✅ Item insertado correctamente con ID:", results.insertId);
            if (callback) callback(null, results); // Devuelve los resultados
        });
    },
    
    
    actualizarStockProducto: function(productoID, cantidad, callback) {
        if (!productoID || !cantidad) {
            return callback(new Error("El productoID y la cantidad son obligatorios"));
        }
    
        pool.query(
            'UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?',
            [cantidad, productoID],
            function(error, results) {
                if (error) {
                    console.error("Error al actualizar el stock:", error);
                    return callback(error);
                }
                if (results.affectedRows === 0) {
                    return callback(new Error("No se pudo actualizar el stock: producto no encontrado"));
                }
                callback(null, results);  // La actualización fue exitosa
            }
        );
    },
    
    getFacturas : function(callback) {
        pool.query('SELECT facturas.*, proveedores.nombre AS nombre_proveedor FROM facturas LEFT JOIN proveedores ON facturas.id_proveedor = proveedores.id', function(error, results) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, results);
            }
        });
    },
    getFacturasFiltradas : function(filtro, callback) {
        let query = 'SELECT facturas.*, proveedores.nombre AS nombre_proveedor FROM facturas LEFT JOIN proveedores ON facturas.id_proveedor = proveedores.id WHERE 1=1';
        if (filtro.id_proveedor && filtro.id_proveedor !== 'null') {
            query += ' AND facturas.id_proveedor = ' + pool.escape(filtro.id_proveedor);
        }
        if (filtro.fecha && filtro.fecha !== 'null') {
            let parts = filtro.fecha.split('-');
            let fecha = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
            let fechaFormateada = fecha.toISOString().split('T')[0];
            query += ' AND DATE(facturas.fecha) = ' + pool.escape(fechaFormateada);
        }
        if (filtro.fecha_pago && filtro.fecha_pago !== 'null') {
            let parts = filtro.fecha_pago.split('-');
            let fechaPago = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
            let fechaPagoFormateada = fechaPago.toISOString().split('T')[0];
            query += ' AND DATE(facturas.fecha_pago) = ' + pool.escape(fechaPagoFormateada);
        }
        if (filtro.condicion && filtro.condicion !== 'null') {
            query += ' AND facturas.condicion = ' + pool.escape(filtro.condicion);
        }
        if (filtro.fechaDesde && filtro.fechaDesde !== 'null') {
            let parts = filtro.fechaDesde.split('-');
            let fechaDesde = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
            let fechaDesdeFormateada = fechaDesde.toISOString().split('T')[0];
            query += ' AND DATE(facturas.fecha) >= ' + pool.escape(fechaDesdeFormateada);
        }
        if (filtro.fechaHasta && filtro.fechaHasta !== 'null') {
            let parts = filtro.fechaHasta.split('-');
            let fechaHasta = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
            let fechaHastaFormateada = fechaHasta.toISOString().split('T')[0];
            query += ' AND DATE(facturas.fecha) <= ' + pool.escape(fechaHastaFormateada);
        }
        pool.query(query, function(error, results) {
            if (error) throw error;
            callback(results);
        });
    },
    getFacturaById: function(id, callback) {
        const query = `
            SELECT facturas.*, proveedores.nombre AS nombre_proveedor 
            FROM facturas 
            LEFT JOIN proveedores ON facturas.id_proveedor = proveedores.id 
            WHERE facturas.id = ?
        `;
        pool.query(query, [id], function(error, results) {
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
    getProveedorById : function(idProveedor, callback) {
        pool.query(`
          SELECT p.*, d.descuento 
          FROM proveedores p 
          LEFT JOIN descuentos_proveedor d ON d.proveedor_id = p.id
          WHERE p.id = ?
        `, [idProveedor], function(error, results) {
          if (error) return callback(error, null);
          if (!results.length) return callback(null, null);
          callback(null, results[0]);
        });
      },
    getFacturasByProveedorId : function(idProveedor, callback) {
        pool.query('SELECT * FROM facturas WHERE id_proveedor = ?', [idProveedor], function(error, results) {
            if (error) throw error;
            callback(null, results);
        });
    },
    getProductosByFacturaId: function(facturaID, callback) {
        const query = `
            SELECT fai.*, prod.nombre AS nombre_producto 
            FROM facturas_admin_items fai
            JOIN productos prod ON fai.producto_id = prod.id 
            WHERE fai.factura_id = ?
        `;
        pool.query(query, [facturaID], function(error, results) {
            if (error) throw error;
            callback(null, results);
        });
    },
    insertProveedor: (data, callback) => {
        pool.query('INSERT INTO proveedores SET ?', data, (err, result) => {
          if (err) return callback(err);
          callback(null, result);
        });
      },
      
      updateProveedor: (id, data, callback) => {
        pool.query('UPDATE proveedores SET ? WHERE id = ?', [data, id], (err, result) => {
          if (err) return callback(err);
          callback(null, result);
        });
      },
      
      deleteProveedor: (id, callback) => {
        pool.query('DELETE FROM proveedores WHERE id = ?', [id], (err, result) => {
          if (err) return callback(err);
          callback(null, result);
        });
      }
      
}