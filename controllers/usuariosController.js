const usuario = require('../models/usuario');
const bcryptjs = require('bcryptjs');
const { body, validationResult } = require('express-validator');

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
        res.redirect('/users/profile');
      });
    });
  },
  profile: (req, res) => {
    if (req.session && req.session.usuario) {
      console.log(req.session.usuario); // Añade esta línea
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
    
      console.log(updatedData); // Añade esta línea
    
      // Actualizar los datos del usuario en la sesión
      req.session.usuario = { ...req.session.usuario, ...updatedData };
      console.log(req.session.usuario); // Añade esta línea
      res.redirect('/users/profile');
    });
  },
  
}
