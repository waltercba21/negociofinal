const conexion = require('../config/conexion')
const usuario= require('../models/usuario')
const bcryptjs= require('bcryptjs')
const { validationResult } = require ('express-validator')
var borrar = require('fs');

module.exports = {

    register: (req,res)=>{
        return res.render('register');
    },
    processRegister: (req, res) => {
        const resultValidation = validationResult(req);
      
        if (resultValidation.errors.length > 0) {
          return res.render('register', {
            errors: resultValidation.mapped(),
            oldData: req.body,
          });
        }
      
        const email = req.body.email;
      
        // Verificar si el email ya está registrado
        usuario.obtenerPorEmail(conexion, email, function (error, datos) {
          if (error) {
            // Manejar el error
          }
      
          if (datos.length > 0) {
            // El email ya está registrado, manejar en consecuencia
            return res.render('register', {
              errors: {
                emailExists: { msg: 'El email ya está registrado' }
              },
              oldData: req.body,
            });
          }
      
          const password = req.body.password;
      
          // Generar un salt para el hashing
          bcryptjs.genSalt(10, function (err, salt) {
            if (err) {
              // Manejar el error
            }
      
            // Hash del password utilizando el salt generado
            bcryptjs.hash(password, salt, function (err, hash) {
              if (err) {
                // Manejar el error
              }
      
              // Almacenar el password hasheado en la base de datos
              usuario.crear(conexion, { ...req.body, password: hash }, function (error) {
                res.render('login');
              });
            });
          });
        });
      },
      
    login: (req,res)=>{
        return res.render('login');
    },
    processLogin: (req, res) => {
        const email = req.body.email;
        const contraseña = req.body.password;
      
        usuario.obtenerPorEmailYContraseña(conexion, email, contraseña, function (error, datos) {
          if (error) {
            // Manejar el error
          }
      
          if (datos.length === 0) {
            // No se encontró ningún usuario con el correo electrónico y la contraseña proporcionados
            return res.render('login', {
              error: 'Credenciales inválidas',
              oldData: req.body,
            });
          }
      
          // Iniciar sesión exitosamente
          req.session.usuario = datos[0]; // Almacena los datos del usuario en la sesión
      
          // Redirigir al usuario a la página de inicio o a cualquier otra página deseada
          res.render('profile');
        });
      },
    lista : (req,res)=>{
        usuario.obtener(conexion,function(error,datos){
            res.render('profile', { title: 'Usuarios', usuarios:datos });
        })
    },
    profile: (req,res)=>{
        return res.render('profile');
    }


}