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
router.post('/facturas', upload.single('comprobante_pago'), administracionController.postFactura);
router.get('/presupuestos', administracionController.presupuestos);
router.get('/listadoFacturas', administracionController.listadoFacturas);
router.get('/facturas/detalle/:id', administracionController.verDetalle);
router.get('/facturas/modificar/:id', administracionController.getModificarFactura);
router.post('/facturas/modificar/:id', upload.single('comprobante_pago'), administracionController.postModificarFactura);
router.get('/facturas/eliminar/:id', administracionController.getEliminarFactura);
router.post('/facturas/eliminar/:id', administracionController.postEliminarFactura);
router.get('/facturas/proveedor', administracionController.generarPDFProveedor);

router.post('/api/facturas', administracionController.apiFacturas);

// API Proveedores
router.get('/api/proveedores/:id', administracionController.getProveedorByIdAPI);
router.post('/api/proveedores', administracionController.crearProveedor);
router.put('/api/proveedores/:id', administracionController.editarProveedor);
router.delete('/api/proveedores/:id', administracionController.eliminarProveedor);


module.exports = router;