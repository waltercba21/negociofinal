// routes/arcaRoutes.js
const express = require("express");
const router = express.Router();

const arcaController = require("../controllers/arcaController");
const adminMiddleware = require("../middleware/adminMiddleware");

// Protege TODO /arca (UI + API)
router.use(adminMiddleware);

// ===== API (JSON) =====

// Emitir ARCA desde una factura existente del mostrador
router.post("/emitir-desde-factura/:id", arcaController.emitirDesdeFacturaMostrador);

// Ver estado ARCA (último) por factura mostrador
router.get("/status/factura/:id", arcaController.statusPorFacturaMostrador);

// Listar últimas facturas del mostrador (para UI)
router.get("/ui/facturas", arcaController.listarFacturasMostrador);

// Detalle de una factura del mostrador (cabecera + items)
router.get("/ui/facturas/:id", arcaController.detalleFacturaMostrador);

// Historial ARCA por factura del mostrador
router.get("/ui/arca-por-factura/:id", arcaController.historialArcaPorFactura);

// ===== Reportes / Cierre diario =====

// Resumen por día entre fechas (facturas, NC, neto ventas, neto, IVA)
router.get("/reportes/resumen", arcaController.reportesResumen);

// Listado de comprobantes ARCA entre fechas (con filtros opcionales tipo/estado)
router.get("/reportes/comprobantes", arcaController.reportesComprobantes);

// Crear cierre diario (snapshot interno)
router.post("/cierre-diario", arcaController.crearCierreDiario);

// Listar cierres diarios entre fechas
router.get("/cierres-diarios", arcaController.listarCierresDiarios);

// Detalle de cierre diario por fecha (YYYY-MM-DD)
router.get("/cierres-diarios/:fecha", arcaController.detalleCierreDiario);

// ===== UI (EJS) =====

// Pantalla ARCA (si la montás como app.use('/arca', arcaRoutes) => esto queda en GET /arca)
router.get("/", arcaController.vistaArcaIndex);

// PDF del comprobante por arcaId
router.get("/pdf/:arcaId", arcaController.descargarPDFComprobante);

// Buscar receptor por doc (padron/cache)
router.get("/receptor", arcaController.buscarReceptor);

// Guardar receptor cache
router.post("/receptor/cache", arcaController.guardarReceptorCache);

// Parámetros cond IVA receptor
router.get("/params/cond-iva-receptor", arcaController.paramsCondIvaReceptor);

// Auditoría WSFE por arcaId
router.get("/wsfe/consultar/:arcaId", arcaController.auditarWsfePorArcaId);

// Historial de consultas WSFE por arcaId
router.get("/wsfe/consultas/:arcaId", arcaController.listarWsfeConsultas);

// Emitir Nota de Crédito asociada a un comprobante ARCA (origen)
router.post("/emitir-nc/:arcaIdOrigen", arcaController.emitirNotaCreditoPorArcaId);

module.exports = router;
