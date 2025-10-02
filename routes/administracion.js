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
router.get('/listadoFacturas', administracionController.listadoFacturas);
router.get('/facturas/detalle/:id', administracionController.verDetalle);
router.get('/facturas/modificar/:id', administracionController.getModificarFactura);
router.post('/facturas/modificar/:id', upload.single('comprobante_pago'), administracionController.postModificarFactura);
router.get('/facturas/eliminar/:id', administracionController.getEliminarFactura);
router.post('/facturas/eliminar/:id', administracionController.postEliminarFactura);
router.get('/facturas/proveedor', administracionController.generarPDFProveedor);

router.post('/api/facturas', upload.single('comprobante_pago'), administracionController.postFactura);
router.post('/api/factura/productos', administracionController.guardarItemsFactura);


// API Proveedores
router.get('/api/proveedores', administracionController.getProveedoresAPI);
router.get('/api/proveedores/:id', administracionController.getProveedorByIdAPI);
router.post('/api/proveedores', administracionController.crearProveedor);
router.put('/api/proveedores/:id', administracionController.editarProveedor);
router.delete('/api/proveedores/:id', administracionController.eliminarProveedor);

router.post('/api/presupuestos', administracionController.postPresupuesto);
router.post('/api/presupuestos/productos', administracionController.guardarItemsPresupuesto);

// API de documentos combinados (facturas y presupuestos)
router.get('/api/documentos', administracionController.listarDocumentos);

// Obtener detalle individual
router.get('/api/factura/:id', administracionController.getFacturaById);
router.get('/api/presupuesto/:id', administracionController.getPresupuestoById);

// Actualizar
router.put('/api/factura/:id', administracionController.actualizarFactura);
router.put('/api/presupuesto/:id', administracionController.actualizarPresupuesto);

// ✅ Estas primero
router.get('/pdf/resumen/facturas', administracionController.generarResumenFacturasPDF);
router.get('/pdf/resumen/presupuestos', administracionController.generarResumenPresupuestosPDF);

// ✅ Esta después (más general)
router.get('/pdf/:tipo/:id', administracionController.generarPDFIndividual);

router.get('/verificar-duplicado', administracionController.verificarDocumentoDuplicado);

router.delete('/api/factura/:id', administracionController.eliminarFactura);
router.delete('/api/presupuesto/:id', administracionController.eliminarPresupuesto);

router.get('/pdf/deuda-pendiente', administracionController.generarPDFDeudaPendiente);

router.get('/objetivos', administracionController.objetivos);

// API Objetivos (compras A/B/TOTAL por periodo)
router.get('/api/objetivos-compras', administracionController.apiObjetivosCompras);

// API Objetivos (ventas A/B/TOTAL por periodo)
router.get('/api/objetivos-ventas', administracionController.apiObjetivosVentas);

// --- GASTOS ---
router.get('/gastos', administracionController.gastos);
router.post('/gastos', administracionController.postGasto);
router.get('/api/gastos', administracionController.listarGastos);
// GET /administracion/api/objetivos-gastos
router.get('/api/objetivos-gastos', administracionController.apiObjetivosGastos);

module.exports = router;