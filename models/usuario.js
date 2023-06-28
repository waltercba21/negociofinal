module.exports = {
  obtener : function(conexion,funcion){
    conexion.query('SELECT * FROM usuarios',funcion);
},
  crear: function(conexion,datos,funcion){
        
    conexion.query('INSERT INTO usuarios (usuario, nombre,email,password) VALUES (?,?,?,?)',[datos.usuario,datos.nombre,datos.email,datos.password],funcion);
   },
  
}