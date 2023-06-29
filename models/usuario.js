module.exports = {
  obtener : function(conexion,funcion){
    conexion.query('SELECT * FROM usuarios',funcion);
},
  crear: function(conexion,datos,funcion){
        
    conexion.query('INSERT INTO usuarios (nombre,email,password) VALUES (?,?,?)',[datos.nombre,datos.email,datos.password],funcion);
},
  obtenerPorEmail: function (conexion, email, funcion) {
    conexion.query('SELECT * FROM usuarios WHERE email = ?', [email], funcion);
},
  obtenerPorEmailYContraseña: function (conexion, email, contraseña, callback) {
    const query = "SELECT * FROM usuarios WHERE email = ? AND contraseña = ?";
    const values = [email, contraseña];

    conexion.query(query, values, function (error, resultados) {
    if (error) {
      return callback(error, null);
    }

    return callback(null, resultados);
  });
}


}