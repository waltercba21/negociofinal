module.exports ={
    obtener : function(conexion,funcion){
        conexion.query('SELECT * FROM productos',funcion);
    },
    insertar: function(conexion,datos,archivos,funcion){
     conexion.query
     ('INSERT INTO productos (nombre,codigo,imagen,descripcion,proveedor,precio,categoria) VALUES (?,?,?,?,?,?,?)',
     [datos.nombre,datos.codigo,archivos.filename,datos.descripcion,datos.proveedor,datos.precio,datos.categoria],funcion);
    },
    retornarDatosId: function (conexion,id,funcion){
        conexion.query('SELECT * FROM productos WHERE id = ? ',[id],funcion);
    },
    borrar: function (conexion,id,funcion){ 
        conexion.query('DELETE FROM productos WHERE id=?', [id],funcion)
    },
    actualizar: function (conexion, datos, funcion) {
        conexion.query("UPDATE productos SET nombre=?,codigo=?, descripcion=?, precio=?, proveedor=?, categoria=? WHERE id=?",
        [datos.nombre,datos.codigo,datos.descripcion,datos.precio,datos.proveedor,datos.categoria, datos.id], funcion);
      },    
    actualizarArchivo: function(conexion,datos,archivo,funcion){
        
        conexion.query('UPDATE productos SET imagen=? WHERE id =?',[archivo.filename, datos.id ],funcion);
    },
    obtenerPorCategoria: function (conexion, categoria, funcion) {
      conexion.query('SELECT * FROM productos WHERE categoria = ?', [categoria], funcion);
  },
    obtenerPorNombre: function (conexion, nombre, funcion) {
        conexion.query('SELECT * FROM productos WHERE nombre LIKE ?', [`%${nombre}%`], funcion);
      },
      obtenerCarrito: function (conexion, usuarioId, funcion) {
        const query = `
            SELECT carritos.*, productos.nombre AS nombre
            FROM carritos 
            JOIN productos ON carritos.producto_id = producto.id 
            WHERE carritos.usuario_id = ?
        `;
        conexion.query(query, [usuarioId], funcion);
    },
      obtenerTodos: function (conexion, funcion) {
        conexion.query('SELECT * FROM productos', funcion);
    },
      agregarAlCarrito: function (usuarioId, productoId, cantidad, imagen, callback) {
        const query = "INSERT INTO carritos (usuario_id, producto_id, cantidad, imagen) VALUES ( ?, ?, ?, ?)";
        const values = [usuarioId, productoId, cantidad, imagen];
      
        conexion.query(query, values, function (error, resultados) {
          if (error) {
            return callback(error, null);
          }
      
          return callback(null, resultados);
        });
      },
    
      eliminarDelCarrito: function (usuarioId, productoId, callback) {
        const query = "DELETE FROM carritos WHERE usuario_id = ? AND producto_id = ?";
        const values = [usuarioId, productoId];
    
        conexion.query(query, values, function (error, resultados) {
          if (error) {
            return callback(error, null);
          }
    
          return callback(null, resultados);
        });
      },
      obtenerProductosPorProveedor: function (conexion, proveedor, callback) {
        const query = 'SELECT * FROM productos WHERE proveedor = ?';
        conexion.query(query, [proveedor], function (error, resultados) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, resultados);
            }
        });
    },
    actualizarPreciosPorProveedor: function (conexion, proveedor, porcentajeAumento, callback) {
      const query = 'UPDATE productos SET precio = precio + precio * ? WHERE proveedor = ?';
      conexion.query(query, [porcentajeAumento, proveedor], function (error, resultados) {
          if (error) {
              callback(error, null);
          } else {
              callback(null, resultados);
          }
      });
  },
}