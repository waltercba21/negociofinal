const express = require('express');
const router = express.Router();
const reportes = require('../controllers/reportesController');

router.get('/mas-vendidos', reportes.masVendidosView);     // vista con filtros (incluye "busqueda")
router.get('/recomendaciones', reportes.recomendacionesCompra);
router.get('/ventas-producto', reportes.ventasDeProducto);

module.exports = router;
