var express = require('express');
var router = express.Router();
var administracionController = require('../controllers/administracionController');

//Administración
router.get('/administracion', administracionController.administracion);
router.get('/facturas', administracionController.facturas);
router.get('/presupuestos', administracionController.presupuestos);

module.exports = router;