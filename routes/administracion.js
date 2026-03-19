var express = require('express');
var router = express.Router();
var administracionController = require('../controllers/administracionController');
var cartasPagoController = require('../controllers/cartasPagoController');
var multer = require('multer');
var path = require('path');

// ── Middleware autenticación ──────────────────────────────────────────────────
var ensureAuthenticated = require('../middleware/usuarioMiddleware');

// ── Multer: comprobantes de pago ──────────────────────────────────────────────
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/comprobantes/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `comprobante_${Date.now()}${ext}`);
  }
});
var upload = multer({ storage: storage });

// ── Protección global del router ──────────────────────────────────────────────
router.use(ensureAuthenticated);
router.use((req, res, next) => {
  const adminEmails = require('../config/admins');
  if (!req.session.usuario || !adminEmails.includes(req.session.usuario.email)) {
    return res.status(403).send('Acceso denegado');
  }
  next();
});

// ── Vista principal ───────────────────────────────────────────────────────────
router.get('/', administracionController.administracion);

// ── Facturas ──────────────────────────────────────────────────────────────────
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

// ── API Proveedores ───────────────────────────────────────────────────────────
router.get('/api/proveedores', administracionController.getProveedoresAPI);
router.get('/api/proveedores/:id', administracionController.getProveedorByIdAPI);
router.post('/api/proveedores', administracionController.crearProveedor);
router.put('/api/proveedores/:id', administracionController.editarProveedor);
router.delete('/api/proveedores/:id', administracionController.eliminarProveedor);

// ── Presupuestos ──────────────────────────────────────────────────────────────
router.post('/api/presupuestos', administracionController.postPresupuesto);
router.post('/api/presupuestos/productos', administracionController.guardarItemsPresupuesto);

// ── API documentos combinados (facturas + presupuestos) ───────────────────────
router.get('/api/documentos', administracionController.listarDocumentos);

// ── Detalle individual ────────────────────────────────────────────────────────
router.get('/api/factura/:id', administracionController.getFacturaById);
router.get('/api/presupuesto/:id', administracionController.getPresupuestoById);

// ── Actualizar ────────────────────────────────────────────────────────────────
router.put('/api/factura/:id', administracionController.actualizarFactura);
router.put('/api/presupuesto/:id', administracionController.actualizarPresupuesto);

// ── Notas de crédito ──────────────────────────────────────────────────────────
router.post('/api/notas-credito', administracionController.postNotaCredito);
router.get('/api/notas-credito', administracionController.listarNotasCreditoAPI);
router.get('/api/notas-credito/:id', administracionController.getNotaCreditoByIdAPI);
router.put('/api/notas-credito/:id', administracionController.actualizarNotaCredito);
router.delete('/api/notas-credito/:id', administracionController.eliminarNotaCredito);
router.get('/api/verificar-nota-credito-duplicada', administracionController.verificarNotaCreditoDuplicadaAPI);

// ── PDFs ─────────────────────────────────────────────────────────────────────
// ⚠️  Las rutas específicas ANTES de la genérica /:tipo/:id
router.get('/pdf/resumen/facturas', administracionController.generarResumenFacturasPDF);
router.get('/pdf/resumen/presupuestos', administracionController.generarResumenPresupuestosPDF);
router.get('/pdf/:tipo/:id', administracionController.generarPDFIndividual);

// ── Verificación duplicados ───────────────────────────────────────────────────
router.get('/verificar-duplicado', administracionController.verificarDocumentoDuplicado);

// ── Eliminar documentos ───────────────────────────────────────────────────────
router.delete('/api/factura/:id', administracionController.eliminarFactura);
router.delete('/api/presupuesto/:id', administracionController.eliminarPresupuesto);

// ── PDF deuda pendiente ───────────────────────────────────────────────────────
router.get('/pdf/deuda-pendiente', administracionController.generarPDFDeudaPendiente);
router.get('/api/resumen-compras', administracionController.resumenComprasPorPeriodo);
router.get('/pdf/resumen/compras-periodo', administracionController.generarResumenComprasPeriodoPDF);

// ── Objetivos ─────────────────────────────────────────────────────────────────
router.get('/objetivos', administracionController.objetivos);
router.get('/api/objetivos-compras', administracionController.apiObjetivosCompras);
router.get('/api/objetivos-ventas', administracionController.apiObjetivosVentas);

// ── Gastos ────────────────────────────────────────────────────────────────────
router.get('/gastos', administracionController.gastos);
router.post('/gastos', administracionController.postGasto);
router.get('/api/gastos', administracionController.listarGastos);
router.get('/api/objetivos-gastos', administracionController.apiObjetivosGastos);
router.post('/gastos/:id/eliminar', administracionController.eliminarGasto);

// ── Catálogos ─────────────────────────────────────────────────────────────────
router.get('/api/categorias', administracionController.getCategorias);
router.post('/api/categorias', administracionController.crearCategoria);
router.put('/api/categorias/:id', administracionController.editarCategoria);
router.delete('/api/categorias/:id', administracionController.eliminarCategoria);

router.get('/api/marcas', administracionController.getMarcas);
router.post('/api/marcas', administracionController.crearMarca);
router.put('/api/marcas/:id', administracionController.editarMarca);
router.delete('/api/marcas/:id', administracionController.eliminarMarca);

router.get('/api/modelos', administracionController.getModelos);
router.post('/api/modelos', administracionController.crearModelo);
router.put('/api/modelos/:id', administracionController.editarModelo);
router.delete('/api/modelos/:id', administracionController.eliminarModelo);

// ═════════════════════════════════════════════════════════════════════════════
// CARTAS DE PAGO
// ═════════════════════════════════════════════════════════════════════════════

// ⚠️  Esta ruta DEBE ir ANTES de /api/cartas-pago/:id para que no sea
//     interpretada como un :id con valor "documentos-disponibles"
router.get('/api/cartas-pago/documentos-disponibles',   cartasPagoController.documentosDisponibles);
router.get('/api/cartas-pago/notas-credito-disponibles', cartasPagoController.notasCreditoDisponibles);

router.post('/api/cartas-pago',               cartasPagoController.crearCarta);
router.get('/api/cartas-pago',                cartasPagoController.listarCartas);
router.get('/api/cartas-pago/:id',            cartasPagoController.obtenerCarta);
router.put('/api/cartas-pago/:id/anular',     cartasPagoController.anularCarta);
router.get('/api/cartas-pago/:id/pdf',        cartasPagoController.generarPDF);

// ═════════════════════════════════════════════════════════════════════════════

module.exports = router;