module.exports ={
    getProveedores : function(callback) {
        pool.query('SELECT id, nombre FROM proveedores', function(error, results) {
            if (error) throw error;
            callback(results);
        });
    },
}