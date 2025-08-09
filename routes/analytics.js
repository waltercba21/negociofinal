const express = require('express');
const router = express.Router();
const analytics = require('../controllers/analyticsController');

router.post('/busquedas', analytics.logBusquedaTexto);
router.post('/busqueda-producto', analytics.logBusquedaProducto);

module.exports = router;