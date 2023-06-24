module.exports ={
    obtener : function(conexion,funcion){
        conexion.query('SELECT * FROM productos',funcion);
    },
    insertar: function(conexion,datos,archivos,funcion){
        
     conexion.query('INSERT INTO productos (nombre,imagen) VALUES (?,?)',[datos.nombre,archivos.filename],funcion);
    },
    retornarDatosId: function (conexion,id,funcion){
        conexion.query('SELECT * FROM productos WHERE id = ? ',[id],funcion);
    },
    borrar: function (conexion,id,funcion){
        conexion.query('DELETE FROM productos WHERE id=?', [id],funcion)
    },
    actualizar: function (conexion, datos, funcion) {
        conexion.query("UPDATE productos SET nombre=? WHERE id=?",[datos.nombre, datos.id], funcion);
      },    
    actualizarArchivo: function(conexion,datos,archivo,funcion){
        
        conexion.query('UPDATE productos SET imagen=? WHERE id =?',[archivo.filename, datos.id ],funcion);
    }
}