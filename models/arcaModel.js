// models/arcaModel.js
const pool = require("../config/conexion");
const util = require("util");
const crypto = require("crypto");

const FACT_TIPOS = [1, 6, 11];   
const NC_TIPOS   = [3, 8, 13];   


function getQuery(pool) {
  const p = pool || require("./db");

  return async (sql, params = []) => {
    if (typeof sql !== "string") {
      throw new TypeError(
        `[ARCA][db] SQL debe ser string. Recibido: ${typeof sql}`
      );
    }

    const normParams = Array.isArray(params)
      ? params.map((v) => (v === undefined ? null : v))
      : [];

    const [rows] = await p.promise().query(sql, normParams);
    return rows;
  };
}

const query = getQuery(); // default (usa ./db)

function toYmd8(v) {
  const s = String(v ?? "").trim();
  if (/^\d{8}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "");
  return null;
}

function ymd8ToIso(ymd8) {
  if (!/^\d{8}$/.test(ymd8)) return null;
  return `${ymd8.slice(0, 4)}-${ymd8.slice(4, 6)}-${ymd8.slice(6, 8)}`;
}

function toNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

let _cierresSchemaCache = null;

async function getCierresSchema(q) {
  if (_cierresSchemaCache) return _cierresSchemaCache;

  const cols = await q("SHOW COLUMNS FROM arca_cierres_diarios");
  const map = new Map(cols.map((c) => [c.Field, String(c.Type || "").toLowerCase()]));

  const has = (name) => map.has(name);
  const pick = (...names) => names.find((n) => has(n)) || null;

  _cierresSchemaCache = {
    map,
    fechaIsDate: (map.get("fecha") || "").startsWith("date"),
    colUsuarioEmail: pick("usuario_email"),
    colCreatedBy: pick("created_by"),
    colCantComprobantes: pick("cant_comprobantes", "total_cbtes"),
    colCantFacturas: pick("cant_facturas"),
    colCantNc: pick("cant_nc", "cant_notas_credito"),
    colTotalFacturas: pick("total_facturas", "total_facturado"),
    colTotalNc: pick("total_nc"),
    colVentasNetas: pick("ventas_netas", "total_neto_ventas"),
    colTotalNeto: pick("total_neto"),
    colTotalIva: pick("total_iva"),
    colTotalsJson: pick("totals_json", "totales_json"),
    colSha: pick("hash_sha256", "snapshot_sha256"),
    colIdsJson: pick("ids_json", "arca_ids_json"),
    colSnapshotJson: pick("snapshot_json"),
  };

  return _cierresSchemaCache;
}

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
async function reportesResumen(pool, { ambiente, cuit_emisor, pto_vta, desdeYmd, hastaYmd, estado = "EMITIDO" }) {
  const q = getQuery(pool);

  const d = toYmd8(desdeYmd);
  const h = toYmd8(hastaYmd);
  if (!d || !h) throw new Error("desde/hasta inválidos (usar YYYY-MM-DD o YYYYMMDD)");

  const sql = `
    SELECT
      cbte_fch AS fecha_ymd,
      DATE_FORMAT(STR_TO_DATE(cbte_fch, '%Y%m%d'), '%Y-%m-%d') AS fecha,

      SUM(cbte_tipo IN (1, 6, 11)) AS cant_facturas,
      SUM(cbte_tipo IN (3, 8, 13)) AS cant_nc,

      SUM(CASE WHEN cbte_tipo IN (1, 6, 11) THEN imp_total ELSE 0 END) AS total_facturas,
      SUM(CASE WHEN cbte_tipo IN (3, 8, 13) THEN imp_total ELSE 0 END) AS total_nc,
      (SUM(CASE WHEN cbte_tipo IN (1, 6, 11) THEN imp_total ELSE 0 END) -
       SUM(CASE WHEN cbte_tipo IN (3, 8, 13) THEN imp_total ELSE 0 END)) AS ventas_netas,

      SUM(CASE WHEN cbte_tipo IN (1, 6, 11) THEN imp_neto ELSE 0 END) AS neto_facturas,
      SUM(CASE WHEN cbte_tipo IN (3, 8, 13) THEN imp_neto ELSE 0 END) AS neto_nc,
      (SUM(CASE WHEN cbte_tipo IN (1, 6, 11) THEN imp_neto ELSE 0 END) -
       SUM(CASE WHEN cbte_tipo IN (3, 8, 13) THEN imp_neto ELSE 0 END)) AS neto_neto,

      SUM(CASE WHEN cbte_tipo IN (1, 6, 11) THEN imp_iva ELSE 0 END) AS iva_facturas,
      SUM(CASE WHEN cbte_tipo IN (3, 8, 13) THEN imp_iva ELSE 0 END) AS iva_nc,
      (SUM(CASE WHEN cbte_tipo IN (1, 6, 11) THEN imp_iva ELSE 0 END) -
       SUM(CASE WHEN cbte_tipo IN (3, 8, 13) THEN imp_iva ELSE 0 END)) AS iva_neto

    FROM arca_comprobantes
    WHERE ambiente=? AND cuit_emisor=? AND pto_vta=?
      AND cbte_fch BETWEEN ? AND ?
      AND estado=?
    GROUP BY cbte_fch
    ORDER BY cbte_fch ASC
  `;

  const params = [ambiente, cuit_emisor, pto_vta, d, h, estado];
  return q(sql, params);
}

