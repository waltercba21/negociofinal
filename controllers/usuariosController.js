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
        res.render('profile', { usuario: datos[0], isLogged, isAdminUser });
      });
    });
  },
  profile: (req,res) => {
    
      return res.render('profile')
  
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
  }
  
}
