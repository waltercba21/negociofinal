// models/arcaModel.js
const pool = require("../config/conexion");
const util = require("util");
const crypto = require("crypto");

const FACT_TIPOS = [1, 6, 11];   
const NC_TIPOS   = [3, 8, 13];   


function getQuery(poolOverride) {
  const p = poolOverride || pool;
  return async (sql, params = []) => {
    const [rows] = await p.promise().query(sql, params);
    return rows;
  };
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

async function buscarPorId(id) {
  const rows = await query(`SELECT * FROM arca_comprobantes WHERE id=? LIMIT 1`, [id]);
  return rows && rows[0] ? rows[0] : null;
}

async function listarItemsPorArcaId(arcaId) {
  return query(
    `SELECT id, producto_id, descripcion, cantidad, precio_unitario, bonif, iva_alicuota, imp_neto, imp_iva, imp_total
     FROM arca_comprobante_items
     WHERE arca_comprobante_id=?
     ORDER BY id ASC`,
    [arcaId]
  );
}

async function buscarUltimoPorFacturaMostradorId(facturaId) {
  const rows = await query(
    `SELECT * FROM arca_comprobantes WHERE factura_mostrador_id=? ORDER BY id DESC LIMIT 1`,
    [facturaId]
  );
  return rows && rows[0] ? rows[0] : null;
}

// ---- Receptor cache ----
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
      cond_iva_id = IFNULL(VALUES(cond_iva_id), cond_iva_id),
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

// ---- Asociaciones (NC/ND) ----
async function insertarAsocCbte(data) {
  const sql = `
    INSERT INTO arca_cbtes_asoc
      (arca_comprobante_id, asociado_arca_id, asoc_pto_vta, asoc_cbte_tipo, asoc_cbte_nro, asoc_cbte_fch, asoc_cuit)
    VALUES (?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      asociado_arca_id=VALUES(asociado_arca_id),
      asoc_pto_vta=VALUES(asoc_pto_vta),
      asoc_cbte_tipo=VALUES(asoc_cbte_tipo),
      asoc_cbte_nro=VALUES(asoc_cbte_nro),
      asoc_cbte_fch=VALUES(asoc_cbte_fch),
      asoc_cuit=VALUES(asoc_cuit)
  `;
  const params = [
    data.arca_comprobante_id,
    data.asociado_arca_id,
    data.asoc_pto_vta,
    data.asoc_cbte_tipo,
    data.asoc_cbte_nro,
    data.asoc_cbte_fch,
    data.asoc_cuit,
  ];
  return query(sql, params);
}

async function sumarTotalEmitidoAsociado(asociado_arca_id) {
  const rows = await query(
    `SELECT COALESCE(SUM(c.imp_total),0) AS total
     FROM arca_cbtes_asoc a
     JOIN arca_comprobantes c ON c.id=a.arca_comprobante_id
     WHERE a.asociado_arca_id=? AND c.estado='EMITIDO'`,
    [asociado_arca_id]
  );
  return rows && rows[0] ? Number(rows[0].total || 0) : 0;
}

// ---- Auditoría WSFE ----
async function insertarWsfeConsulta({ arca_comprobante_id, ok, parsed_json, resp_xml }) {
  const sql = `
    INSERT INTO arca_wsfe_consultas (arca_comprobante_id, ok, parsed_json, resp_xml)
    VALUES (?, ?, ?, ?)
  `;
  const params = [
    arca_comprobante_id,
    ok ? 1 : 0,
    parsed_json ? JSON.stringify(parsed_json) : null,
    resp_xml || null,
  ];
  return query(sql, params);
}

async function listarWsfeConsultas(arca_comprobante_id, limit = 20) {
  const sql = `
    SELECT id, ok, parsed_json, created_at
    FROM arca_wsfe_consultas
    WHERE arca_comprobante_id=?
    ORDER BY id DESC
    LIMIT ?
  `;
  return query(sql, [arca_comprobante_id, Number(limit)]);
}
async function reportesComprobantes(pool, {
  ambiente,
  cuit_emisor,
  pto_vta,
  desdeYmd,
  hastaYmd,
  estado = "EMITIDO",
  cbte_tipo = null
}) {
  const q = getQuery(pool);


  let sql = `
    SELECT
      id, estado, ambiente, cuit_emisor, pto_vta,
      cbte_tipo, cbte_nro, cbte_fch, cae, cae_vto,
      doc_tipo, doc_nro, receptor_nombre,
      imp_total, imp_neto, imp_iva, created_at
    FROM arca_comprobantes
    WHERE ambiente=? AND cuit_emisor=? AND pto_vta=?
      AND cbte_fch BETWEEN ? AND ?
  `;
  const params = [ambiente, cuit_emisor, Number(pto_vta), desdeYmd, hastaYmd];

  if (estado) { sql += ` AND estado=?`; params.push(estado); }
  if (cbte_tipo) { sql += ` AND cbte_tipo=?`; params.push(Number(cbte_tipo)); }

  sql += ` ORDER BY cbte_fch DESC, cbte_tipo ASC, cbte_nro ASC`;

  return await q(sql, params);
}

async function reportesResumen(pool, {
  ambiente,
  cuit_emisor,
  pto_vta,
  desdeYmd,
  hastaYmd,
  estado = "EMITIDO",
}) {
  const q = getQuery(pool);


  const factList = FACT_TIPOS.join(",");
  const ncList   = NC_TIPOS.join(",");

  let sql = `
    SELECT
      cbte_fch AS fecha_ymd,
      SUM(CASE WHEN cbte_tipo IN (${factList}) THEN 1 ELSE 0 END) AS cant_facturas,
      SUM(CASE WHEN cbte_tipo IN (${ncList})   THEN 1 ELSE 0 END) AS cant_nc,

      COALESCE(SUM(CASE WHEN cbte_tipo IN (${factList}) THEN imp_total ELSE 0 END),0) AS total_facturas,
      COALESCE(SUM(CASE WHEN cbte_tipo IN (${ncList})   THEN imp_total ELSE 0 END),0) AS total_nc,
      (COALESCE(SUM(CASE WHEN cbte_tipo IN (${factList}) THEN imp_total ELSE 0 END),0) -
       COALESCE(SUM(CASE WHEN cbte_tipo IN (${ncList})   THEN imp_total ELSE 0 END),0)) AS ventas_netas,

      COALESCE(SUM(CASE WHEN cbte_tipo IN (${factList}) THEN imp_neto ELSE 0 END),0) AS neto_facturas,
      COALESCE(SUM(CASE WHEN cbte_tipo IN (${ncList})   THEN imp_neto ELSE 0 END),0) AS neto_nc,
      (COALESCE(SUM(CASE WHEN cbte_tipo IN (${factList}) THEN imp_neto ELSE 0 END),0) -
       COALESCE(SUM(CASE WHEN cbte_tipo IN (${ncList})   THEN imp_neto ELSE 0 END),0)) AS neto_neto,

      COALESCE(SUM(CASE WHEN cbte_tipo IN (${factList}) THEN imp_iva ELSE 0 END),0) AS iva_facturas,
      COALESCE(SUM(CASE WHEN cbte_tipo IN (${ncList})   THEN imp_iva ELSE 0 END),0) AS iva_nc,
      (COALESCE(SUM(CASE WHEN cbte_tipo IN (${factList}) THEN imp_iva ELSE 0 END),0) -
       COALESCE(SUM(CASE WHEN cbte_tipo IN (${ncList})   THEN imp_iva ELSE 0 END),0)) AS iva_neto

    FROM arca_comprobantes
    WHERE ambiente=? AND cuit_emisor=? AND pto_vta=?
      AND cbte_fch BETWEEN ? AND ?
  `;
  const params = [ambiente, cuit_emisor, Number(pto_vta), desdeYmd, hastaYmd];

  if (estado) { sql += ` AND estado=?`; params.push(estado); }

  sql += ` GROUP BY cbte_fch ORDER BY cbte_fch ASC`;

  return await q(sql, params);
}

async function crearCierreDiario(pool, {
  ambiente,
  cuit_emisor,
  pto_vta,
  fechaYmd,
  usuario_email = null,
}) {
const q = getQuery(pool);


  // 1) Tomamos snapshot del día (emitidos)
  const resumenArr = await reportesResumen(pool, {
    ambiente, cuit_emisor, pto_vta,
    desdeYmd: fechaYmd, hastaYmd: fechaYmd,
    estado: "EMITIDO",
  });

  const resumen = resumenArr[0] || {
    fecha_ymd: fechaYmd,
    cant_facturas: 0, cant_nc: 0,
    total_facturas: 0, total_nc: 0, ventas_netas: 0,
    neto_facturas: 0, neto_nc: 0, neto_neto: 0,
    iva_facturas: 0, iva_nc: 0, iva_neto: 0,
  };

  const comprobantes = await reportesComprobantes(pool, {
    ambiente, cuit_emisor, pto_vta,
    desdeYmd: fechaYmd, hastaYmd: fechaYmd,
    estado: "EMITIDO",
  });

  const snapshot = {
    fechaYmd,
    ambiente,
    cuit_emisor,
    pto_vta: Number(pto_vta),
    resumen,
    comprobantes,
  };

  const snapshotStr = JSON.stringify(snapshot);
  const sha256 = crypto.createHash("sha256").update(snapshotStr).digest("hex");

  // 2) Insert (con UNIQUE: si existe, MySQL tirará duplicate)
const sqlIns = `
  INSERT INTO arca_cierres_diarios (
    ambiente, cuit_emisor, pto_vta, fecha,
    total_cbtes, total_emitidos, total_rechazados, total_neto, total_iva, total_total,
    snapshot_sha256, snapshot_json, arca_ids_json,
    usuario_email, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, CAST(? AS JSON), CAST(? AS JSON),
    ?, NOW(), NOW()
  )
`;

const paramsIns = [
  ambiente, cuit_emisor, pto_vta, fechaYmd,
  Number(totales.cbtes || 0),
  Number(totales.emitidos || 0),
  Number(totales.rechazados || 0),
  Number(totales.neto || 0),
  Number(totales.iva || 0),
  Number(totales.total || 0),
  sha,
  snapshotJson,
  arcaIdsJson,
  usuario_email || null,
];


  const r = await q(sql, params);
  return { id: r.insertId, sha256, resumen, cant_cbtes: comprobantes.length };
}

async function listarCierresDiarios(pool, {
  ambiente,
  cuit_emisor,
  pto_vta,
  desdeYmd,
  hastaYmd,
}) {
  const q = getQuery(pool);


  const sql = `
    SELECT
      id, ambiente, cuit_emisor, pto_vta, fecha, created_at, usuario_email,
      cant_facturas, cant_nc,
      total_facturas, total_nc, ventas_netas
    FROM arca_cierres_diarios
    WHERE ambiente=? AND cuit_emisor=? AND pto_vta=?
      AND fecha BETWEEN ? AND ?
    ORDER BY fecha DESC
  `;
  return await q(sql, [ambiente, cuit_emisor, Number(pto_vta), desdeYmd, hastaYmd]);
}

async function detalleCierreDiario(pool, {
  ambiente,
  cuit_emisor,
  pto_vta,
  fechaYmd,
}) {
  const q = getQuery(pool);


  const rows = await q(`
    SELECT *
    FROM arca_cierres_diarios
    WHERE ambiente=? AND cuit_emisor=? AND pto_vta=? AND fecha=?
    LIMIT 1
  `, [ambiente, cuit_emisor, Number(pto_vta), fechaYmd]);

  if (!rows || !rows[0]) return null;

  const row = rows[0];
  // mysql puede devolver JSON como string
  try {
    row.snapshot = (typeof row.snapshot_json === "string")
      ? JSON.parse(row.snapshot_json)
      : row.snapshot_json;
  } catch {
    row.snapshot = null;
  }
  return row;
}
module.exports = {
  crearComprobante,
  insertarItems,
  actualizarRespuesta,

  buscarPorId,
  listarItemsPorArcaId,

  buscarUltimoPorFacturaMostradorId,

  buscarReceptorCache,
  upsertReceptorCache,

  insertarAsocCbte,
  sumarTotalEmitidoAsociado,

  insertarWsfeConsulta,
  listarWsfeConsultas,

  reportesComprobantes,
  reportesResumen,
  crearCierreDiario,
  listarCierresDiarios,
  detalleCierreDiario,
};