async function reportesComprobantes(pool, { ambiente, cuit_emisor, pto_vta, desdeYmd, hastaYmd, estado, cbte_tipo }) {
  const q = getQuery(pool);

  const d = toYmd8(desdeYmd);
  const h = toYmd8(hastaYmd);
  if (!d || !h) throw new Error("desde/hasta inválidos (usar YYYY-MM-DD o YYYYMMDD)");

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

  const params = [ambiente, cuit_emisor, pto_vta, d, h];

  if (estado) {
    sql += " AND estado=? ";
    params.push(estado);
  }
  if (cbte_tipo !== null && cbte_tipo !== undefined && cbte_tipo !== "") {
    sql += " AND cbte_tipo=? ";
    params.push(Number(cbte_tipo));
  }

  sql += " ORDER BY cbte_fch ASC, cbte_tipo ASC, cbte_nro ASC ";
  return q(sql, params);
}

async function crearCierreDiario(pool, { ambiente, cuit_emisor, pto_vta, fechaYmd, fecha, usuarioEmail }) {
  const q = getQuery(pool);
  const schema = await getCierresSchema(q);

  const ymd8 = toYmd8(fechaYmd || fecha);
  if (!ymd8) throw new Error("fecha inválida (usar YYYY-MM-DD o YYYYMMDD)");
  const fechaIso = ymd8ToIso(ymd8);
  const fechaStore = schema.fechaIsDate ? fechaIso : ymd8;

  // 1) Resumen diario (rows)
  const dias = await reportesResumen(pool, {
    ambiente,
    cuit_emisor,
    pto_vta,
    desdeYmd: ymd8,
    hastaYmd: ymd8,
    estado: "EMITIDO",
  });

  // 2) Totales (se calculan acá, así NO existe más el ReferenceError "totales")
  const tot = dias.reduce(
    (acc, r) => {
      acc.cant_facturas += toNumber(r.cant_facturas);
      acc.cant_nc += toNumber(r.cant_nc);
      acc.total_facturas += toNumber(r.total_facturas);
      acc.total_nc += toNumber(r.total_nc);
      acc.ventas_netas += toNumber(r.ventas_netas);
      acc.neto_neto += toNumber(r.neto_neto);
      acc.iva_neto += toNumber(r.iva_neto);
      return acc;
    },
    { cant_facturas: 0, cant_nc: 0, total_facturas: 0, total_nc: 0, ventas_netas: 0, neto_neto: 0, iva_neto: 0 }
  );

  const cant_comprobantes = tot.cant_facturas + tot.cant_nc;

  // 3) IDs ARCA del día (para ids_json)
  const comprobantes = await reportesComprobantes(pool, {
    ambiente,
    cuit_emisor,
    pto_vta,
    desdeYmd: ymd8,
    hastaYmd: ymd8,
    estado: "EMITIDO",
    cbte_tipo: null,
  });
  const ids = (comprobantes || []).map((c) => c.id);

  const snapshot = {
    fecha: fechaIso,
    fecha_ymd: ymd8,
    estado: "EMITIDO",
    totales: tot,
    dias,
    ids,
  };

  const snapshotStr = JSON.stringify(snapshot);
  const sha = crypto.createHash("sha256").update(snapshotStr).digest("hex");

  // 4) Insert dinámico según tu schema real
  const cols = [];
  const vals = [];
  const used = new Set();

  const push = (col, val) => {
    if (!col) return;
    if (!schema.map.has(col)) return;
    if (used.has(col)) return;
    used.add(col);
    cols.push(col);
    vals.push(val === undefined ? null : val);
  };

  push("ambiente", ambiente);
  push("cuit_emisor", cuit_emisor);
  push("pto_vta", pto_vta);
  push("fecha", fechaStore);

  // usuario
  push(schema.colUsuarioEmail, usuarioEmail || null);
  push(schema.colCreatedBy, usuarioEmail || null);

  // cantidades / totales (mapeadas)
  push(schema.colCantComprobantes, cant_comprobantes);
  push(schema.colCantFacturas, tot.cant_facturas);
  push(schema.colCantNc, tot.cant_nc);
  push(schema.colTotalFacturas, tot.total_facturas);
  push(schema.colTotalNc, tot.total_nc);
  push(schema.colVentasNetas, tot.ventas_netas);
  push(schema.colTotalNeto, tot.neto_neto);
  push(schema.colTotalIva, tot.iva_neto);

  // json + hash
  push(schema.colTotalsJson, JSON.stringify({ fecha: fechaIso, totales: tot, dias, estado: "EMITIDO" }));
  push(schema.colSha, sha);
  push(schema.colIdsJson, JSON.stringify(ids));
  push(schema.colSnapshotJson, snapshotStr);

  if (cols.length === 0) throw new Error("No se detectaron columnas insertables en arca_cierres_diarios");

  const placeholders = cols.map(() => "?").join(",");
  const updates = cols
    .filter((c) => c !== "id")
    .map((c) => `${c}=VALUES(${c})`)
    .join(", ");

  const sqlIns = `
    INSERT INTO arca_cierres_diarios (${cols.join(",")})
    VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updates}
  `;

  await q(sqlIns, vals);
  return { fecha: fechaIso, sha256: sha, ids_count: ids.length, totales: tot };
}

