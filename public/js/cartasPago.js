// models/cartasPago.js
// Autofaros — Modelo de Cartas de Pago
'use strict';

const conexion = require('../config/conexion');
const pool = conexion.pool || conexion;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el siguiente número de carta de pago.
 * Formato: CP-0001, CP-0002 … CP-9999, CP-10000 ...
 */
function generarNumeroCarta(callback) {
  const sql = `
    UPDATE cartas_pago_secuencia SET ultimo = ultimo + 1 WHERE id = 1;
  `;
  pool.query(sql, function (err) {
    if (err) return callback(err);
    pool.query('SELECT ultimo FROM cartas_pago_secuencia WHERE id = 1', function (err2, rows) {
      if (err2) return callback(err2);
      const n = rows[0].ultimo;
      const numero = 'CP-' + String(n).padStart(4, '0');
      callback(null, numero);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CREAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserta la carta de pago principal.
 * @param {Object} carta
 * @param {Function} callback(err, insertId)
 */
function insertarCarta(carta, callback) {
  generarNumeroCarta(function (err, numero) {
    if (err) return callback(err);

    const datos = {
      numero,
      id_proveedor:       carta.id_proveedor,
      fecha:              carta.fecha,
      administrador:      carta.administrador,
      observaciones:      carta.observaciones || null,
      monto_efectivo:     carta.monto_efectivo     || 0,
      monto_transferencia: carta.monto_transferencia || 0,
      monto_cheque:       carta.monto_cheque       || 0,
      banco_cheque:       carta.banco_cheque       || null,
      numero_cheque:      carta.numero_cheque      || null,
      fecha_cheque:       carta.fecha_cheque       || null,
      total_documentos:   carta.total_documentos   || 0,
      total_pagado:       carta.total_pagado       || 0,
      estado:             carta.estado             || 'borrador',
    };

    pool.query('INSERT INTO cartas_pago SET ?', datos, function (err2, result) {
      if (err2) return callback(err2);
      callback(null, result.insertId, numero);
    });
  });
}

/**
 * Inserta los ítems (documentos) de una carta de pago.
 * @param {number} cartaId
 * @param {Array}  items  [{ tipo_documento, documento_id, numero_documento, fecha_documento, importe }]
 * @param {Function} callback(err)
 */
function insertarItems(cartaId, items, callback) {
  if (!items || items.length === 0) return callback(null);

  const valores = items.map(item => [
    cartaId,
    item.tipo_documento,
    item.documento_id,
    item.numero_documento,
    item.fecha_documento,
    item.importe
  ]);

  const sql = `
    INSERT INTO cartas_pago_items
      (carta_pago_id, tipo_documento, documento_id, numero_documento, fecha_documento, importe)
    VALUES ?
  `;

  pool.query(sql, [valores], function (err) {
    callback(err || null);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista todas las cartas de pago con nombre de proveedor.
 * Filtros opcionales: id_proveedor, estado, fecha_desde, fecha_hasta
 */
function listarCartas(filtros, callback) {
  let sql = `
    SELECT cp.*, p.nombre AS nombre_proveedor
    FROM cartas_pago cp
    LEFT JOIN proveedores p ON p.id = cp.id_proveedor
    WHERE 1=1
  `;
  const params = [];

  if (filtros.id_proveedor) {
    sql += ' AND cp.id_proveedor = ?';
    params.push(filtros.id_proveedor);
  }
  if (filtros.estado) {
    sql += ' AND cp.estado = ?';
    params.push(filtros.estado);
  }
  if (filtros.fecha_desde) {
    sql += ' AND cp.fecha >= ?';
    params.push(filtros.fecha_desde);
  }
  if (filtros.fecha_hasta) {
    sql += ' AND cp.fecha <= ?';
    params.push(filtros.fecha_hasta);
  }

  sql += ' ORDER BY cp.id DESC LIMIT 200';

  pool.query(sql, params, callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER UNA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene la carta de pago con sus ítems y datos del proveedor.
 */
function obtenerCartaPorId(id, callback) {
  const sqlCarta = `
    SELECT cp.*,
           p.nombre    AS nombre_proveedor,
           p.cuit      AS cuit_proveedor,
           p.direccion AS direccion_proveedor,
           p.ciudad    AS ciudad_proveedor,
           p.provincia AS provincia_proveedor,
           p.banco     AS banco_proveedor,
           p.cbu       AS cbu_proveedor,
           p.alias     AS alias_proveedor,
           p.telefono  AS telefono_proveedor,
           p.mail      AS mail_proveedor,
           p.contacto  AS contacto_proveedor
    FROM cartas_pago cp
    LEFT JOIN proveedores p ON p.id = cp.id_proveedor
    WHERE cp.id = ?
  `;

  pool.query(sqlCarta, [id], function (err, rows) {
    if (err) return callback(err);
    if (!rows.length) return callback(null, null);

    const carta = rows[0];

    pool.query(
      'SELECT * FROM cartas_pago_items WHERE carta_pago_id = ? ORDER BY id',
      [id],
      function (err2, items) {
        if (err2) return callback(err2);
        carta.items = items;
        callback(null, carta);
      }
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTUALIZAR ESTADO
// ─────────────────────────────────────────────────────────────────────────────

function actualizarEstadoCarta(id, estado, callback) {
  pool.query(
    'UPDATE cartas_pago SET estado = ? WHERE id = ?',
    [estado, id],
    callback
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTOS PENDIENTES POR PROVEEDOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve las facturas pendientes de un proveedor que NO están en ninguna
 * carta de pago ya emitida o en borrador.
 */
function facturasDisponiblesPorProveedor(idProveedor, callback) {
  const sql = `
    SELECT f.id, 'factura' AS tipo, f.numero_factura AS numero_documento,
           f.fecha AS fecha_documento, f.importe_factura AS importe, f.fecha_pago
    FROM facturas f
    WHERE f.id_proveedor = ?
      AND f.condicion = 'pendiente'
      AND f.id NOT IN (
        SELECT cpi.documento_id
        FROM cartas_pago_items cpi
        INNER JOIN cartas_pago cp ON cp.id = cpi.carta_pago_id
        WHERE cpi.tipo_documento = 'factura'
          AND cp.estado IN ('borrador','emitida')
      )
    ORDER BY f.fecha_pago ASC, f.fecha ASC
  `;
  pool.query(sql, [idProveedor], callback);
}

/**
 * Devuelve los presupuestos pendientes de un proveedor disponibles para carta.
 */
function presupuestosDisponiblesPorProveedor(idProveedor, callback) {
  const sql = `
    SELECT p.id, 'presupuesto' AS tipo, p.numero_presupuesto AS numero_documento,
           p.fecha AS fecha_documento, p.importe AS importe, p.fecha_pago
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
// ELIMINAR
// ─────────────────────────────────────────────────────────────────────────────

function eliminarCarta(id, callback) {
  // Los ítems se eliminan en cascada
  pool.query('DELETE FROM cartas_pago WHERE id = ? AND estado = "borrador"', [id], callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  insertarCarta,
  insertarItems,
  listarCartas,
  obtenerCartaPorId,
  actualizarEstadoCarta,
  facturasDisponiblesPorProveedor,
  presupuestosDisponiblesPorProveedor,
  eliminarCarta,
};
