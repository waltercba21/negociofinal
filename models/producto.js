module.exports ={
    obtener : function(conexion,funcion){
        conexion.query('SELECT * FROM productos',funcion);
    },
    insertar: function(conexion,datos,archivos,funcion){
     conexion.query
     ('INSERT INTO productos (nombre,imagen,descripcion,proveedor,precio,categoria) VALUES (?,?,?,?,?,?)',
     [datos.nombre,archivos.filename,datos.descripcion,datos.proveedor,datos.precio,datos.categoria],funcion);
    },
    retornarDatosId: function (conexion,id,funcion){
        conexion.query('SELECT * FROM productos WHERE id = ? ',[id],funcion);
    },
    borrar: function (conexion,id,funcion){ 
        conexion.query('DELETE FROM productos WHERE id=?', [id],funcion)
    },
    actualizar: function (conexion, datos, funcion) {
        conexion.query("UPDATE productos SET nombre=?, descripcion=?, precio=?, proveedor=?, categoria=? WHERE id=?",
        [datos.nombre,datos.descripcion,datos.precio,datos.proveedor,datos.categoria, datos.id], funcion);
      },    
    actualizarArchivo: function(conexion,datos,archivo,funcion){
        
        conexion.query('UPDATE productos SET imagen=? WHERE id =?',[archivo.filename, datos.id ],funcion);
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
    actualizar: function (id, datos, funcion) {
        const query = "UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, celular = ?, direccion = ?, localidad = ?, provincia = ? WHERE id = ?";
        const values = [datos.nombre, datos.apellido, datos.email, datos.celular, datos.direccion, datos.localidad, datos.provincia, id];
      
        conexion.query(query, values, function (error, resultados) {
          if (error) {
            return funcion(error, null);
          }
      
          return funcion(null, resultados);
        });
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
      
}