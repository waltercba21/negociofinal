// models/arcaModel.js
const pool = require("../config/conexion");
const util = require("util");

function getQuery() {
  // mysql2
  if (pool.promise && typeof pool.promise === "function") {
    return (sql, params = []) => pool.promise().query(sql, params).then(([rows]) => rows);
  }
  // mysql (callbacks)
  const q = util.promisify(pool.query).bind(pool);
  return (sql, params = []) => q(sql, params);
}
const query = getQuery();

async function crearComprobante(data) {
  const sql = `
    INSERT INTO arca_comprobantes
    (factura_mostrador_id, ambiente, cuit_emisor, pto_vta, cbte_tipo, cbte_nro, cbte_fch,
     doc_tipo, doc_nro, receptor_nombre, receptor_cond_iva_id,
     imp_total, imp_neto, imp_iva, imp_exento, mon_id, mon_cotiz,
     req_json, estado)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;
  const params = [
    data.factura_mostrador_id ?? null,
    data.ambiente,
    data.cuit_emisor,
    data.pto_vta,
    data.cbte_tipo,
    data.cbte_nro ?? null,
    data.cbte_fch,
    data.doc_tipo,
    data.doc_nro,
    data.receptor_nombre ?? null,
    data.receptor_cond_iva_id ?? null,
    data.imp_total,
    data.imp_neto,
    data.imp_iva,
    data.imp_exento ?? 0,
    data.mon_id ?? "PES",
    data.mon_cotiz ?? 1,
    data.req_json ?? null,
    data.estado ?? "PENDIENTE",
  ];

  const r = await query(sql, params);
  return r.insertId || (r[0] && r[0].insertId);
}


async function insertarItems(arcaId, items) {
  if (!items || !items.length) return 0;

  const sqlBase = `
    INSERT INTO arca_comprobante_items
    (arca_comprobante_id, producto_id, descripcion, cantidad, precio_unitario, bonif,
     iva_alicuota, imp_neto, imp_iva, imp_total)
    VALUES
  `;

  const placeholders = items.map(() => "(?,?,?,?,?,?,?,?,?,?)").join(",");
  const sql = sqlBase + placeholders;

  const params = [];
  for (const it of items) {
    params.push(
      arcaId,
      it.producto_id ?? null,
      it.descripcion,
      it.cantidad,
      it.precio_unitario,
      it.bonif ?? 0,
      it.iva_alicuota,
      it.imp_neto,
      it.imp_iva,
      it.imp_total
    );
  }

  const r = await query(sql, params);
  return r.affectedRows || 0;
}

async function actualizarRespuesta(arcaId, patch) {
  const sql = `
    UPDATE arca_comprobantes
    SET resultado=?, cae=?, cae_vto=?, obs_code=?, obs_msg=?, resp_xml=?,
        estado=?, updated_at=NOW()
    WHERE id=?
  `;
  const params = [
    patch.resultado ?? null,
    patch.cae ?? null,
    patch.cae_vto ?? null,
    patch.obs_code ?? null,
    patch.obs_msg ?? null,
    patch.resp_xml ?? null,
    patch.estado ?? null,
    arcaId,
  ];
  return query(sql, params);
}

async function buscarPorFacturaMostradorId(facturaId) {
  const rows = await query(
    `SELECT * FROM arca_comprobantes WHERE factura_mostrador_id=? ORDER BY id DESC LIMIT 1`,
    [facturaId]
  );
  return rows && rows[0] ? rows[0] : null;
}
async function buscarUltimoPorFacturaMostradorId(facturaId) {
  const rows = await query(
    `SELECT * FROM arca_comprobantes WHERE factura_mostrador_id=? ORDER BY id DESC LIMIT 1`,
    [facturaId]
  );
  return rows && rows[0] ? rows[0] : null;
}
async function buscarReceptorCache(doc_tipo, doc_nro) {
  const rows = await query(
    `SELECT doc_tipo, doc_nro, nombre, razon_social, cond_iva_id, domicilio, updated_at
     FROM arca_receptores_cache
     WHERE doc_tipo=? AND doc_nro=?
     LIMIT 1`,
    [doc_tipo, doc_nro]
  );
  return rows && rows[0] ? rows[0] : null;
}

async function upsertReceptorCache(data) {
  const sql = `
    INSERT INTO arca_receptores_cache
      (doc_tipo, doc_nro, nombre, razon_social, cond_iva_id, domicilio, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      nombre=VALUES(nombre),
      razon_social=VALUES(razon_social),
      cond_iva_id=VALUES(cond_iva_id),
      domicilio=VALUES(domicilio),
      updated_at=NOW()
  `;
  const params = [
    data.doc_tipo,
    data.doc_nro,
    data.nombre ?? null,
    data.razon_social ?? null,
    data.cond_iva_id ?? null,
    data.domicilio ?? null,
  ];
  return query(sql, params);
}

module.exports = {
  crearComprobante,
  insertarItems,
  actualizarRespuesta,
  buscarPorFacturaMostradorId,
  buscarUltimoPorFacturaMostradorId,
  buscarReceptorCache,
  upsertReceptorCache,
};

