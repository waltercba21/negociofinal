const conexion = require('../config/conexion');

module.exports = {
  obtener: function (funcion) {
    conexion.query('SELECT * FROM usuarios', funcion);
  },
  crear: function (datos, funcion) {
    const {
      nombre,
      apellido,
      email,
      password,
      celular,
      direccion,
      localidad,
      provincia,
      fecha_nacimiento,
      acepto_terminos,
    } = datos;
  
    if (!nombre || !apellido || !email || !password || !celular || !direccion || !localidad || !provincia || !fecha_nacimiento || !acepto_terminos) {
      console.error('Campos faltantes en los datos del usuario:', datos);
      return funcion(new Error('Todos los campos son obligatorios'));
    }
  
    conexion.query(
      `INSERT INTO usuarios (nombre, apellido, email, password, celular, direccion, localidad, provincia, fecha_nacimiento) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellido, email, password, celular, direccion, localidad, provincia, fecha_nacimiento],
      (error, result) => {
        if (error) {
          console.error('Error al insertar en la base de datos:', error);
          return funcion(error);
        }
  
        console.log('Resultado de la inserción:', result);
        funcion(null, result);
      }
    );
  },  
  obtenerPorEmail: function (email, funcion) {
    conexion.query('SELECT * FROM usuarios WHERE email = ?', [email], funcion);
  },
  actualizar: function (id, datos, callback) {
    const query = `
      UPDATE usuarios 
      SET nombre = ?, apellido = ?, email = ?, celular = ?, direccion = ?, localidad = ?, provincia = ? 
      WHERE id = ?
    `;
    const values = [
      datos.nombre,
      datos.apellido,
      datos.email,
      datos.celular,
      datos.direccion,
      datos.localidad,
      datos.provincia,
      id,
    ];
  
    conexion.query(query, values, function (error, resultados) {
      if (error) {
        console.error('Error al actualizar en la base de datos:', error);
        return callback(error);
      }
      return callback(null);
    });
  },  
  eliminar: function (id, callback) {
    const query = 'DELETE FROM usuarios WHERE id = ?';
    conexion.query(query, [id], function (error, resultados) {
      if (error) {
        return callback(error);
      }
      return callback(null);
    });
  },
obtenerPorEmailYContraseña: function (email, contraseña, callback) {
  const query = "SELECT * FROM usuarios WHERE email = ?";
  const values = [email];

  conexion.query(query, values, function (error, resultados) {
    if (error) {
      return callback(error, null);
    }

    if (resultados.length === 0) {
      return callback(null, null);
    }

    const usuario = resultados[0];

    bcrypt.compare(contraseña, usuario.password, function (err, result) {
      if (err) {
        return callback(err, null);
      }

      if (!result) {
        return callback(null, null);
      }

      return callback(null, usuario);
    });
  });
},
buscarPorEmail: function (email, callback) {
  const query = 'SELECT * FROM usuarios WHERE email = ?';
  conexion.query(query, [email], function (error, resultados) {
    if (error) {
      return callback(error, null);
    }

    if (resultados.length === 0) {
      return callback(null, null);
    }

    return callback(null, resultados[0]);
  });
},  
};