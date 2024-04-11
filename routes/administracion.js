var express = require('express');
var router = express.Router();
var administracionController = require('../controllers/administracionController');
var multer  = require('multer');
var path = require('path');

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads')
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
})

var upload = multer({ storage: storage });
//Administración
router.get('/', administracionController.administracion);
router.get('/facturas', administracionController.facturas);
router.post('/facturas', upload.single('comprobante_pago'), administracionController.postFactura);
router.get('/presupuestos', administracionController.presupuestos);

module.exports = router;