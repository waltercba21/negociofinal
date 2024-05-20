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
        callback(null, './uploads/productos/')
    },
    filename : function (req,file,callback){
        var fecha = Date.now();
        console.log(file);
        callback(null, fecha + '_' + file.originalname);
    }
});

var maxImagenes = 10; 
var multerInstance = multer({storage: rutaAlmacen});
var cargar = multerInstance.array('archivos[]', maxImagenes);

router.get('/', productosController.lista);  
router.post('/', cargar, productosController.guardar);
router.get('/', productosController.getProductosPorCategoria);
router.get('/modelos/:marcaId', productosController.obtenerModelosPorMarca);
router.get('/panelControl', productosController.panelControl) 
router.get('/proveedores', productosController.proveedores);
router.get('/crear', productosController.crear);
router.get('/generarPDF', productosController.generarPDF);
router.get('/editar/:id', productosController.editar)
router.post('/actualizar/:id', cargar, productosController.actualizar);
router.post('/eliminarSeleccionados', productosController.eliminarSeleccionados);
router.delete('/eliminarProveedor/:id', productosController.eliminarProveedor);
router.put('/api/imagenes/:id', productosController.actualizarPosicionImagen);
router.delete('/api/imagenes/:id', productosController.eliminarImagen);
router.get('/ultimos', productosController.ultimos);
router.get('/modificarPorProveedor', productosController.modificarPorProveedor);
router.post('/actualizarPorProveedor', productosController.actualizarPorProveedor);
router.post('/actualizarPrecio', productosController.actualizarPrecio);
router.get('/api', productosController.lista);
router.get('/api/buscar', productosController.buscar);
router.get('/:id', productosController.detalle); 

module.exports = router;