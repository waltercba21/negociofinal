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

router.get('/carrito', productosController.carrito)

router.get('/panelControl', productosController.panelControl)

router.post('/eliminar/:id', productosController.eliminar)

router.get('/editar/:id', productosController.editar)

router.post('/actualizar',cargar.single('archivo'), productosController.actualizar);

// Ruta para buscar productos por nombre
router.get('/api/buscar', productosController.buscarPorNombre);

router.get('/carrito/agregar/:id', ensureAuthenticated, function(req, res, next) {
    console.log('Ruta /carrito/agregar/:id activada con ID de producto:', req.params.id);
    next();
}, productosController.agregarAlCarrito);

router.get('/carrito', productosController.carrito)

// Ruta para eliminar un producto del carrito de compras
router.post('/carrito/eliminar/:id', productosController.eliminarDelCarrito);

// Ruta para actualizar la cantidad de un producto en el carrito de compras
router.post('/carrito/actualizar/:id', function(req, res) {
    const productoId = Number(req.params.id);
    const nuevaCantidad = Number(req.body.cantidad);
    const carrito = req.session.carrito || [];

    for (var i = 0; i < carrito.length; i++) {
      if (Number(carrito[i].id) === productoId) {
        carrito[i].cantidad = nuevaCantidad;
        break;
      }
    }

    req.session.carrito = carrito;
    res.redirect('/productos/carrito');
});
router.post('/productos/carrito/actualizar/:id', productosController.actualizarCantidadCarrito);
router.post('/vaciar-carrito', productosController.vaciarCarrito);
router.get('/comprar', productosController.mostrarCompra);
router.post('/comprar', productosController.completarCompra);


module.exports = router;