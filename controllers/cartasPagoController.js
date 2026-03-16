// controllers/cartasPagoController.js
// Autofaros — Controller de Cartas de Pago v2
'use strict';

const cartasPagoModel = require('../models/cartasPago');
const PDFDocument = require('pdfkit');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmtFecha(dateVal) {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d)) return '-';
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
  if (!proveedor_id) return res.status(400).json({ error: 'proveedor_id requerido' });

  const fn = tipo === 'presupuesto'
    ? cartasPagoModel.presupuestosDisponiblesPorProveedor
    : cartasPagoModel.facturasDisponiblesPorProveedor;

  fn(proveedor_id, (err, rows) => {
    if (err) {
      console.error('❌ Error documentos disponibles:', err);
      return res.status(500).json({ error: 'Error al obtener documentos' });
    }
    res.json(rows);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// API — NOTAS DE CRÉDITO DISPONIBLES
// ─────────────────────────────────────────────────────────────────────────────

exports.notasCreditoDisponibles = (req, res) => {
  const { proveedor_id } = req.query;
  if (!proveedor_id) return res.status(400).json({ error: 'proveedor_id requerido' });

  cartasPagoModel.notasCreditoDisponiblesPorProveedor(proveedor_id, (err, rows) => {
    if (err) {
      console.error('❌ Error notas de crédito disponibles:', err);
      return res.status(500).json({ error: 'Error al obtener notas de crédito' });
    }
    res.json(rows);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// API — CREAR CARTA
// ─────────────────────────────────────────────────────────────────────────────

exports.crearCarta = async (req, res) => {
  const {
    id_proveedor, fecha, administrador, observaciones,
    monto_efectivo, monto_transferencia, monto_cheque,
    banco_cheque, numero_cheque, fecha_cheque,
    total_documentos, total_pagado, items,
  } = req.body;

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
    banco_cheque:        banco_cheque || null,
    numero_cheque:       numero_cheque || null,
    fecha_cheque:        fecha_cheque || null,
    total_documentos:    parseFloat(total_documentos)    || 0,
    total_pagado:        parseFloat(total_pagado)        || 0,
    estado: 'emitida',
  };

  try {
    const { insertId, numero } = await new Promise((resolve, reject) => {
      cartasPagoModel.insertarCarta(cartaData, (err, insertId, numero) => {
        if (err) return reject(err);
        resolve({ insertId, numero });
      });
    });

    await new Promise((resolve, reject) => {
      cartasPagoModel.insertarItems(insertId, items, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // Actualizar saldos de facturas en segundo plano (no bloquea la respuesta)
    cartasPagoModel.actualizarSaldosFacturas(items, (err) => {
      if (err) console.error('⚠️ Error actualizando saldos de facturas:', err);
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
    if (err || !carta) return res.status(404).send('Carta no encontrada');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="CartaPago_${carta.numero}.pdf"`);
    doc.pipe(res);

    // ── Paleta
    const DARK  = '#0b1220';
    const BLUE  = '#1F487E';
    const LIGHT = '#f0f4ff';
    const GRAY  = '#6b7a99';
    const GREEN = '#4ade80';
    const LINE  = '#1e3054';
    const W     = 595 - 100;

    // ── ENCABEZADO ────────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 90).fill(DARK);

    doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(22).text('FAWA S.A.S', 50, 24);
    doc.fillColor(BLUE).font('Helvetica').fontSize(9).text('Sistema de Administración', 50, 50);
    doc.fillColor(GRAY).font('Helvetica').fontSize(8).text('Autofaros', 50, 63);

    doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(14)
       .text(carta.numero, 400, 24, { width: 145, align: 'right' });
    doc.fillColor(GRAY).font('Helvetica').fontSize(9)
       .text('CARTA DE PAGO', 400, 44, { width: 145, align: 'right' });
    doc.fillColor(GRAY)
       .text(`Fecha: ${fmtFecha(carta.fecha)}`, 400, 58, { width: 145, align: 'right' });
    doc.fillColor(GRAY)
       .text(`Administrador: ${carta.administrador}`, 400, 70, { width: 145, align: 'right' });

    let y = 108;

    // ── BLOQUE PROVEEDOR (solo nombre) ────────────────────────────────────────
    doc.rect(50, y, W, 14).fill(BLUE);
    doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(8).text('PROVEEDOR', 56, y + 3);
    y += 18;

    doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
       .text(carta.nombre_proveedor || '-', 56, y);
    y += 20;

    // ── BLOQUE DOCUMENTOS ─────────────────────────────────────────────────────
    doc.rect(50, y, W, 14).fill(BLUE);
    doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(8).text('DOCUMENTOS A ABONAR', 56, y + 3);
    y += 18;

    // Cabecera tabla
    const C = { tipo: 56, numero: 110, fecha: 225, importe: 295, nc: 365, abonado: 425, saldo: 480 };
    doc.rect(50, y, W, 13).fill('#0e1929');
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(7);
    doc.text('TIPO',        C.tipo,    y + 3);
    doc.text('N° DOC.',     C.numero,  y + 3);
    doc.text('FECHA',       C.fecha,   y + 3);
    doc.text('IMPORTE',     C.importe, y + 3, { width: 65, align: 'right' });
    doc.text('N. CRÉDITO',  C.nc,      y + 3, { width: 55, align: 'right' });
    doc.text('ABONADO',     C.abonado, y + 3, { width: 50, align: 'right' });
    doc.text('SALDO',       C.saldo,   y + 3, { width: 55, align: 'right' });
    y += 17;

    doc.font('Helvetica').fontSize(8);
    carta.items.forEach((item, i) => {
      if (i % 2 === 0) doc.rect(50, y - 2, W, 20).fill('#f4f6ff');
      doc.fillColor(DARK);

      const tipo        = item.tipo_documento === 'factura' ? 'Factura' : 'Presupuesto';
      const impOriginal = parseFloat(item.importe_original || item.importe) || 0;
      const ncImporte   = parseFloat(item.nota_credito_importe) || 0;
      const impAbonado  = parseFloat(item.importe_abonado) || 0;
      const esParcial   = item.tipo_pago === 'parcial';
      const netoPagar   = Math.max(impOriginal - ncImporte, 0);
      const saldoPend   = esParcial
        ? parseFloat(item.saldo_pendiente) || 0
        : Math.max(netoPagar - (parseFloat(item.importe_abonado) || netoPagar), 0);

      doc.text(tipo,                          C.tipo,    y, { width: 50 });
      doc.text(item.numero_documento || '-',  C.numero,  y, { width: 110 });
      doc.text(fmtFecha(item.fecha_documento), C.fecha,  y, { width: 65 });

      doc.text('$ ' + fmtMonto(impOriginal),  C.importe, y, { width: 65, align: 'right' });

      if (ncImporte > 0) {
        // Número de NC en primera línea (amarillo, negrita)
        doc.fillColor('#fbbf24').font('Helvetica-Bold').fontSize(7);
        doc.text(item.numero_nota_credito || 'NC', C.nc, y, { width: 55, align: 'right' });
        // Monto en segunda línea
        doc.font('Helvetica').fontSize(8);
        doc.text('- $ ' + fmtMonto(ncImporte), C.nc, y + 9, { width: 55, align: 'right' });
        doc.fillColor(DARK);
      } else {
        doc.text('-', C.nc, y, { width: 55, align: 'right' });
      }

      doc.text('$ ' + fmtMonto(impAbonado), C.abonado, y, { width: 50, align: 'right' });

      if (esParcial) {
        if (saldoPend > 0.009) {
          // Pago parcial con saldo real pendiente
          doc.fillColor('#ff6b6b').font('Helvetica-Bold');
          doc.text('$ ' + fmtMonto(saldoPend), C.saldo, y, { width: 55, align: 'right' });
          doc.fillColor(DARK).font('Helvetica');
        } else {
          // Pago parcial que cubre todo
          doc.fillColor(GREEN).font('Helvetica-Bold');
          doc.text('Cancelada', C.saldo, y, { width: 55, align: 'right' });
          doc.fillColor(DARK).font('Helvetica');
        }
      } else {
        // Pago total: depende del monto efectivamente pagado en esta carta
        // Si importe_abonado >= neto => cancelada, si no => a cuenta
        const netoPDF = Math.max(impOriginal - ncImporte, 0);
        const abonadoPDF = parseFloat(item.importe_abonado) || netoPDF;
        const saldoReal = parseFloat((netoPDF - abonadoPDF).toFixed(2));
        if (saldoReal <= 0.009) {
          doc.fillColor(GREEN).font('Helvetica-Bold');
          doc.text('Cancelada', C.saldo, y, { width: 55, align: 'right' });
          doc.fillColor(DARK).font('Helvetica');
        } else {
          doc.fillColor('#fbbf24').font('Helvetica-Bold');
          doc.text('A cuenta', C.saldo, y, { width: 55, align: 'right' });
          doc.fillColor(DARK).font('Helvetica');
        }
      }

      y += 20;
    });

    // Subtotales
    y += 4;
    doc.moveTo(50, y).lineTo(595 - 50, y).strokeColor(LINE).lineWidth(0.5).stroke();
    y += 8;
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8.5)
       .text('TOTAL DOCUMENTOS', C.numero, y);
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(9)
       .text('$ ' + fmtMonto(carta.total_documentos), C.importe, y, { width: 65, align: 'right' });
    y += 20;

    // ── FORMA DE PAGO ─────────────────────────────────────────────────────────
    doc.rect(50, y, W, 14).fill(BLUE);
    doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(8).text('FORMA DE PAGO', 56, y + 3);
    y += 18;

    const medios = [];
    if (parseFloat(carta.monto_efectivo) > 0)
      medios.push(['Efectivo', fmtMonto(carta.monto_efectivo)]);
    if (parseFloat(carta.monto_transferencia) > 0)
      medios.push(['Transferencia bancaria', fmtMonto(carta.monto_transferencia)]);
    if (parseFloat(carta.monto_cheque) > 0) {
      let lbl = 'Cheque';
      if (carta.banco_cheque)  lbl += ` — ${carta.banco_cheque}`;
      if (carta.numero_cheque) lbl += ` N° ${carta.numero_cheque}`;
      if (carta.fecha_cheque)  lbl += ` / ${fmtFecha(carta.fecha_cheque)}`;
      medios.push([lbl, fmtMonto(carta.monto_cheque)]);
    }

    doc.font('Helvetica').fontSize(9);
    medios.forEach(([label, val]) => {
      doc.fillColor(GRAY).text(label + ':', 56, y, { width: 280 });
      doc.fillColor(DARK).font('Helvetica-Bold').text('$ ' + val, C.saldo, y, { width: 55, align: 'right' });
      doc.font('Helvetica');
      y += 20;
    });

    // Total pagado
    y += 6;
    doc.rect(50, y, W, 30).fill('#0a1628');
    doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(10).text('TOTAL ABONADO EN ESTA CARTA', 56, y + 10);
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(14)
       .text('$ ' + fmtMonto(carta.total_pagado), C.saldo - 20, y + 8, { width: 85, align: 'right' });
    y += 42;

    // ── OBSERVACIONES ─────────────────────────────────────────────────────────
    if (carta.observaciones) {
      doc.rect(50, y, W, 14).fill(BLUE);
      doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(8).text('OBSERVACIONES', 56, y + 3);
      y += 18;
      doc.fillColor(DARK).font('Helvetica').fontSize(8.5)
         .text(carta.observaciones, 56, y, { width: W - 12 });
      y += doc.heightOfString(carta.observaciones, { width: W - 12 }) + 10;
    }

    // ── FIRMAS ────────────────────────────────────────────────────────────────
    y = Math.max(y + 24, 680);
    doc.moveTo(56, y).lineTo(230, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.moveTo(375, y).lineTo(540, y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.fillColor(GRAY).font('Helvetica').fontSize(8);
    doc.text('Firma Administrador / FAWA S.A.S', 56, y + 5, { width: 174, align: 'center' });
    doc.text(`Firma / ${carta.nombre_proveedor || 'Proveedor'}`, 375, y + 5, { width: 165, align: 'center' });

    // ── PIE ───────────────────────────────────────────────────────────────────
    const pageH = doc.page.height;
    doc.rect(0, pageH - 32, 595, 32).fill(DARK);
    doc.fillColor(GRAY).font('Helvetica').fontSize(7.5)
       .text(
         `FAWA S.A.S — ${carta.numero} — Emitido el ${fmtFecha(new Date())}`,
         50, pageH - 20, { width: 495, align: 'center' }
       );

    doc.end();
  });
};