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
  processRegister: async (req, res) => {
    const resultValidation = validationResult(req);
  
    if (!resultValidation.isEmpty()) {
      const provincias = await obtenerProvincias(); // Método para obtener provincias
      const localidades = await obtenerLocalidades(); // Método para obtener localidades
  
      return res.render('register', {
        errors: resultValidation.mapped(),
        oldData: req.body,
        provincias,
        localidades,
      });
    }
  
    const email = req.body.email;
  
    usuario.obtenerPorEmail(email, async (error, datos) => {
      if (error) {
        return res.render('register', {
          error: 'Ocurrió un error al verificar el email.',
          oldData: req.body,
        });
      }
  
      if (datos.length > 0) {
        const provincias = await obtenerProvincias();
        const localidades = await obtenerLocalidades();
  
        return res.render('register', {
          errors: { emailExists: { msg: 'El email ya está registrado' } },
          oldData: req.body,
          provincias,
          localidades,
        });
      }
  
      const salt = await bcryptjs.genSalt(10);
      const hash = await bcryptjs.hash(req.body.password, salt);
  
      usuario.crear({ ...req.body, password: hash }, (error, result) => {
        if (error) {
          return res.render('register', {
            error: 'Ocurrió un error al registrar el usuario.',
            oldData: req.body,
          });
        }
  
        res.render('login');
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
  
    const { email, password } = req.body;
  
    usuario.obtenerPorEmail(email, function (error, datos) {
      if (error) {
        console.error('Error al buscar el usuario:', error);
        return res.render('login', {
          error: 'Ocurrió un error en el servidor. Inténtalo de nuevo.',
          oldData: req.body,
        });
      }
  
      if (datos.length === 0) {
        return res.render('login', {
          error: 'Credenciales inválidas',
          oldData: req.body,
        });
      }
  
      const storedPasswordHash = datos[0].password; // Asegúrate de que este es el hash correcto
  
      bcryptjs.compare(password, storedPasswordHash, function (err, result) {
        if (err) {
          console.error('Error al comparar contraseñas:', err);
          return res.render('login', {
            error: 'Ocurrió un error en el servidor. Inténtalo de nuevo.',
            oldData: req.body,
          });
        }
  
        if (!result) {
          return res.render('login', {
            error: 'Credenciales inválidas',
            oldData: req.body,
          });
        }
  
        // Configurar sesión si las credenciales son correctas
        req.session.usuario = datos[0];
        req.session.usuario.isAdminUser = adminEmails.includes(email);
  
        if (req.session.usuario.firstLogin === undefined) {
          req.session.usuario.firstLogin = true;
        }
  
        res.redirect('/');
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
  
    // Validación básica (puedes usar una librería como express-validator para mayor robustez)
    if (!updatedData.nombre || !updatedData.email) {
      return res.render('profile', {
        error: 'El nombre y el email son obligatorios',
        oldData: updatedData,
      });
    }
  
    usuario.actualizar(userId, updatedData, function (error) {
      if (error) {
        console.error('Error al actualizar el perfil:', error);
        return res.render('profile', {
          error: 'Ocurrió un error al actualizar el perfil. Intenta nuevamente.',
          oldData: updatedData,
        });
      }
  
      // Actualizar datos en la sesión
      req.session.usuario = { ...req.session.usuario, ...updatedData };
  
      req.session.save(function (err) {
        if (err) {
          console.error('Error al guardar la sesión:', err);
          return res.render('profile', {
            error: 'Ocurrió un error al actualizar tu sesión. Intenta nuevamente.',
            oldData: updatedData,
          });
        }
  
        res.redirect('/');
      });
    });
  },  
  deleteAccount: (req, res, next) => {
    const userId = req.session.usuario.id;
  
    usuario.eliminar(userId, (err) => {
      if (err) {
        console.error('Error al eliminar la cuenta:', err);
        return next(err); // Esto manejará el error globalmente o con middleware de errores.
      }
  
      req.session.destroy((err) => {
        if (err) {
          console.error('Error al destruir la sesión:', err);
          return next(err);
        }
  
        // Redirigir a una página de confirmación o al inicio
        res.redirect('/cuenta-eliminada');
      });
    });
  },  
 
}