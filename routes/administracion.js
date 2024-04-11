var express = require('express');
var router = express.Router();
var multer = require('multer');
const administracionController = require('../controllers/administracionController');  
var fecha = Date.now();
var methodOverride = require('method-override')


//Administración
router.get('/facturas', administracionController.facturas);
router.get('/presupuestos', administracionController.presupuestos);

