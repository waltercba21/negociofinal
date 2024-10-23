var express = require('express');
var router = express.Router();
var administracionController = require('../controllers/administracionController');
var multer  = require('multer');
var path = require('path');

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/comprobantes/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})
var upload = multer({ storage: storage });

router.get('/', administracionController.administracion);
router.get('/facturas', administracionController.facturas);




module.exports = router;