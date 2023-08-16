const conexion = require('../config/conexion');

module.exports = {
  obtener: function (funcion) {
    conexion.query('SELECT * FROM usuarios', funcion);
  },
  crear: function (datos, funcion) {
    conexion.query('INSERT INTO usuarios (nombre,email,password) VALUES (?,?,?)', [datos.nombre, datos.email, datos.password], funcion);
  },
  obtenerPorEmail: function (email, funcion) {
    conexion.query('SELECT * FROM usuarios WHERE email = ?', [email], funcion);
  },
  obtenerPorEmailYContraseña: function (email, contraseña, callback) {
    const query = "SELECT * FROM usuarios WHERE email = ? AND password = ?";
    const values = [email, contraseña];

    conexion.query(query, values, function (error, resultados) {
      if (error) {
        return callback(error, null);
      }

      return callback(null, resultados);
    });
  }
};
