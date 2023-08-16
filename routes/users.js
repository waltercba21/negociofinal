var express = require('express');
var router = express.Router();
const path = require('path');
const usuariosController = require('../controllers/usuariosController')
const { body } = require ('express-validator') 

const registerValidations = [
  body('nombre').notEmpty().withMessage('Tienes que escribir un nombre'),
  body('email')
    .notEmpty().withMessage('Tienes que escribir tu email').bail()
    .isEmail().withMessage('Tienes que escribir un mail válido'),
  body('password').notEmpty().withMessage('Tienes que colocar una contraseña'),
]

const loginValidations = [
  body('email')
    .notEmpty().withMessage('Tienes que escribir tu email').bail()
    .isEmail().withMessage('Tienes que escribir un mail válido'),
  body('password').notEmpty().withMessage('Tienes que colocar una contraseña'),
]

// Formulario de Registro
router.get('/register', usuariosController.register);
router.post('/register', registerValidations, usuariosController.processRegister);

// Formulario de Login
router.get('/login', usuariosController.login);
router.post('/login', loginValidations, usuariosController.processLogin);


// Perfil de Usuario
router.get('/profile', usuariosController.profile);

module.exports = router;
