const usuario = require('../models/usuario');
const bcryptjs = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const conexion = require('../config/conexion')

module.exports = {
  register: (req, res) => {
    return res.render('register');
  },

  processRegister: (req, res) => {
    const resultValidation = validationResult(req);

    if (!resultValidation.isEmpty()) {
      return res.render('register', {
        errors: resultValidation.mapped(),
        oldData: req.body,
      });
    }

    const email = req.body.email;

    usuario.obtenerPorEmail(email, function (error, datos) {
      if (error) {
        // Manejar el error
      }

      if (datos.length > 0) {
        return res.render('register', {
          errors: {
            emailExists: { msg: 'El email ya está registrado' },
          },
          oldData: req.body,
        });
      }

      const password = req.body.password;

      bcryptjs.genSalt(10, function (err, salt) {
        if (err) {
          // Manejar el error
        }

        bcryptjs.hash(password, salt, function (err, hash) {
          if (err) {
            // Manejar el error
          }

          usuario.crear({ ...req.body, password: hash }, function (error) {
            res.render('login');
          });
        });
      });
    });
  },

  login: (req, res) => {
    return res.render('login');
  },  
  processLogin: (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('login', {
        errors: errors.array(),
        oldData: req.body,
      });
    }
    
    const email = req.body.email;
    const password = req.body.password;
    
    usuario.obtenerPorEmail(email, function (error, datos) {
      if (error) {
        // Manejar el error
      }
      
      if (datos.length === 0) {
        return res.render('login', {
          error: 'Credenciales inválidas',
          oldData: req.body,
        });
      }
      
      const storedPasswordHash = datos[0].password; // Obtén el hash almacenado de la base de datos
      
      bcryptjs.compare(password, storedPasswordHash, function (err, result) {
        if (err) {
          // Manejar el error
        }
          
        if (!result) {
          return res.render('login', {
            error: 'Credenciales inválidas',
            oldData: req.body,
          });
        }
          
        req.session.usuario = datos[0];
        const isLogged = true;
        const isAdminUser = (email === 'waltercordobadev@gmail.com');
  
       
        // Cargar el carrito del usuario de la base de datos
conexion.query('SELECT carritos.*, productos.precio, productos.imagen FROM carritos JOIN productos ON carritos.producto_id = productos.id WHERE carritos.usuario_id = ?', [req.session.usuario.id], function (error, carritos) {
  if (error) {
    console.log('Error al cargar el carrito:', error);
  } else {
    req.session.carrito = carritos;
    res.redirect('/users/profile');
  }
});
      });
    });
  },
  profile: async (req, res) => {
    if (req.session && req.session.usuario) {
      return res.render('profile', { usuario: req.session.usuario });
    } else {
      // Redirige al usuario a la página de inicio de sesión si no hay una sesión de usuario
      return res.redirect('/users/login');
    }
  },
  logout: (req, res) => {
    // Destruir la sesión
    req.session.destroy((error) => {
      if (error) {
        // Manejar el error si es necesario
      }
      // Redirigir al usuario al inicio después de cerrar sesión
      res.redirect('/');
    });
  },
  updateProfile: (req, res) => {
    const userId = req.session.usuario.id;
    const updatedData = req.body;
  
    usuario.actualizar(userId, updatedData, function (error) {
      if (error) {
        // Manejar el error
      }
  
      // Actualizar los datos del usuario en la sesión
      req.session.usuario = { ...req.session.usuario, ...updatedData };
  
      // Guardar la provincia y localidad seleccionadas en la sesión
      req.session.usuario.provincia = updatedData.provincia;
      req.session.usuario.nombreProvincia = updatedData.nombreProvincia;
      req.session.usuario.localidad = updatedData.localidad;
      req.session.usuario.nombreLocalidad = updatedData.nombreLocalidad;
  
      // Guardar la sesión actualizada
      req.session.save(function(err) {
        // Manejar el error
        if(err) {
          console.log(err);
        }
  
        res.redirect('/');
      });
    });
  },
  
}