// routes/arcaRoutes.js
const express = require("express");
const router = express.Router();

const arcaController = require("../controllers/arcaController");

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

// ===== UI (EJS) =====

// Pantalla ARCA (si la montás como app.use('/arca', arcaRoutes) => esto queda en GET /arca)
router.get("/", arcaController.vistaArcaIndex);

router.get("/pdf/:arcaId", arcaController.descargarPDFComprobante);

router.get("/receptor", arcaController.buscarReceptor);

router.post("/receptor/cache", arcaController.guardarReceptorCache);

router.get("/params/cond-iva-receptor", arcaController.paramsCondIvaReceptor);

router.get("/wsfe/consultar/:arcaId", arcaController.auditarWsfePorArcaId);
router.get("/wsfe/consultas/:arcaId", arcaController.listarWsfeConsultas);

module.exports = router;
