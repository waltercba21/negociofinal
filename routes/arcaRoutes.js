// routes/arcaRoutes.js
const express = require("express");
const router = express.Router();

const arcaController = require("../controllers/arcaController");

// Emitir ARCA desde una factura existente del mostrador
router.post("/emitir-desde-factura/:id", arcaController.emitirDesdeFacturaMostrador);

// Ver estado ARCA por factura mostrador
router.get("/status/factura/:id", arcaController.statusPorFacturaMostrador);

module.exports = router;
