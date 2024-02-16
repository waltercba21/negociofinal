var express = require('express');
var router = express.Router();
var multer = require('multer');
const productosController = require('../controllers/productosController')
var fecha = Date.now();
const ensureAuthenticated = require('../middleware/usuarioMiddleware');
var methodOverride = require('method-override')

router.use(methodOverride('_method'))

var rutaAlmacen = multer.diskStorage({
    destination : function (req,file,callback){
        callback(null, './public/images/')
    },
    filename : function (req,file,callback){
        console.log(file);
        callback(null, fecha + '_' + file.originalname);
    }
});
var cargar = multer({storage: rutaAlmacen});

router.get('/', productosController.lista);
router.get('/crear', productosController.crear);
router.post('/',cargar.single('archivo'), productosController.guardar);
router.get('/panelControl', productosController.panelControl)
router.get('/editar/:id', productosController.editar)
router.post('/actualizar',cargar.single('archivo'), productosController.actualizar);
router.post('/eliminar/:id', productosController.eliminar);

// Nuevas rutas
router.get('/modificarPorProveedor', productosController.modificarPorProveedor);
router.post('/actualizarPorProveedor', productosController.actualizarPorProveedor);

// Rutas de la API
router.get('/api', productosController.lista);
router.get('/api/buscar', productosController.buscarPorNombre);
router.get('/api/carrito', productosController.getCarrito);

// Rutas del carrito de compras
router.get('/carrito', productosController.carrito);
router.get('/carrito/agregar/:id', ensureAuthenticated, productosController.agregarAlCarrito);
router.post('/carrito/eliminar/:id', productosController.eliminarDelCarrito);
router.post('/carrito/actualizar/:id', productosController.actualizarCantidadCarrito);
router.post('/carrito/envios', productosController.seleccionarEnvio);
router.post('/carrito/vaciar', productosController.vaciarCarrito);
router.post('/carrito/comprar', productosController.mostrarCompra);

module.exports = router;