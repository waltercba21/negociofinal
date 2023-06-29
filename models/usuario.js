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


}