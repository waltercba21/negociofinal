// routes/arcaRoutes.js
const express = require("express");
const router = express.Router();

const arcaController = require("../controllers/arcaController");
const ensureAuthenticated = require("../middleware/usuarioMiddleware");
const adminEmails = require("../config/admins");

// ─── Middleware: solo admins ───────────────────────────────────────────────────
function soloAdmin(req, res, next) {
  if (!req.session.usuario || !adminEmails.includes(req.session.usuario.email)) {
    // API requests → JSON, UI requests → redirect
    if (req.xhr || (req.headers.accept || '').includes('application/json')) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    return res.status(403).send('Acceso denegado');
  }
  next();
}

// ===== Modo seguro PROD (bloqueo de emisión en producción) ===================
function isTrue(v) {
  return ["1", "true", "yes", "on", "si"].includes(String(v || "").toLowerCase());
}

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

function normalizeCbteTipoA(req, _res, next) {
  try {
    const cfgA = Number(process.env.ARCA_CBTE_TIPO_A || 1);
    const b = req.body || {};
    const t = Number(b.cbte_tipo || 0);
    if ((t === 1 || t === 51) && cfgA) {
      b.cbte_tipo = cfgA;
      req.body = b;
    }
  } catch (_) {}
  next();
}

// ===== Orden de middlewares globales =========================================
// 1) prodEmitLock primero (puede bloquear sin sesión con 423)
// 2) ensureAuthenticated (redirige al login si no hay sesión)
// 3) soloAdmin (bloquea con 403 si no es admin)
router.use(prodEmitLock);
router.use(ensureAuthenticated);
router.use(soloAdmin);

// ===== API (JSON) =============================================================

router.post("/emitir-desde-factura/:facturaId", normalizeCbteTipoA, arcaController.emitirDesdeFacturaMostrador);
router.get("/status/factura/:id", arcaController.statusPorFacturaMostrador);
router.get("/ui/facturas", arcaController.listarFacturasMostrador);
router.get("/ui/facturas/:id", arcaController.detalleFacturaMostrador);
router.get("/ui/arca-por-factura/:id", arcaController.historialArcaPorFactura);

// Reportes / Cierre diario
router.get("/reportes/resumen", arcaController.reportesResumen);
router.get("/reportes/comprobantes", arcaController.reportesComprobantes);
router.post("/cierres-diarios", arcaController.crearCierreDiario);
router.get("/cierres-diarios", arcaController.listarCierresDiarios);
router.get("/cierres-diarios/:fecha", arcaController.detalleCierreDiario);

// ===== UI (EJS) ==============================================================
router.get("/", arcaController.vistaArcaIndex);
router.get("/pdf/:arcaId", arcaController.descargarPDFComprobante);
router.get("/receptor", arcaController.buscarReceptor);
router.post("/receptor/cache", arcaController.guardarReceptorCache);
router.get("/params/cond-iva-receptor", arcaController.paramsCondIvaReceptor);
router.get("/wsfe/consultar/:arcaId", arcaController.auditarWsfePorArcaId);
router.get("/wsfe/consultas/:arcaId", arcaController.listarWsfeConsultas);
router.post("/emitir-nc/:arcaIdOrigen", arcaController.emitirNotaCreditoPorArcaId);
router.get("/reportes/ventas-diarias.pdf", arcaController.reporteVentasDiariasPdf);

module.exports = router;
