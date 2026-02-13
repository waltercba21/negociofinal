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

// Resumen por día entre fechas
router.get("/reportes/resumen", arcaController.reportesResumen);

// Listado de comprobantes entre fechas (filtros opcionales)
router.get("/reportes/comprobantes", arcaController.reportesComprobantes);

// Crear cierre diario (snapshot interno)
router.post("/cierre-diario", arcaController.crearCierreDiario);

// Listar cierres diarios entre fechas
router.get("/cierres-diarios", arcaController.listarCierresDiarios);

// Detalle de cierre diario por fecha (YYYY-MM-DD)
router.get("/cierres-diarios/:fecha", arcaController.detalleCierreDiario);

// ===== UI (EJS) =====

router.get("/", arcaController.vistaArcaIndex);

router.get("/pdf/:arcaId", arcaController.descargarPDFComprobante);

router.get("/receptor", arcaController.buscarReceptor);

router.post("/receptor/cache", arcaController.guardarReceptorCache);

router.get("/params/cond-iva-receptor", arcaController.paramsCondIvaReceptor);

router.get("/wsfe/consultar/:arcaId", arcaController.auditarWsfePorArcaId);
router.get("/wsfe/consultas/:arcaId", arcaController.listarWsfeConsultas);

router.post("/emitir-nc/:arcaIdOrigen", arcaController.emitirNotaCreditoPorArcaId);

module.exports = router;
