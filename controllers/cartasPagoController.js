// controllers/cartasPagoController.js
// Autofaros — Controller de Cartas de Pago
'use strict';

const cartasPagoModel = require('../models/cartasPago');
const PDFDocument = require('pdfkit');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmtFecha(dateVal) {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function fmtMonto(val) {
  const n = parseFloat(val) || 0;
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─────────────────────────────────────────────────────────────────────────────
// API — DOCUMENTOS DISPONIBLES
// ─────────────────────────────────────────────────────────────────────────────

exports.documentosDisponibles = (req, res) => {
  const { proveedor_id, tipo } = req.query;

  if (!proveedor_id) {
    return res.status(400).json({ error: 'proveedor_id requerido' });
  }

  if (tipo === 'presupuesto') {
    cartasPagoModel.presupuestosDisponiblesPorProveedor(proveedor_id, (err, rows) => {
      if (err) {
        console.error('❌ Error documentos disponibles:', err);
        return res.status(500).json({ error: 'Error al obtener documentos' });
      }
      res.json(rows);
    });
  } else {
    // Por defecto: facturas
    cartasPagoModel.facturasDisponiblesPorProveedor(proveedor_id, (err, rows) => {
      if (err) {
        console.error('❌ Error documentos disponibles:', err);
        return res.status(500).json({ error: 'Error al obtener documentos' });
      }
      res.json(rows);
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API — CREAR CARTA
// ─────────────────────────────────────────────────────────────────────────────

exports.crearCarta = async (req, res) => {
  const {
    id_proveedor,
    fecha,
    administrador,
    observaciones,
    monto_efectivo,
    monto_transferencia,
    monto_cheque,
    banco_cheque,
    numero_cheque,
    fecha_cheque,
    total_documentos,
    total_pagado,
    items   // [{ tipo_documento, documento_id, numero_documento, fecha_documento, importe }]
  } = req.body;

  // Validaciones básicas
  if (!id_proveedor || !fecha || !administrador) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: proveedor, fecha, administrador' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Debe incluir al menos un documento' });
  }

  const cartaData = {
    id_proveedor,
    fecha,
    administrador,
    observaciones,
    monto_efectivo:      parseFloat(monto_efectivo)      || 0,
    monto_transferencia: parseFloat(monto_transferencia) || 0,
    monto_cheque:        parseFloat(monto_cheque)        || 0,
    banco_cheque,
    numero_cheque,
    fecha_cheque:        fecha_cheque || null,
    total_documentos:    parseFloat(total_documentos)    || 0,
    total_pagado:        parseFloat(total_pagado)        || 0,
    estado: 'emitida',
  };

  try {
    // 1. Insertar carta principal
    const { insertId, numero } = await new Promise((resolve, reject) => {
      cartasPagoModel.insertarCarta(cartaData, (err, insertId, numero) => {
        if (err) return reject(err);
        resolve({ insertId, numero });
      });
    });

    // 2. Insertar ítems
    await new Promise((resolve, reject) => {
      cartasPagoModel.insertarItems(insertId, items, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    res.json({ ok: true, insertId, numero });
  } catch (err) {
    console.error('❌ Error al crear carta de pago:', err);
    res.status(500).json({ error: 'Error al guardar la carta de pago' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API — LISTAR
// ─────────────────────────────────────────────────────────────────────────────

exports.listarCartas = (req, res) => {
  const filtros = {
    id_proveedor: req.query.proveedor_id || null,
    estado:       req.query.estado       || null,
    fecha_desde:  req.query.fecha_desde  || null,
    fecha_hasta:  req.query.fecha_hasta  || null,
  };

  cartasPagoModel.listarCartas(filtros, (err, rows) => {
    if (err) {
      console.error('❌ Error listarCartas:', err);
      return res.status(500).json({ error: 'Error al listar cartas' });
    }
    res.json(rows);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// API — OBTENER UNA
// ─────────────────────────────────────────────────────────────────────────────

exports.obtenerCarta = (req, res) => {
  cartasPagoModel.obtenerCartaPorId(req.params.id, (err, carta) => {
    if (err) {
      console.error('❌ Error obtenerCarta:', err);
      return res.status(500).json({ error: 'Error al obtener carta' });
    }
    if (!carta) return res.status(404).json({ error: 'Carta no encontrada' });
    res.json(carta);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// API — ANULAR
// ─────────────────────────────────────────────────────────────────────────────

exports.anularCarta = (req, res) => {
  cartasPagoModel.actualizarEstadoCarta(req.params.id, 'anulada', (err) => {
    if (err) {
      console.error('❌ Error anularCarta:', err);
      return res.status(500).json({ error: 'Error al anular' });
    }
    res.json({ ok: true });
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────────────────────

exports.generarPDF = (req, res) => {
  cartasPagoModel.obtenerCartaPorId(req.params.id, (err, carta) => {
    if (err || !carta) {
      return res.status(404).send('Carta no encontrada');
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="CartaPago_${carta.numero}.pdf"`);
    doc.pipe(res);

    // ── Paleta
    const DARK  = '#0b1220';
    const BLUE  = '#1F487E';
    const LIGHT = '#f0f4ff';
    const GRAY  = '#6b7a99';
    const LINE  = '#1e3054';

    const W = 595 - 100; // ancho útil

    // ── ENCABEZADO
    doc.rect(0, 0, 595, 90).fill(DARK);

    // Logo / empresa
    doc.fillColor(LIGHT)
       .font('Helvetica-Bold')
       .fontSize(22)
       .text('AUTOFAROS', 50, 28);

    doc.fillColor(BLUE)
       .font('Helvetica')
       .fontSize(9)
       .text('Sistema de Administración', 50, 54);

    // Número carta (derecha)
    doc.fillColor(LIGHT)
       .font('Helvetica-Bold')
       .fontSize(14)
       .text(carta.numero, 400, 28, { width: 145, align: 'right' });

    doc.fillColor(GRAY)
       .font('Helvetica')
       .fontSize(9)
       .text('CARTA DE PAGO', 400, 48, { width: 145, align: 'right' });

    doc.fillColor(GRAY)
       .text(`Fecha: ${fmtFecha(carta.fecha)}`, 400, 62, { width: 145, align: 'right' });

    let y = 110;

    // ── BLOQUE PROVEEDOR
    doc.rect(50, y, W, 14).fill(BLUE);
    doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(8)
       .text('DATOS DEL PROVEEDOR', 56, y + 3);
    y += 18;

    const prov = [
      ['Proveedor',   carta.nombre_proveedor || '-'],
      ['CUIT',        carta.cuit_proveedor   || '-'],
      ['Dirección',   [carta.direccion_proveedor, carta.ciudad_proveedor, carta.provincia_proveedor].filter(Boolean).join(', ') || '-'],
      ['Banco',       carta.banco_proveedor  || '-'],
      ['CBU',         carta.cbu_proveedor    || '-'],
      ['Alias',       carta.alias_proveedor  || '-'],
      ['Contacto',    carta.contacto_proveedor || '-'],
      ['Teléfono',    carta.telefono_proveedor || '-'],
    ];

    doc.font('Helvetica').fontSize(9);
    prov.forEach(([label, val]) => {
      doc.fillColor(GRAY).text(label + ':', 56, y, { width: 90, continued: false });
      doc.fillColor(DARK).text(val, 150, y, { width: W - 100 });
      y += 14;
    });

    y += 8;

    // ── BLOQUE DOCUMENTOS
    doc.rect(50, y, W, 14).fill(BLUE);
    doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(8)
       .text('DOCUMENTOS A ABONAR', 56, y + 3);
    y += 18;

    // Cabecera tabla
    doc.rect(50, y, W, 14).fill('#0e1929');
    const cols = { tipo: 56, numero: 120, fecha: 260, venc: 340, importe: 420 };
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(7.5);
    doc.text('TIPO',       cols.tipo,    y + 4);
    doc.text('N° DOCUMENTO', cols.numero, y + 4);
    doc.text('FECHA',      cols.fecha,   y + 4);
    doc.text('VENCIMIENTO', cols.venc,   y + 4);
    doc.text('IMPORTE',    cols.importe, y + 4, { width: 80, align: 'right' });
    y += 18;

    doc.font('Helvetica').fontSize(8.5);
    let subtotal = 0;
    carta.items.forEach((item, i) => {
      if (i % 2 === 0) doc.rect(50, y - 2, W, 16).fill('#f7f9ff');
      doc.fillColor(DARK);
      const tipo = item.tipo_documento === 'factura' ? 'Factura' : 'Presupuesto';
      doc.text(tipo,                 cols.tipo,    y);
      doc.text(item.numero_documento, cols.numero, y);
      doc.text(fmtFecha(item.fecha_documento), cols.fecha, y);
      doc.text('-',                  cols.venc,    y);
      const imp = parseFloat(item.importe) || 0;
      subtotal += imp;
      doc.text('$ ' + fmtMonto(imp), cols.importe, y, { width: 80, align: 'right' });
      y += 16;
    });

    // Línea de total documentos
    y += 4;
    doc.moveTo(50, y).lineTo(595 - 50, y).strokeColor(LINE).lineWidth(0.5).stroke();
    y += 8;
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(9)
       .text('TOTAL DOCUMENTOS', cols.numero, y);
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(10)
       .text('$ ' + fmtMonto(carta.total_documentos), cols.importe, y, { width: 80, align: 'right' });
    y += 22;

    // ── BLOQUE FORMA DE PAGO
    doc.rect(50, y, W, 14).fill(BLUE);
    doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(8)
       .text('FORMA DE PAGO', 56, y + 3);
    y += 18;

    const medios = [];
    if (parseFloat(carta.monto_efectivo) > 0)
      medios.push(['Efectivo', '$ ' + fmtMonto(carta.monto_efectivo)]);
    if (parseFloat(carta.monto_transferencia) > 0)
      medios.push(['Transferencia bancaria', '$ ' + fmtMonto(carta.monto_transferencia)]);
    if (parseFloat(carta.monto_cheque) > 0) {
      let chqLabel = 'Cheque';
      if (carta.banco_cheque) chqLabel += ` — ${carta.banco_cheque}`;
      if (carta.numero_cheque) chqLabel += ` N° ${carta.numero_cheque}`;
      if (carta.fecha_cheque) chqLabel += ` / Fecha: ${fmtFecha(carta.fecha_cheque)}`;
      medios.push([chqLabel, '$ ' + fmtMonto(carta.monto_cheque)]);
    }

    doc.font('Helvetica').fontSize(9);
    medios.forEach(([label, val]) => {
      doc.fillColor(GRAY).text(label + ':', 56, y, { width: 280 });
      doc.fillColor(DARK).font('Helvetica-Bold').text(val, cols.importe, y, { width: 80, align: 'right' });
      doc.font('Helvetica');
      y += 16;
    });

    // Total pagado
    y += 4;
    doc.rect(50, y, W, 28).fill('#0e1929');
    doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(10)
       .text('TOTAL A PAGAR', 56, y + 9);
    doc.fillColor('#4ade80').font('Helvetica-Bold').fontSize(13)
       .text('$ ' + fmtMonto(carta.total_pagado), cols.importe - 10, y + 7, { width: 100, align: 'right' });
    y += 40;

    // ── OBSERVACIONES
    if (carta.observaciones) {
      doc.rect(50, y, W, 14).fill(BLUE);
      doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(8).text('OBSERVACIONES', 56, y + 3);
      y += 18;
      doc.fillColor(DARK).font('Helvetica').fontSize(8.5)
         .text(carta.observaciones, 56, y, { width: W - 12 });
      y += doc.heightOfString(carta.observaciones, { width: W - 12 }) + 10;
    }

    // ── FIRMAS
    y = Math.max(y + 20, 680);
    doc.moveTo(56, y).lineTo(220, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.moveTo(375, y).lineTo(540, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.fillColor(GRAY).font('Helvetica').fontSize(8);
    doc.text('Firma Administrador', 56, y + 5, { width: 164, align: 'center' });
    doc.text(carta.nombre_proveedor ? `Firma ${carta.nombre_proveedor}` : 'Firma Proveedor', 375, y + 5, { width: 165, align: 'center' });

    // ── PIE
    const pageH = doc.page.height;
    doc.rect(0, pageH - 36, 595, 36).fill(DARK);
    doc.fillColor(GRAY).font('Helvetica').fontSize(7.5)
       .text(`Autofaros — ${carta.numero} — Administrador: ${carta.administrador} — Generado el ${fmtFecha(new Date())}`,
             50, pageH - 24, { width: 495, align: 'center' });

    doc.end();
  });
};
