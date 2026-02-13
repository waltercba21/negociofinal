// routes/arcaRoutes.js
const express = require("express");
const router = express.Router();

const arcaController = require("../controllers/arcaController");
const adminMiddleware = require("../middleware/adminMiddleware");

// Protege TODO /arca (UI + API)
router.use(adminMiddleware);

// Si falta una función en el controller, NO rompas el server
const safe = (fn) =>
  (typeof fn === "function")
    ? fn
    : (req, res) => res.status(501).json({ error: "Endpoint ARCA no implementado en el servidor" });

// ===== API (JSON) =====

// Emitir ARCA desde una factura existente del mostrador
router.post("/emitir-desde-factura/:id", safe(arcaController.emitirDesdeFacturaMostrador));

// Ver estado ARCA (último) por factura mostrador
router.get("/status/factura/:id", safe(arcaController.statusPorFacturaMostrador));

// Listar últimas facturas del mostrador (para UI)
router.get("/ui/facturas", safe(arcaController.listarFacturasMostrador));

// Detalle de una factura del mostrador (cabecera + items)
router.get("/ui/facturas/:id", safe(arcaController.detalleFacturaMostrador));

// Historial ARCA por factura del mostrador
router.get("/ui/arca-por-factura/:id", safe(arcaController.historialArcaPorFactura));

// ===== Reportes / Cierre diario =====
router.get("/reportes/resumen", safe(arcaController.reportesResumen));
router.get("/reportes/comprobantes", safe(arcaController.reportesComprobantes));
router.post("/cierre-diario", safe(arcaController.crearCierreDiario));
router.get("/cierres-diarios", safe(arcaController.listarCierresDiarios));
router.get("/cierres-diarios/:fecha", safe(arcaController.detalleCierreDiario));

// ===== UI (EJS) =====
router.get("/", safe(arcaController.vistaArcaIndex));

router.get("/pdf/:arcaId", safe(arcaController.descargarPDFComprobante));
router.get("/receptor", safe(arcaController.buscarReceptor));
router.post("/receptor/cache", safe(arcaController.guardarReceptorCache));
router.get("/params/cond-iva-receptor", safe(arcaController.paramsCondIvaReceptor));

router.get("/wsfe/consultar/:arcaId", safe(arcaController.auditarWsfePorArcaId));
router.get("/wsfe/consultas/:arcaId", safe(arcaController.listarWsfeConsultas));

router.post("/emitir-nc/:arcaIdOrigen", safe(arcaController.emitirNotaCreditoPorArcaId));

module.exports = router;
