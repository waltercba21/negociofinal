// models/arcaModel.js
const pool = require("../config/conexion");
const util = require("util");
const crypto = require("crypto");
const poolDefault = require("../config/conexion");
const FACT_TIPOS = [1, 6, 11];   
const NC_TIPOS   = [3, 8, 13];   


function getQuery(poolArg) {
  const p = poolArg || poolDefault;
  if (!p || typeof p.promise !== "function") {
    throw new Error("Pool mysql2 inválido (falta .promise())");
  }
  const pp = p.promise();

  return async (sql, params = []) => {
    if (typeof sql !== "string" || !sql.trim()) {
      throw new Error("SQL inválido (string vacío/undefined)");
    }
    const safeParams = Array.isArray(params)
      ? params.map((v) => (v === undefined ? null : v)) // mysql2 NO acepta undefined
      : [];
    const [rows] = await pp.query(sql, safeParams);
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
// ---- Auditoría WSFE ----
async function insertarWsfeConsulta({
  arca_comprobante_id,
  ok,
  parsed_json,
  resp_xml,
  http_status,
  soap_action,
  url,
  req_xml,
}) {
  const ensureJsonText = (v) => {
    if (v == null) return null;

    if (typeof v === "string") {
      const s = v.trim();
      try { JSON.parse(s); return s; } catch { return JSON.stringify(v); }
    }

    try { return JSON.stringify(v); }
    catch { return JSON.stringify({ _raw: String(v) }); }
  };

  const parseObj = (v) => {
    if (!v) return null;
    if (typeof v === "object") return v;
    if (typeof v === "string") {
      try { return JSON.parse(v); } catch { return null; }
    }
    return null;
  };

  const pjObj = parseObj(parsed_json);

  const httpStatusStore =
    (http_status != null ? Number(http_status) : null) ??
    (pjObj?.http_status != null ? Number(pjObj.http_status) : null) ??
    (pjObj?.httpStatus != null ? Number(pjObj.httpStatus) : null) ??
    null;

  const soapActionStore =
    (soap_action != null ? String(soap_action) : null) ??
    (pjObj?.soapAction != null ? String(pjObj.soapAction) : null) ??
    (pjObj?.soap_action != null ? String(pjObj.soap_action) : null) ??
    null;

  const urlStore =
    (url != null ? String(url) : null) ??
    (pjObj?.url != null ? String(pjObj.url) : null) ??
    null;

  const reqXmlStore =
    (req_xml != null ? String(req_xml) : null) ??
    (pjObj?.req_xml != null ? String(pjObj.req_xml) : null) ??
    (pjObj?.requestXml != null ? String(pjObj.requestXml) : null) ??
    (pjObj?.requestXmlRedacted != null ? String(pjObj.requestXmlRedacted) : null) ??
    null;

  const parsedStore = ensureJsonText(parsed_json);

  // Preferimos el INSERT con columnas nuevas; si el entorno no las tiene aún, fallback al esquema viejo.
  const sqlNew = `
    INSERT INTO arca_wsfe_consultas
      (arca_comprobante_id, ok, http_status, soap_action, url, req_xml, parsed_json, resp_xml)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const paramsNew = [
    arca_comprobante_id,
    ok ? 1 : 0,
    httpStatusStore,
    soapActionStore,
    urlStore,
    reqXmlStore,
    parsedStore,
    resp_xml || null,
  ];

  try {
    return await query(sqlNew, paramsNew);
  } catch (err) {
    const msg = String(err?.message || "");
    const badField =
      err?.code === "ER_BAD_FIELD_ERROR" ||
      /Unknown column/i.test(msg);

    if (badField) {
      const sqlOld = `
        INSERT INTO arca_wsfe_consultas (arca_comprobante_id, ok, parsed_json, resp_xml)
        VALUES (?, ?, ?, ?)
      `;
      const paramsOld = [
        arca_comprobante_id,
        ok ? 1 : 0,
        parsedStore,
        resp_xml || null,
      ];
      return query(sqlOld, paramsOld);
    }
    throw err;
  }
}

async function listarWsfeConsultas(arca_comprobante_id, limit = 20) {
  const sqlNew = `
    SELECT
      id, ok, http_status, soap_action, url, req_xml, parsed_json, created_at
    FROM arca_wsfe_consultas
    WHERE arca_comprobante_id=?
    ORDER BY id DESC
    LIMIT ?
  `;

  try {
    return await query(sqlNew, [arca_comprobante_id, Number(limit)]);
  } catch (err) {
    const msg = String(err?.message || "");
    const badField =
      err?.code === "ER_BAD_FIELD_ERROR" ||
      /Unknown column/i.test(msg);

    if (badField) {
      // fallback viejo
      const sqlOld = `
        SELECT id, ok, parsed_json, created_at
        FROM arca_wsfe_consultas
        WHERE arca_comprobante_id=?
        ORDER BY id DESC
        LIMIT ?
      `;
      return query(sqlOld, [arca_comprobante_id, Number(limit)]);
    }
    throw err;
  }
}

async function reportesResumen(pool, { ambiente, cuit_emisor, pto_vta, desdeYmd, hastaYmd, estado }) {
  const q = getQuery(pool);

  // Facturas típicas: A=1, B=6, C=11
  // Notas de crédito típicas: A=3, B=8, C=13
  const FACT = "1,6,11";
  const NC   = "3,8,13";

  let sql = `
    SELECT
      cbte_fch AS fecha_ymd,
      DATE_FORMAT(STR_TO_DATE(cbte_fch,'%Y%m%d'), '%Y-%m-%d') AS fecha,

      SUM(CASE WHEN cbte_tipo IN (${FACT}) THEN 1 ELSE 0 END) AS cant_facturas,
      SUM(CASE WHEN cbte_tipo IN (${NC})   THEN 1 ELSE 0 END) AS cant_nc,

      SUM(CASE WHEN cbte_tipo IN (${FACT}) THEN imp_total ELSE 0 END) AS total_facturas,
      SUM(CASE WHEN cbte_tipo IN (${NC})   THEN imp_total ELSE 0 END) AS total_nc,

      ( SUM(CASE WHEN cbte_tipo IN (${FACT}) THEN imp_total ELSE 0 END)
      - SUM(CASE WHEN cbte_tipo IN (${NC})   THEN imp_total ELSE 0 END) ) AS ventas_netas,

      SUM(CASE WHEN cbte_tipo IN (${FACT}) THEN imp_neto ELSE 0 END) AS neto_facturas,
      SUM(CASE WHEN cbte_tipo IN (${NC})   THEN imp_neto ELSE 0 END) AS neto_nc,
      ( SUM(CASE WHEN cbte_tipo IN (${FACT}) THEN imp_neto ELSE 0 END)
      - SUM(CASE WHEN cbte_tipo IN (${NC})   THEN imp_neto ELSE 0 END) ) AS neto_neto,

      SUM(CASE WHEN cbte_tipo IN (${FACT}) THEN imp_iva ELSE 0 END) AS iva_facturas,
      SUM(CASE WHEN cbte_tipo IN (${NC})   THEN imp_iva ELSE 0 END) AS iva_nc,
      ( SUM(CASE WHEN cbte_tipo IN (${FACT}) THEN imp_iva ELSE 0 END)
      - SUM(CASE WHEN cbte_tipo IN (${NC})   THEN imp_iva ELSE 0 END) ) AS iva_neto

    FROM arca_comprobantes
    WHERE ambiente=? AND cuit_emisor=? AND pto_vta=?
      AND cbte_fch BETWEEN ? AND ?
  `;
  const params = [ambiente, cuit_emisor, Number(pto_vta), desdeYmd, hastaYmd];

  if (estado) {
    sql += ` AND estado=?`;
    params.push(estado);
  }

  sql += ` GROUP BY cbte_fch ORDER BY cbte_fch ASC`;

  return q(sql, params);
}

async function reportesComprobantes(pool, { ambiente, cuit_emisor, pto_vta, desdeYmd, hastaYmd, estado, cbte_tipo }) {
  const q = getQuery(pool);

  let sql = `
    SELECT
      id, estado, ambiente, cuit_emisor, pto_vta,
      cbte_tipo, cbte_nro, cbte_fch, cae, cae_vto,
      doc_tipo, doc_nro, receptor_nombre,
      imp_total, imp_neto, imp_iva,
      created_at
    FROM arca_comprobantes
    WHERE ambiente=? AND cuit_emisor=? AND pto_vta=?
      AND cbte_fch BETWEEN ? AND ?
  `;
  const params = [ambiente, cuit_emisor, Number(pto_vta), desdeYmd, hastaYmd];

  if (estado) {
    sql += ` AND estado=?`;
    params.push(estado);
  }
  if (cbte_tipo != null && cbte_tipo !== "") {
    sql += ` AND cbte_tipo=?`;
    params.push(Number(cbte_tipo));
  }

  sql += ` ORDER BY cbte_fch ASC, cbte_tipo ASC, cbte_nro ASC`;

  return q(sql, params);
}
async function crearCierreDiario(pool, { ambiente, cuit_emisor, pto_vta, fechaYmd, usuario_email }) {
  const q = getQuery(pool);

  // 1) Traer resumen e ids
  const dias = await reportesResumen(pool, {
    ambiente,
    cuit_emisor,
    pto_vta,
    desdeYmd: fechaYmd,
    hastaYmd: fechaYmd,
    estado: "EMITIDO",
  });

  const comprobantes = await reportesComprobantes(pool, {
    ambiente,
    cuit_emisor,
    pto_vta,
    desdeYmd: fechaYmd,
    hastaYmd: fechaYmd,
    estado: "EMITIDO",
  });

  const dia = dias && dias[0] ? dias[0] : {
    cant_facturas: 0, cant_nc: 0,
    total_facturas: 0, total_nc: 0,
    ventas_netas: 0,
    neto_neto: 0,
    iva_neto: 0,
  };

  const cantFact = Number(dia.cant_facturas || 0);
  const cantNC   = Number(dia.cant_nc || 0);
  const cantCbtes = cantFact + cantNC;

  const totalFact = Number(dia.total_facturas || 0);
  const totalNC   = Number(dia.total_nc || 0);
  const ventasNetas = Number(dia.ventas_netas || 0);

  const totalNeto = Number(dia.neto_neto || 0);
  const totalIva  = Number(dia.iva_neto || 0);

  const ids = (comprobantes || []).map((c) => c.id);

  const snapshot = {
    fechaYmd,
    ambiente,
    cuit_emisor,
    pto_vta,
    resumen_dia: dia,
    comprobantes,
  };

  const snapshotJson = JSON.stringify(snapshot);
  const hash = crypto.createHash("sha256").update(snapshotJson).digest("hex");

  const totalsJson = JSON.stringify({
    fechaYmd,
    dia,
    cant_cbtes: cantCbtes,
    ids,
  });

  // 2) Insert (sin ON DUPLICATE KEY) para que tu controller pueda devolver 409 en duplicado
  const sql = `
    INSERT INTO arca_cierres_diarios
    (
      ambiente, cuit_emisor, pto_vta, fecha,
      cant_comprobantes, cant_facturas, cant_notas_credito,
      total_facturado, total_nc, total_neto_ventas,
      total_neto, total_iva,
      totals_json, hash_sha256,
      created_by, usuario_email,
      ids_json, snapshot_json
    )
    VALUES
    (
      ?, ?, ?, STR_TO_DATE(?, '%Y%m%d'),
      ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?
    )
  `;

  const params = [
    ambiente,
    cuit_emisor,
    Number(pto_vta),
    fechaYmd,

    cantCbtes,
    cantFact,
    cantNC,

    totalFact.toFixed(2),
    totalNC.toFixed(2),
    ventasNetas.toFixed(2),

    totalNeto.toFixed(2),
    totalIva.toFixed(2),

    totalsJson,
    hash,

    usuario_email ?? null,
    usuario_email ?? null,

    JSON.stringify(ids),
    snapshotJson,
  ];

  const r = await q(sql, params);

  return {
    id: r && r.insertId ? r.insertId : null,
    hash_sha256: hash,
    cant_comprobantes: cantCbtes,
  };
}
async function listarCierresDiarios(pool, { ambiente, cuit_emisor, pto_vta, desdeYmd, hastaYmd }) {
  const q = getQuery(pool);

  const sql = `
    SELECT
      id, ambiente, cuit_emisor, pto_vta,
      DATE_FORMAT(fecha, '%Y%m%d') AS fecha,
      created_at,
      usuario_email,

      cant_facturas,
      cant_notas_credito AS cant_nc,

      total_facturado AS total_facturas,
      total_nc,
      total_neto_ventas AS ventas_netas

    FROM arca_cierres_diarios
    WHERE ambiente=? AND cuit_emisor=? AND pto_vta=?
      AND fecha BETWEEN STR_TO_DATE(?, '%Y%m%d') AND STR_TO_DATE(?, '%Y%m%d')
    ORDER BY fecha DESC
  `;

  return q(sql, [ambiente, cuit_emisor, Number(pto_vta), desdeYmd, hastaYmd]);
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
async function detalleCierreDiario(pool, { ambiente, cuit_emisor, pto_vta, fechaYmd }) {
  const q = getQuery(pool);

  const sql = `
    SELECT
      id, ambiente, cuit_emisor, pto_vta,
      DATE_FORMAT(fecha, '%Y%m%d') AS fecha,
      created_at,
      usuario_email,

      cant_comprobantes,
      cant_facturas,
      cant_notas_credito AS cant_nc,

      total_facturado AS total_facturas,
      total_nc,
      total_neto_ventas AS ventas_netas,
      total_neto,
      total_iva,

      totals_json,
      hash_sha256,
      ids_json,
      snapshot_json,
      created_by

    FROM arca_cierres_diarios
    WHERE ambiente=? AND cuit_emisor=? AND pto_vta=?
      AND fecha = STR_TO_DATE(?, '%Y%m%d')
    LIMIT 1
  `;

  const rows = await q(sql, [ambiente, cuit_emisor, Number(pto_vta), fechaYmd]);
  return rows && rows[0] ? rows[0] : null;
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