async function listarCierresDiarios(pool, { ambiente, cuit_emisor, pto_vta, desdeYmd, hastaYmd, desde, hasta }) {
  const q = getQuery(pool);
  const schema = await getCierresSchema(q);

  const d8 = toYmd8(desdeYmd || desde);
  const h8 = toYmd8(hastaYmd || hasta);
  if (!d8 || !h8) throw new Error("desde/hasta inválidos (usar YYYY-MM-DD o YYYYMMDD)");

  const dStore = schema.fechaIsDate ? ymd8ToIso(d8) : d8;
  const hStore = schema.fechaIsDate ? ymd8ToIso(h8) : h8;

  const fechaSelect = schema.fechaIsDate
    ? "DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha"
    : "DATE_FORMAT(STR_TO_DATE(fecha, '%Y%m%d'), '%Y-%m-%d') AS fecha";

  const sql = `
    SELECT
      id, ambiente, cuit_emisor, pto_vta,
      ${fechaSelect},
      created_at,
      ${schema.colUsuarioEmail ? `${schema.colUsuarioEmail} AS usuario_email` : "NULL AS usuario_email"},
      ${schema.colCantFacturas ? `${schema.colCantFacturas} AS cant_facturas` : "0 AS cant_facturas"},
      ${schema.colCantNc ? `${schema.colCantNc} AS cant_nc` : "0 AS cant_nc"},
      ${schema.colTotalFacturas ? `${schema.colTotalFacturas} AS total_facturas` : "0 AS total_facturas"},
      ${schema.colTotalNc ? `${schema.colTotalNc} AS total_nc` : "0 AS total_nc"},
      ${schema.colVentasNetas ? `${schema.colVentasNetas} AS ventas_netas` : "0 AS ventas_netas"},
      ${schema.colSha ? `${schema.colSha} AS sha256` : "NULL AS sha256"}
    FROM arca_cierres_diarios
    WHERE ambiente=? AND cuit_emisor=? AND pto_vta=?
      AND fecha BETWEEN ? AND ?
    ORDER BY fecha DESC
  `;

  const params = [ambiente, cuit_emisor, pto_vta, dStore, hStore];
  return q(sql, params);
}
async function obtenerCierreDiario(pool, { ambiente, cuit_emisor, pto_vta, fechaYmd, fecha }) {
  const q = getQuery(pool);
  const schema = await getCierresSchema(q);

  const ymd8 = toYmd8(fechaYmd || fecha);
  if (!ymd8) throw new Error("fecha inválida (usar YYYY-MM-DD o YYYYMMDD)");

  const fStore = schema.fechaIsDate ? ymd8ToIso(ymd8) : ymd8;

  const rows = await q(
    `
    SELECT *
    FROM arca_cierres_diarios
    WHERE ambiente=? AND cuit_emisor=? AND pto_vta=? AND fecha=?
    LIMIT 1
    `,
    [ambiente, cuit_emisor, pto_vta, fStore]
  );

  return rows && rows[0] ? rows[0] : null;
}

async function detalleCierreDiario(pool, {
  ambiente,
  cuit_emisor,
  pto_vta,
  fechaYmd,
}) {
  const q = query(pool);

  const rows = await q(
    `
    SELECT *
    FROM arca_cierres_diarios
    WHERE ambiente=? AND cuit_emisor=? AND pto_vta=? AND fecha=?
    LIMIT 1
    `,
    [String(ambiente || "").toUpperCase(), Number(cuit_emisor), Number(pto_vta), fechaYmd]
  );

  if (!rows?.[0]) return null;

  const row = rows[0];
  try {
    row.snapshot = typeof row.snapshot_json === "string"
      ? JSON.parse(row.snapshot_json)
      : row.snapshot_json;
  } catch {
    row.snapshot = null;
  }

  try {
    row.ids = typeof row.ids_json === "string"
      ? JSON.parse(row.ids_json)
      : row.ids_json;
  } catch {
    row.ids = null;
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
