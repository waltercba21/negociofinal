const express = require('express');
const router = express.Router();
const reportes = require('../controllers/reportesController');

router.get('/recomendaciones', reportes.recomendacionesCompra);

module.exports = router;