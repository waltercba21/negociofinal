var express = require('express');
var router = express.Router();
var multer = require('multer');
const productosController = require('../controllers/productosController');
const ensureAuthenticated = require('../middleware/usuarioMiddleware');
var methodOverride = require('method-override');

router.use(methodOverride('_method'));

// Configuración de Multer para almacenamiento de archivos
var rutaAlmacen = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './uploads/productos/');
    },
    filename: function (req, file, callback) { 
        var fecha = Date.now();
        callback(null, fecha + '_' + file.originalname);
    }
});

var maxImagenes = 10;
var multerInstance = multer({ storage: rutaAlmacen });
var cargar = multerInstance.array('archivos[]', maxImagenes);

// Rutas
router.get('/', productosController.lista);
router.post('/', cargar, productosController.guardar);
router.get('/ofertas', productosController.ofertas);
router.get('/modelos/:marcaId', productosController.obtenerModelosPorMarca);
router.get('/panelControl', productosController.panelControl);
router.get('/crear', productosController.crear);

router.get('/presupuestoMostrador', productosController.presupuestoMostrador);
router.post('/procesarFormulario', productosController.procesarFormulario);
router.get('/presupuesto/:id', productosController.presupuesto);
router.get('/listadoPresupuestos', productosController.listadoPresupuestos);
router.get('/api/presupuestos', productosController.getPresupuestos);
router.put('/api/presupuestos/:id', productosController.editPresupuesto); 
router.delete('/api/presupuestos/:id', productosController.deletePresupuesto);

router.get('/facturasMostrador', productosController.facturasMostrador);
router.post('/procesarFormularioFacturas', productosController.procesarFormularioFacturas);
router.get('/factura/:id', productosController.factura);
router.get('/facturaVista/:id', productosController.facturaVista);
router.get('/listadoFacturas', productosController.listaFacturas);
router.get('/api/facturas', productosController.getFacturas);
router.put('/api/facturas/:id', productosController.editarFacturas);
router.delete('/api/facturas/:id', productosController.deleteFactura);
 
router.get('/masVendidos', productosController.masVendidos);

router.get('/generarPDF', productosController.generarPDF);
router.get('/generarPDFProveedor', productosController.generarPDFProveedor);
router.get('/editar/:id', productosController.editar);
router.post('/actualizar/:id', cargar, productosController.actualizar);
router.post('/actualizarPrecios/:id', productosController.actualizarPrecios);
router.post('/eliminarSeleccionados', productosController.eliminarSeleccionados);
router.delete('/eliminarProveedor/:id', productosController.eliminarProveedor);
router.delete('/eliminarImagen/:id', productosController.eliminarImagen);
router.get('/generarPedidoManual', productosController.generarPedidoManual);
router.post('/guardarPedido', productosController.guardarPedido);
router.get('/historialPedidos', productosController.historialPedidos);
router.delete('/eliminarPedido/:id', productosController.eliminarPedido);
router.get('/verPedido/:id', productosController.verPedido);
router.get('/ultimos', productosController.ultimos);
router.get('/modificarPorProveedor', productosController.modificarPorProveedor);
router.post('/actualizarPorProveedor', productosController.actualizarPorProveedor);
router.post('/actualizarPrecio', productosController.actualizarPrecio);
router.get('/api/buscar', productosController.buscar); 

// === NUEVO: Endpoints para “siguiente proveedor” ===
router.get('/api/proveedores/:productoId', productosController.apiProveedoresDeProducto);
router.get('/api/proveedor-siguiente', productosController.apiProveedorSiguiente);

// ⚠️ Mantener estas rutas nuevas ANTES de la dinámica '/:id'
router.get('/:id', productosController.detalle);

router.post('/generarPresupuestoPDF', productosController.generarPresupuestoPDF);
router.post('/actualizarPreciosExcel', cargar, productosController.actualizarPreciosExcel);

router.get('/actualizados/nuevos.pdf', productosController.descargarPDFNuevos);
module.exports = router;
