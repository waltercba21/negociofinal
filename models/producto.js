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
    obtenerPorCategoria: function (conexion, categoria, funcion) {
        conexion.query('SELECT * FROM productos WHERE categoria = ?', [categoria], funcion);
      }
      
}