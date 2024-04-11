var express = require('express');
var router = express.Router();
var administracionController = require('../controllers/administracionController');

//Administración
router.get('/', administracionController.administracion);
router.get('/facturas', administracionController.facturas);
router.post('/facturas', upload.single('comprobante_pago'), administracionController.postFactura);
router.get('/presupuestos', administracionController.presupuestos);

module.exports = router;