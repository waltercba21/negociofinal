var express = require('express');
var router = express.Router();
var multer = require('multer');
const path = require('path');
const productosController = require('../controllers/productosController');
const ensureAuthenticated = require('../middleware/usuarioMiddleware');
const adminEmails = require('../config/admins');
var methodOverride = require('method-override');

router.use(methodOverride('_method'));

// Configuración de Multer para almacenamiento de archivos
var rutaAlmacen = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './uploads/productos/');
    },
    filename: function (req, file, callback) {
        // Nombre seguro: timestamp + extensión original
        const ext = path.extname(file.originalname).toLowerCase();
        const base = path.basename(file.originalname, path.extname(file.originalname))
            .replace(/[^a-zA-Z0-9_\-]/g, '_')
            .substring(0, 50);
        callback(null, `${Date.now()}_${base}${ext}`);
    }
});

var maxImagenes = 10;
var multerInstance = multer({ storage: rutaAlmacen });
var cargar = multerInstance.array('archivos[]', maxImagenes);

// ─── Multer exclusivo para listas de precios Excel (xls + xlsx) ───────────────
// Guarda el archivo en uploads/listas-precios/ conservando la extensión original.
// Acepta tanto .xlsx como .xls (el parser Python convierte .xls automáticamente).
var rutaListasPrecios = multer.diskStorage({
    destination: function (req, file, callback) {
        const dir = './uploads/listas-precios/';
        require('fs').mkdirSync(dir, { recursive: true });
        callback(null, dir);
    },
    filename: function (req, file, callback) {
        const ext  = path.extname(file.originalname).toLowerCase();          // .xlsx o .xls
        const base = path.basename(file.originalname, path.extname(file.originalname))
            .replace(/[^a-zA-Z0-9_\-]/g, '_')
            .substring(0, 60);
        callback(null, `${Date.now()}_${base}${ext}`);
    }
});
var cargarListaPrecio = multer({
    storage: rutaListasPrecios,
    fileFilter: function (req, file, callback) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.xlsx' || ext === '.xls') {
            callback(null, true);
        } else {
            callback(new Error('Solo se aceptan archivos .xlsx o .xls'), false);
        }
    },
    limits: { fileSize: 50 * 1024 * 1024 }   // 50 MB máximo
}).single('archivos[]');

// ─── Middleware: solo admins ───────────────────────────────────────────────────
function soloAdmin(req, res, next) {
    if (!req.session.usuario || !adminEmails.includes(req.session.usuario.email)) {
        return res.status(403).send('Acceso denegado');
    }
    next();
}

// ─── RUTAS PÚBLICAS (cualquier visitante) ─────────────────────────────────────
router.get('/', productosController.lista);
router.get('/ofertas', productosController.ofertas);
router.get('/modelos/:marcaId', productosController.obtenerModelosPorMarca);
router.get('/api/buscar', productosController.buscar);
router.get('/ultimos', productosController.ultimos);


// ─── RUTAS MOSTRADOR (usuario logueado) ───────────────────────────────────────
router.get('/presupuestoMostrador', ensureAuthenticated, productosController.presupuestoMostrador);
router.post('/procesarFormulario', ensureAuthenticated, productosController.procesarFormulario);
router.get('/presupuesto/:id', ensureAuthenticated, productosController.presupuesto);
router.get('/listadoPresupuestos', ensureAuthenticated, productosController.listadoPresupuestos);
router.get('/api/presupuestos', ensureAuthenticated, productosController.getPresupuestos);
router.put('/api/presupuestos/:id', ensureAuthenticated, productosController.editPresupuesto);
router.delete('/api/presupuestos/:id', ensureAuthenticated, productosController.deletePresupuesto);

router.get('/facturasMostrador', ensureAuthenticated, productosController.facturasMostrador);
router.post('/procesarFormularioFacturas', ensureAuthenticated, productosController.procesarFormularioFacturas);
router.get('/factura/:id', ensureAuthenticated, productosController.factura);
router.get('/facturaVista/:id', ensureAuthenticated, productosController.facturaVista);
router.get('/listadoFacturas', ensureAuthenticated, productosController.listaFacturas);
router.get('/api/facturas', ensureAuthenticated, productosController.getFacturas);
router.put('/api/facturas/:id', ensureAuthenticated, productosController.editarFacturas);
router.delete('/api/facturas/:id', ensureAuthenticated, productosController.deleteFactura);

// ─── RUTAS SOLO ADMIN ─────────────────────────────────────────────────────────
router.get('/panelControl', ensureAuthenticated, soloAdmin, productosController.panelControl);
router.get('/crear', ensureAuthenticated, soloAdmin, productosController.crear);
router.post('/', ensureAuthenticated, soloAdmin, cargar, productosController.guardar);

router.get('/masVendidos', ensureAuthenticated, soloAdmin, productosController.masVendidos);
router.get('/recomendacionesProveedor', ensureAuthenticated, soloAdmin, productosController.recomendacionesProveedor);
router.get('/recomendacionesProveedor/pdf', ensureAuthenticated, soloAdmin, productosController.recomendacionesProveedorPDF);

router.get('/generarPDF', ensureAuthenticated, soloAdmin, productosController.generarPDF);
router.get('/generarPDFProveedor', ensureAuthenticated, soloAdmin, productosController.generarPDFProveedor);
router.get('/editar/:id', ensureAuthenticated, soloAdmin, productosController.editar);
router.post('/actualizar/:id', ensureAuthenticated, soloAdmin, cargar, productosController.actualizar);
router.post('/actualizarPrecios/:id', ensureAuthenticated, soloAdmin, productosController.actualizarPrecios);
router.post('/eliminarSeleccionados', ensureAuthenticated, soloAdmin, productosController.eliminarSeleccionados);
router.delete('/eliminarProveedor/:id', ensureAuthenticated, soloAdmin, productosController.eliminarProveedor);
router.delete('/eliminarImagen/:id', ensureAuthenticated, soloAdmin, productosController.eliminarImagen);
router.get('/generarPedidoManual', ensureAuthenticated, soloAdmin, productosController.generarPedidoManual);
router.post('/guardarPedido', ensureAuthenticated, soloAdmin, productosController.guardarPedido);
router.get('/historialPedidos', ensureAuthenticated, soloAdmin, productosController.historialPedidos);
router.delete('/eliminarPedido/:id', ensureAuthenticated, soloAdmin, productosController.eliminarPedido);
router.get('/verPedido/:id', ensureAuthenticated, soloAdmin, productosController.verPedido);
router.get('/modificarPorProveedor', ensureAuthenticated, soloAdmin, productosController.modificarPorProveedor);
router.post('/actualizarPorProveedor', ensureAuthenticated, soloAdmin, productosController.actualizarPorProveedor);
router.post('/actualizarPrecio', ensureAuthenticated, soloAdmin, productosController.actualizarPrecio);
router.post('/generarPresupuestoPDF', ensureAuthenticated, soloAdmin, productosController.generarPresupuestoPDF);
router.post('/actualizarPreciosExcel', ensureAuthenticated, soloAdmin, cargarListaPrecio, productosController.actualizarPreciosExcel);
router.get('/actualizados/nuevos.pdf', ensureAuthenticated, soloAdmin, productosController.descargarPDFNuevos);

// API proveedores (admin)
router.get('/api/proveedores/:productoId', ensureAuthenticated, soloAdmin, productosController.apiProveedoresDeProducto);
router.get('/api/proveedor-siguiente', ensureAuthenticated, soloAdmin, productosController.apiProveedorSiguiente);

router.get('/:id', productosController.detalle);
module.exports = router;
