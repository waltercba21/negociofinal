// ─── CARTAS DE PAGO ────────────────────────────────────────────────────────
// Agregar estos imports al inicio de routes/administracion.js:
//   var cartasPagoController = require('../controllers/cartasPagoController');
//
// Luego pegar las rutas a continuación (antes del module.exports):

// Documentos disponibles (facturas o presupuestos pendientes por proveedor)
router.get('/api/cartas-pago/documentos-disponibles', cartasPagoController.documentosDisponibles);

// CRUD cartas
router.post('/api/cartas-pago',         cartasPagoController.crearCarta);
router.get('/api/cartas-pago',          cartasPagoController.listarCartas);
router.get('/api/cartas-pago/:id',      cartasPagoController.obtenerCarta);
router.put('/api/cartas-pago/:id/anular', cartasPagoController.anularCarta);

// PDF
router.get('/api/cartas-pago/:id/pdf',  cartasPagoController.generarPDF);
