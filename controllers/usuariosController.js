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
        console.log(error);
      }
      if (datos.length === 0) {
        return res.render('login', {
          error: 'Credenciales inválidas',
          oldData: req.body,
        });
      }
      const storedPasswordHash = datos[0].password; 
      bcryptjs.compare(password, storedPasswordHash, function (err, result) {
        if (err) {
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
      return res.redirect('/users/login');
    }
  },
  logout: (req, res) => {
    req.session.destroy((error) => {
      if (error) {
      }
      res.redirect('/');
    });
  },
  updateProfile: (req, res) => {
    const userId = req.session.usuario.id;
    const updatedData = req.body;
    usuario.actualizar(userId, updatedData, function (error) {
      if (error) {
      }
      req.session.usuario = { ...req.session.usuario, ...updatedData };
      req.session.usuario.provincia = updatedData.provincia;
      req.session.usuario.nombreProvincia = updatedData.nombreProvincia;
      req.session.usuario.localidad = updatedData.localidad;
      req.session.usuario.nombreLocalidad = updatedData.nombreLocalidad;
      req.session.save(function(err) {
        if(err) {
          console.log(err);
        }
        res.redirect('/');
      });
    });
  },
  deleteAccount : (req, res, next) => {
    usuario.eliminar(req.session.userId, (err) => {
      if (err) {
        return next(err);
      }
      req.session.destroy((err) => {
        if (err) {
          return next(err);
        }
        res.redirect('/');
      });
    });
  },
}