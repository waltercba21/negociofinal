const usuario = require('../models/usuario');
const bcryptjs = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const conexion = require('../config/conexion')
const crypto = require('crypto');
const adminEmails = ['walter@autofaros.com.ar', 'chacho@autofaros.com.ar', 'gera@autofaros.com.ar'];

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
        req.session.usuario.isAdmin = adminEmails.includes(email);
        req.session.usuario.isAccountingAdmin = email === 'gera@autofaros.com.ar';
        if (req.session.usuario.firstLogin === undefined) {
          req.session.usuario.firstLogin = true;
        }
        res.redirect('/');
      });
    });
  },
  profile: async (req, res) => {
    if (req.session && req.session.usuario) {
      if (!req.session.usuario.firstLogin) {
        return res.redirect('/');
      }
      req.session.usuario.firstLogin = false;
      req.session.save(err => {
        if (err) {
          console.log(err);
        } else {
          return res.render('profile', { usuario: req.session.usuario });
        }
      });
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
    console.log("ID del usuario a eliminar: ", req.session.usuario.id);
    usuario.eliminar(req.session.usuario.id, (err) => {
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