const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const { buscarProductoPorNombre } = require('../utils/chatbot');

router.post('/webhook', async (req, res) => {
  const mensaje = req.body.Body?.trim() || '';
  console.log("📩 Mensaje recibido:", mensaje);

  const twiml = new twilio.twiml.MessagingResponse();
  const respuesta = await buscarProductoPorNombre(mensaje);
  twiml.message(respuesta);

  res.type('text/xml').send(twiml.toString());
});

module.exports = router;
