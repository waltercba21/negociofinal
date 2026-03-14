// models/cartasPago.js
// Autofaros — Modelo de Cartas de Pago v2
'use strict';

const conexion = require('../config/conexion');
const pool = conexion.pool || conexion;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza cualquier valor de fecha a 'YYYY-MM-DD' para MySQL.
 */
function toSQLDate(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    return val.split('T')[0];
  }
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

/**
 * Genera el siguiente número de carta de pago: CP-0001, CP-0002 ...
 */
function generarNumeroCarta(callback) {
  pool.query('UPDATE cartas_pago_secuencia SET ultimo = ultimo + 1 WHERE id = 1', function (err) {
    if (err) return callback(err);
    pool.query('SELECT ultimo FROM cartas_pago_secuencia WHERE id = 1', function (err2, rows) {
      if (err2) return callback(err2);
      const numero = 'CP-' + String(rows[0].ultimo).padStart(4, '0');
      callback(null, numero);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CREAR CARTA
// ─────────────────────────────────────────────────────────────────────────────

function insertarCarta(carta, callback) {
  generarNumeroCarta(function (err, numero) {
    if (err) return callback(err);

    const datos = {
      numero,
      id_proveedor:        carta.id_proveedor,
      fecha:               toSQLDate(carta.fecha),
      administrador:       carta.administrador,
      observaciones:       carta.observaciones || null,
      monto_efectivo:      carta.monto_efectivo      || 0,
      monto_transferencia: carta.monto_transferencia || 0,
      monto_cheque:        carta.monto_cheque        || 0,
      banco_cheque:        carta.banco_cheque        || null,
      numero_cheque:       carta.numero_cheque       || null,
      fecha_cheque:        toSQLDate(carta.fecha_cheque) || null,
      total_documentos:    carta.total_documentos    || 0,
      total_pagado:        carta.total_pagado        || 0,
      estado:              carta.estado              || 'emitida',
    };

    pool.query('INSERT INTO cartas_pago SET ?', datos, function (err2, result) {
      if (err2) return callback(err2);
      callback(null, result.insertId, numero);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INSERTAR ÍTEMS (con nota de crédito, tipo de pago y saldo)
// ─────────────────────────────────────────────────────────────────────────────

function insertarItems(cartaId, items, callback) {
  if (!items || items.length === 0) return callback(null);

  const valores = items.map(item => {
    const importeOriginal  = parseFloat(item.importe_original || item.importe) || 0;
    const ncImporte        = parseFloat(item.nota_credito_importe) || 0;
    const importeAbonado   = parseFloat(item.importe_abonado) || (importeOriginal - ncImporte);
    const saldoPendiente   = parseFloat(item.saldo_pendiente) || 0;
    const tipoPago         = item.tipo_pago || 'total';

    return [
      cartaId,
      item.tipo_documento,
      item.documento_id,
      item.numero_documento,
      toSQLDate(item.fecha_documento),
      importeOriginal,
      item.nota_credito_id   || null,
      ncImporte,
      tipoPago,
      importeAbonado,
      saldoPendiente,
    ];
  });

  const sql = `
    INSERT INTO cartas_pago_items
      (carta_pago_id, tipo_documento, documento_id, numero_documento,
       fecha_documento, importe_original, nota_credito_id, nota_credito_importe,
       tipo_pago, importe_abonado, saldo_pendiente)
    VALUES ?
  `;

  pool.query(sql, [valores], function (err) {
    if (err) return callback(err);
    callback(null);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTUALIZAR SALDO DE FACTURAS (después de crear la carta)
// Registra o actualiza cuánto se ha abonado de cada factura
// ─────────────────────────────────────────────────────────────────────────────

function actualizarSaldosFacturas(items, callback) {
  const facturasItems = items.filter(i => i.tipo_documento === 'factura');
  if (!facturasItems.length) return callback(null);

  let pending = facturasItems.length;
  let firstErr = null;

  facturasItems.forEach(item => {
    const importeOriginal = parseFloat(item.importe_original || item.importe) || 0;
    const importeAbonado  = parseFloat(item.importe_abonado) || importeOriginal;
    const saldoPendiente  = parseFloat(item.saldo_pendiente) || 0;

    // Upsert: si ya existe el saldo, suma el abono y recalcula pendiente
    const sql = `
      INSERT INTO facturas_saldo (factura_id, importe_original, total_abonado, saldo_pendiente)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_abonado   = total_abonado + VALUES(total_abonado),
        saldo_pendiente = importe_original - (total_abonado + VALUES(total_abonado))
    `;

    pool.query(sql, [item.documento_id, importeOriginal, importeAbonado, saldoPendiente], (err) => {
      if (err && !firstErr) firstErr = err;
      pending--;
      if (pending === 0) callback(firstErr);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR CARTAS
// ─────────────────────────────────────────────────────────────────────────────

function listarCartas(filtros, callback) {
  let sql = `
    SELECT cp.*, p.nombre AS nombre_proveedor
    FROM cartas_pago cp
    LEFT JOIN proveedores p ON p.id = cp.id_proveedor
    WHERE 1=1
  `;
  const params = [];

  if (filtros.id_proveedor) { sql += ' AND cp.id_proveedor = ?'; params.push(filtros.id_proveedor); }
  if (filtros.estado)       { sql += ' AND cp.estado = ?';       params.push(filtros.estado); }
  if (filtros.fecha_desde)  { sql += ' AND cp.fecha >= ?';       params.push(filtros.fecha_desde); }
  if (filtros.fecha_hasta)  { sql += ' AND cp.fecha <= ?';       params.push(filtros.fecha_hasta); }

  sql += ' ORDER BY cp.id DESC LIMIT 200';
  pool.query(sql, params, callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER UNA CARTA (con ítems)
// ─────────────────────────────────────────────────────────────────────────────

function obtenerCartaPorId(id, callback) {
  const sqlCarta = `
    SELECT cp.*, p.nombre AS nombre_proveedor
    FROM cartas_pago cp
    LEFT JOIN proveedores p ON p.id = cp.id_proveedor
    WHERE cp.id = ?
  `;

  pool.query(sqlCarta, [id], function (err, rows) {
    if (err) return callback(err);
    if (!rows.length) return callback(null, null);

    const carta = rows[0];

    const sqlItems = `
      SELECT cpi.*,
             nc.numero_nota_credito
      FROM cartas_pago_items cpi
      LEFT JOIN notas_credito nc ON nc.id = cpi.nota_credito_id
      WHERE cpi.carta_pago_id = ?
      ORDER BY cpi.id
    `;

    pool.query(sqlItems, [id], function (err2, items) {
      if (err2) return callback(err2);
      carta.items = items;
      callback(null, carta);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTUALIZAR ESTADO
// ─────────────────────────────────────────────────────────────────────────────

function actualizarEstadoCarta(id, estado, callback) {
  pool.query('UPDATE cartas_pago SET estado = ? WHERE id = ?', [estado, id], callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTOS DISPONIBLES POR PROVEEDOR
// Incluye saldo pendiente real si existen pagos parciales previos
// ─────────────────────────────────────────────────────────────────────────────

function facturasDisponiblesPorProveedor(idProveedor, callback) {
  const sql = `
    SELECT
      f.id,
      'factura'          AS tipo,
      f.numero_factura   AS numero_documento,
      f.fecha            AS fecha_documento,
      f.importe_factura  AS importe,
      f.fecha_pago,
      -- Saldo real: usa facturas_saldo si existe, si no usa importe_factura completo
      COALESCE(fs.saldo_pendiente, f.importe_factura) AS saldo_pendiente,
      COALESCE(fs.total_abonado, 0)                   AS total_abonado
    FROM facturas f
    LEFT JOIN facturas_saldo fs ON fs.factura_id = f.id
    WHERE f.id_proveedor = ?
      AND f.condicion = 'pendiente'
      -- Excluir facturas que ya están en una carta activa con pago total
      AND f.id NOT IN (
        SELECT cpi.documento_id
        FROM cartas_pago_items cpi
        INNER JOIN cartas_pago cp ON cp.id = cpi.carta_pago_id
        WHERE cpi.tipo_documento = 'factura'
          AND cpi.tipo_pago = 'total'
          AND cp.estado IN ('borrador','emitida')
      )
      -- Excluir facturas con saldo = 0 (totalmente pagadas)
      AND COALESCE(fs.saldo_pendiente, f.importe_factura) > 0
    ORDER BY f.fecha_pago ASC, f.fecha ASC
  `;
  pool.query(sql, [idProveedor], callback);
}

function presupuestosDisponiblesPorProveedor(idProveedor, callback) {
  const sql = `
    SELECT
      p.id,
      'presupuesto'           AS tipo,
      p.numero_presupuesto    AS numero_documento,
      p.fecha                 AS fecha_documento,
      p.importe               AS importe,
      p.fecha_pago,
      p.importe               AS saldo_pendiente,
      0                       AS total_abonado
    FROM presupuestos p
    WHERE p.id_proveedor = ?
      AND p.condicion = 'pendiente'
      AND p.id NOT IN (
        SELECT cpi.documento_id
        FROM cartas_pago_items cpi
        INNER JOIN cartas_pago cp ON cp.id = cpi.carta_pago_id
        WHERE cpi.tipo_documento = 'presupuesto'
          AND cp.estado IN ('borrador','emitida')
      )
    ORDER BY p.fecha_pago ASC, p.fecha ASC
  `;
  pool.query(sql, [idProveedor], callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTAS DE CRÉDITO DISPONIBLES POR PROVEEDOR
// ─────────────────────────────────────────────────────────────────────────────

function notasCreditoDisponiblesPorProveedor(idProveedor, callback) {
  const sql = `
    SELECT nc.id, nc.numero_nota_credito, nc.fecha, nc.importe_total, nc.tipo
    FROM notas_credito nc
    WHERE nc.id_proveedor = ?
      AND nc.id NOT IN (
        SELECT cpi.nota_credito_id
        FROM cartas_pago_items cpi
        INNER JOIN cartas_pago cp ON cp.id = cpi.carta_pago_id
        WHERE cpi.nota_credito_id IS NOT NULL
          AND cp.estado IN ('borrador','emitida')
      )
    ORDER BY nc.fecha DESC
  `;
  pool.query(sql, [idProveedor], callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// ELIMINAR (solo borradores)
// ─────────────────────────────────────────────────────────────────────────────

function eliminarCarta(id, callback) {
  pool.query('DELETE FROM cartas_pago WHERE id = ? AND estado = "borrador"', [id], callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  insertarCarta,
  insertarItems,
  actualizarSaldosFacturas,
  listarCartas,
  obtenerCartaPorId,
  actualizarEstadoCarta,
  facturasDisponiblesPorProveedor,
  presupuestosDisponiblesPorProveedor,
  notasCreditoDisponiblesPorProveedor,
  eliminarCarta,
};