// routes/arcaRoutes.js
const express = require("express");
const router = express.Router();

const arcaController = require("../controllers/arcaController");
const adminMiddleware = require("../middleware/adminMiddleware");

// ===== PASO 1: Modo seguro PROD (bloqueo de emisión) =====
function isTrue(v) {
  return ["1", "true", "yes", "on", "si"].includes(String(v || "").toLowerCase());
}

const ARCA_ENV = String(process.env.ARCA_ENV || "homo").toLowerCase();
const IS_PROD = /^prod\b/i.test(ARCA_ENV);
const PROD_LOCK = isTrue(process.env.ARCA_PROD_LOCK);

function prodEmitLock(req, res, next) {
  const arcaEnv = String(process.env.ARCA_ENV || "").toLowerCase();
  const lockOn = isTrue(process.env.ARCA_PROD_LOCK);

  const isProd = arcaEnv === "prod" || arcaEnv === "production";
  const isEmitPath =
    req.method === "POST" &&
    (req.path.startsWith("/emitir-desde-factura") || req.path.startsWith("/emitir-nc"));

  if (!isProd || !lockOn || !isEmitPath) return next();

  const confirmHeader = String(req.get("X-ARCA-CONFIRM") || "").trim().toUpperCase();
  if (confirmHeader === "SI") return next();

  return res.status(423).json({
    error: "ARCA_PROD_LOCK activo: emisión bloqueada en PRODUCCIÓN.",
    hint: "Para habilitar SOLO este request: enviar header X-ARCA-CONFIRM: SI",
    locked: true,
    env: arcaEnv,
    path: req.path,
  });
}

// IMPORTANTE: lock antes del adminMiddleware para poder evidenciar con curl aun sin sesión.
// (Con header SI pasa al adminMiddleware; sin header queda bloqueado 423.)
router.use(prodEmitLock);

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

// ===== Reportes / Cierre diario (JSON) =====
router.get("/reportes/resumen", arcaController.reportesResumen);
router.get("/reportes/comprobantes", arcaController.reportesComprobantes);

router.post("/cierres-diarios", arcaController.crearCierreDiario);
router.get("/cierres-diarios", arcaController.listarCierresDiarios);
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
