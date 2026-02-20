// controllers/arcaController.js
require("dotenv").config();
const arcaCalc = require("../services/arca_calc");
const fs = require("fs");
const path = require("path");

const pool = require("../config/conexion");
const util = require("util");

const arcaModel = require("../models/arcaModel");
const wsfe = require("../services/wsfe");
const padron = require("../services/padron");

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const _condIvaCache = {
  ts: 0,
  rows: null,
  raw: null
};
function isDupKey(err, keyName) {
  const msg = String(err?.sqlMessage || err?.message || "");
  return (err?.code === "ER_DUP_ENTRY" || err?.errno === 1062) && msg.includes(keyName);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function isTrue(v) {
  return ["1","true","yes","on","si"].includes(String(v||"").toLowerCase());
}
function receptorCacheWriteEnabled() {
  return !isTrue(process.env.ARCA_DISABLE_RECEPTOR_CACHE_WRITE);
}

function claseFromCbteTipo(cbteTipo) {
  const t = Number(cbteTipo || 0);

  // A estándar: 1..5
  // A con leyenda “Operación sujeta a retención”: 51..55
  if ((t >= 1 && t <= 5) || (t >= 51 && t <= 55)) return "A";

  // B: 6..10
  if (t >= 6 && t <= 10) return "B";

  // C (si alguna vez lo usan): 11..15
  if (t >= 11 && t <= 15) return "C";

  return null;
}

function isValidYMD(yyyymmdd) {
  if (!/^\d{8}$/.test(yyyymmdd)) return false;
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  if (m < 1 || m > 12) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function pickAllTagContents(xml, tag) {
  const s = String(xml || "");
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "gi"
  );
  const out = [];
  let m;
  while ((m = r.exec(s)) !== null) out.push(m[1]);
  return out;
}

function pickDate8MaxFromTags(xml, tags) {
  let best = null;
  for (const t of tags) {
    const contents = pickAllTagContents(xml, t);
    for (const v of contents) {
      const digits = String(v).replace(/\D/g, "");
      const candidates = digits.match(/20\d{6}/g) || [];
      for (const c of candidates) {
        if (!isValidYMD(c)) continue;
        best = best ? (c > best ? c : best) : c;
      }
    }
  }
  return best;
}

function parseCondIvaFromXml(xml) {
  const blocks = String(xml || "").match(/<CondicionIvaReceptor>([\s\S]*?)<\/CondicionIvaReceptor>/gi) || [];
  const out = blocks.map(b => {
    const id = Number(pickTag(b, "Id") || 0);
    const desc = pickTag(b, "Desc") || "";
    const cmpClase = pickTag(b, "Cmp_Clase") || "";
    return { id, desc, cmp_clase: cmpClase };
  }).filter(x => x.id > 0);

  // fallback por si el tag cambiara (muy raro)
  return out;
}
const FALLBACK_COND_IVA_BY_CLASE = {
  A: [1, 6, 13, 16],
  B: [4, 5, 7, 8, 9, 10, 15],
  C: [5, 6, 13, 16],
};

async function getAllowedCondIvaIdsForCbte(cbte_tipo) {
  const clase = claseFromCbteTipo(cbte_tipo);
  if (!clase) return { clase: null, ids: [] };

  try {
    const all = await getCondIvaReceptorCached();
    const rows = all.filter((x) => String(x.cmp_clase || "").toUpperCase().includes(clase));
    const ids = rows.map((x) => Number(x.id || 0)).filter((n) => n > 0);
    if (clase === "B" && !ids.includes(5)) ids.unshift(5);
    return { clase, ids };
  } catch (e) {
    return {
      clase,
      ids: FALLBACK_COND_IVA_BY_CLASE[clase] ? [...FALLBACK_COND_IVA_BY_CLASE[clase]] : [],
      fallback: true,
      error: e?.message || String(e),
    };
  }
}


async function getCondIvaReceptorCached() {
  const TTL = 6 * 60 * 60 * 1000; // 6 horas
  const now = Date.now();

  if (_condIvaCache.rows && (now - _condIvaCache.ts) < TTL) {
    return _condIvaCache.rows;
  }

  const r = await wsfe.FEParamGetCondicionIvaReceptor();
  const raw = r.raw || r.xml || r; // por si tu wrapper devuelve distinto
  const rows = Array.isArray(r.rows) ? r.rows : parseCondIvaFromXml(raw);

  _condIvaCache.ts = now;
  _condIvaCache.rows = rows;
  _condIvaCache.raw = raw;

  return rows;
}
async function condIvaDescSafe(condId) {
  const id = Number(condId || 0);
  if (!id) return null;

  try {
    const rows = await getCondIvaReceptorCached(); // cache 6h
    const hit = (rows || []).find(x => Number(x.id) === id);
    return hit?.desc ? String(hit.desc).trim() : `ID ${id}`;
  } catch (_) {
    return `ID ${id}`;
  }
}

function getQuery() {
  if (pool.promise && typeof pool.promise === "function") {
    return (sql, params = []) =>
      pool.promise().query(sql, params).then(([rows]) => rows);
  }
  const q = util.promisify(pool.query).bind(pool);
  return (sql, params = []) => q(sql, params);
}
const query = getQuery();

function round2(n) {
  const x = Number(n);
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function pickTag(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = xml.match(r);
  return m ? m[1].trim() : "";
}

function maxYMD(a, b) {
  if (!/^\d{8}$/.test(a)) return b;
  if (!/^\d{8}$/.test(b)) return a;
  return a >= b ? a : b;
}

async function getNextAndDates(pto_vta, cbte_tipo) {
  const ult = await wsfe.FECompUltimoAutorizado(pto_vta, cbte_tipo);
  const ultimo = Number(ult.ultimo || 0);
  const next = ultimo + 1;

  let lastCbteFch = null;

  if (ultimo > 0) {
    const cons = await wsfe.FECompConsultar(pto_vta, cbte_tipo, ultimo);
    const f = pickTag(cons.raw, "CbteFch");
    if (/^\d{8}$/.test(f)) lastCbteFch = f;
  }

  const today = wsfe.yyyymmddARFromDate(new Date());
  const env = String(process.env.ARCA_ENV || "homo").toLowerCase();
  const isProd = env === "prod";

  // En PROD no emitimos si el último comprobante quedó con fecha futura
  if (isProd && lastCbteFch && lastCbteFch > today) {
    const err = new Error(
      `Último comprobante (${ultimo}) tiene fecha futura ${lastCbteFch}. Corregir reloj/emisión previa.`
    );
    err.code = "LAST_DATE_IN_FUTURE";
    throw err;
  }

  // En HOMO: permitimos usar la del último si fuera mayor (para destrabar pruebas)
  const cbte_fch = lastCbteFch ? maxYMD(today, lastCbteFch) : today;

  return { ultimo, next, cbte_fch, lastCbteFch, today };
}
async function emitirDesdeFacturaMostrador(req, res) {
  let arcaId = null;

  const qBool = (v) => ["1", "true", "yes", "on"].includes(String(v || "").toLowerCase());

  // Para que resp_xml / auditoría NO queden NULL cuando el body venga vacío
  const forceNonEmpty = (raw, label) => {
    const s = raw == null ? "" : String(raw);
    return s !== "" ? s : `<!-- WSFE EMPTY BODY | ${label} -->`;
  };

  const toJsonStr = (v) => {
    if (v == null) return null;
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v);
    } catch (_) {
      return String(v);
    }
  };

  const insertWsfeConsultaSafe = async ({ arca_comprobante_id, ok, parsed_json, resp_xml }) => {
    try {
      await arcaModel.insertarWsfeConsulta({
        arca_comprobante_id,
        ok: !!ok,
        parsed_json: toJsonStr(parsed_json),
        resp_xml: forceNonEmpty(resp_xml, (parsed_json && parsed_json.action) || "WSFE"),
      });
    } catch (e) {
      // no cortar emisión por auditoría
      console.warn("⚠️ insertarWsfeConsulta falló:", e?.message || e);
    }
  };

  const updateRespSafe = async (id, patch) => {
    try {
      await arcaModel.actualizarRespuesta(id, patch);
    } catch (e) {
      console.warn("⚠️ actualizarRespuesta falló:", e?.message || e);
    }
  };

  try {
    const facturaId = Number(req.params.id || 0);
    if (!Number.isFinite(facturaId) || facturaId <= 0) {
      return res.status(400).json({ error: "facturaId inválido" });
    }

    // Anti-duplicado lógico (DB también protege con uq_factura_activa)
    const existente = await arcaModel.buscarUltimoPorFacturaMostradorId(facturaId);
    if (existente && (existente.estado === "PENDIENTE" || existente.estado === "EMITIDO")) {
      return res.status(409).json({
        error: `Ya existe un comprobante ARCA en estado ${existente.estado} para esta factura`,
        arca_id: existente.id,
        estado: existente.estado,
        cae: existente.cae,
        cbte_nro: existente.cbte_nro,
      });
    }

    const cbte_tipo = Number(req.body.cbte_tipo || 6);
    const doc_tipo = Number(req.body.doc_tipo);

    if (!Number.isFinite(cbte_tipo) || cbte_tipo <= 0) return res.status(400).json({ error: "cbte_tipo inválido" });
    if (!Number.isFinite(doc_tipo) || doc_tipo <= 0) return res.status(400).json({ error: "doc_tipo inválido" });

    // doc_nro (permitir vacío solo si doc_tipo=99 => forzar 0)
    let doc_nro_str = String(req.body.doc_nro ?? "").trim();
    if (doc_tipo === 99 && doc_nro_str === "") doc_nro_str = "0";
    if (!/^\d+$/.test(doc_nro_str)) return res.status(400).json({ error: "doc_nro inválido" });
    const doc_nro = Number(doc_nro_str);

    // receptor_cond_iva_id (puede venir vacío y resolverse via cache/padrón si resolve_receptor=1)
    const receptorCondIvaInput = req.body.receptor_cond_iva_id;
    const frontSentCondIva = !(receptorCondIvaInput == null || receptorCondIvaInput === "");

    let receptor_cond_iva_id = frontSentCondIva ? Number(receptorCondIvaInput) : null;
    if (frontSentCondIva && (!Number.isFinite(receptor_cond_iva_id) || receptor_cond_iva_id <= 0)) {
      return res.status(400).json({ error: "receptor_cond_iva_id inválido" });
    }

    let receptor_nombre = String(req.body.receptor_nombre || "").trim() || null;
    let receptor_domicilio = null;

    // Validación doc_nro según doc_tipo
    if (doc_tipo === 99) {
      if (!Number.isFinite(doc_nro) || doc_nro < 0) return res.status(400).json({ error: "doc_nro inválido" });
      if (doc_nro !== 0) return res.status(400).json({ error: "Consumidor Final: doc_nro debe ser 0" });
      if (!receptor_nombre) receptor_nombre = "CONSUMIDOR FINAL";
    } else {
      if (!Number.isFinite(doc_nro) || doc_nro <= 0) return res.status(400).json({ error: "doc_nro inválido (debe ser > 0)" });
    }

    // 80 = CUIT => 11 dígitos
    if (doc_tipo === 80 && doc_nro_str.length !== 11) {
      return res.status(400).json({ error: "CUIT inválido (debe tener 11 dígitos)" });
    }

    // Config ARCA
    const pto_vta = Number(process.env.ARCA_PTO_VTA || 0);
    const cuit_emisor = Number(process.env.ARCA_CUIT || 0);
    if (!Number.isFinite(pto_vta) || pto_vta <= 0) return res.status(500).json({ error: "ARCA_PTO_VTA no configurado" });
    if (!Number.isFinite(cuit_emisor) || cuit_emisor <= 0) return res.status(500).json({ error: "ARCA_CUIT no configurado" });
    const ambiente = String(process.env.ARCA_ENV || "homo").toUpperCase() === "PROD" ? "PROD" : "HOMO";

    // ===== Resolver receptor (cache/padrón) si se pidió =====
    const resolveReceptor = qBool(req.query.resolve_receptor);
    const refreshReceptor = qBool(req.query.refresh_receptor);

    if (resolveReceptor && doc_tipo === 80 && doc_nro > 0) {
      try {
        let cached = null;

        if (!refreshReceptor) {
          cached = await arcaModel.buscarReceptorCache(doc_tipo, doc_nro);
          if (cached) {
            if (!receptor_nombre) receptor_nombre = cached.razon_social || cached.nombre || receptor_nombre;
            receptor_domicilio = cached.domicilio || receptor_domicilio;

            // Solo si el front NO mandó receptor_cond_iva_id
            if (!frontSentCondIva && cached.cond_iva_id) {
              const c = Number(cached.cond_iva_id);
              if (Number.isFinite(c) && c > 0) receptor_cond_iva_id = c;
            }
          }
        }

        if (refreshReceptor || !cached || !receptor_nombre || (!frontSentCondIva && !receptor_cond_iva_id)) {
          const out = await padron.getPersonaV2({
            idPersona: doc_nro,
            cuitRepresentada: cuit_emisor,
            debug: false,
          });

          if (out?.ok && !out?.notFound && out?.data) {
            receptor_nombre = receptor_nombre || out.data.razon_social || out.data.nombre || receptor_nombre;
            receptor_domicilio = receptor_domicilio || out.data.domicilio || null;

            // cachear (si falla, no corta emisión)
            try {
              await arcaModel.upsertReceptorCache({
                doc_tipo,
                doc_nro,
                razon_social: receptor_nombre || null,
                nombre: receptor_nombre || null,
                cond_iva_id: receptor_cond_iva_id || null,
                domicilio: receptor_domicilio,
              });
            } catch (e) {
              console.warn("⚠️ No se pudo upsert receptor cache:", e.message);
            }
          }
        }
      } catch (e) {
        console.warn("⚠️ Resolver receptor falló (no bloqueante):", e.message);
      }
    }

    // A partir de acá: condición IVA debe existir sí o sí (se usa en WSFE)
    if (!Number.isFinite(receptor_cond_iva_id) || receptor_cond_iva_id <= 0) {
      return res.status(400).json({ error: "Falta receptor_cond_iva_id (enviar o usar ?resolve_receptor=1 con cache/padrón)" });
    }

    // ===== Reglas de negocio (server-side) =====
    const { clase, ids: allowedCondIvaIds } = await getAllowedCondIvaIdsForCbte(cbte_tipo);
    if (!clase) return res.status(400).json({ error: "cbte_tipo no soportado", cbte_tipo });

    // Bloqueo Clase A en PROD si ya hay evidencia de 10000, salvo override explícito
    const forceA = qBool(req.query.force_a);
    if (ambiente === "PROD" && clase === "A" && !forceA) {
      const prev = await query(
        `SELECT id
           FROM arca_comprobantes
          WHERE ambiente='PROD'
            AND cuit_emisor=?
            AND pto_vta=?
            AND cbte_tipo=?
            AND obs_code='10000'
          ORDER BY id DESC
          LIMIT 1`,
        [cuit_emisor, pto_vta, cbte_tipo]
      );
      if (prev.length) {
        return res.status(403).json({
          error: "WSFE/ARCA informó que este CUIT no está habilitado para emitir comprobantes Clase A (obs_code=10000).",
          obs_code: "10000",
          last_attempt_id: prev[0].id,
          hint: "Para forzar un intento puntual: ?force_a=1",
        });
      }
    }

    if (clase === "A") {
      if (doc_tipo !== 80) return res.status(400).json({ error: "Clase A requiere doc_tipo=80 (CUIT)" });
      if (doc_nro_str.length !== 11) return res.status(400).json({ error: "CUIT inválido (debe tener 11 dígitos)" });
    }

    if (clase === "B" && receptor_cond_iva_id === 1) {
      return res.status(400).json({ error: "Condición IVA 1 (RI) no es válida para clase B" });
    }

    if (Array.isArray(allowedCondIvaIds) && allowedCondIvaIds.length && !allowedCondIvaIds.includes(receptor_cond_iva_id)) {
      return res.status(400).json({
        error: "Condición IVA receptor no válida para el comprobante",
        cbte_tipo,
        clase,
        receptor_cond_iva_id,
        allowed: allowedCondIvaIds,
      });
    }

    // Traer factura + items
    const rows = await query(
      `
      SELECT
        fm.id AS factura_id, fm.nombre_cliente, fm.fecha, fm.total, fm.creado_en,
        fi.producto_id, COALESCE(p.nombre,'(sin nombre)') AS descripcion,
        fi.cantidad, fi.precio_unitario, fi.subtotal,
        p.IVA AS iva_porcentaje
      FROM facturas_mostrador fm
      JOIN factura_items fi ON fm.id = fi.factura_id
      LEFT JOIN productos p ON p.id = fi.producto_id
      WHERE fm.id = ?
      `,
      [facturaId]
    );
    if (!rows.length) return res.status(404).json({ error: "Factura no encontrada o sin items" });

    // Cálculo real (por alícuota) + regla C sin IVA
    let calc;
    try {
      calc = arcaCalc.calcularDesdeFactura(rows, clase, { defaultPorc: 21 });
    } catch (e) {
      if (e && e.code === "IVA_UNSUPPORTED") return res.status(400).json({ error: e.message });
      throw e;
    }

    const { itemsCalc, totales, ivaAlicuotas, omitirIva } = calc;
    const imp_total = totales.imp_total;
    const imp_neto = totales.imp_neto;
    const imp_iva = totales.imp_iva;

    // ===== Blindaje IVA=0 para clase A/B =====
    const allowIvaZero = qBool(req.query.allow_iva_0);
    if (clase !== "C" && !omitirIva && Number(imp_iva) === 0 && !allowIvaZero) {
      const detalle = (itemsCalc || []).map((x) => ({
        producto_id: x.producto_id,
        descripcion: x.descripcion,
        iva_porc: x.iva_porc,
        base_imp: x.base_imp,
        imp_iva: x.imp_iva,
      }));
      return res.status(400).json({
        error: "IVA calculado = 0 en comprobante con IVA. Revisá productos.IVA / items. Para forzar: ?allow_iva_0=1",
        clase,
        cbte_tipo,
        imp_total,
        imp_neto,
        imp_iva,
        detalle_items: detalle,
      });
    }

    // --- helpers para reconciliación ---
    const pickBlock = (xml, tag) => {
      const r = new RegExp(`<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`, "i");
      const m = String(xml || "").match(r);
      return m ? m[1] : "";
    };

    const isValidYMD = (yyyymmdd) => {
      if (!/^\d{8}$/.test(yyyymmdd)) return false;
      const y = Number(yyyymmdd.slice(0, 4));
      const m = Number(yyyymmdd.slice(4, 6));
      const d = Number(yyyymmdd.slice(6, 8));
      if (m < 1 || m > 12) return false;
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    };

    const pickAllTagContents = (xml, tag) => {
      const s = String(xml || "");
      const r = new RegExp(`<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`, "gi");
      const out = [];
      let m;
      while ((m = r.exec(s)) !== null) out.push(m[1]);
      return out;
    };

    const pickDate8MaxFromTags = (xml, tags) => {
      let best = null;
      for (const t of tags) {
        const contents = pickAllTagContents(xml, t);
        for (const v of contents) {
          const digits = String(v).replace(/\D/g, "");
          const candidates = digits.match(/20\d{6}/g) || [];
          for (const c of candidates) {
            if (!isValidYMD(c)) continue;
            best = best ? (c > best ? c : best) : c;
          }
        }
      }
      return best;
    };

    const pickFirst = (xml, tags) => {
      for (const t of tags) {
        const v = pickTag(xml, t);
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
      return null;
    };

    const reconciliarEnWsfe = async (ptoVta, cbteTipo, cbteNro) => {
      for (let i = 1; i <= 3; i++) {
        try {
          const out = await wsfe.FECompConsultar(ptoVta, cbteTipo, cbteNro);
          const raw = out?.raw || "";

          const fault = pickTag(raw, "faultstring");
          if (fault) return { ok: false, fault, raw };

          const resultGetXml = pickBlock(raw, "ResultGet") || raw;
          const cae = pickFirst(resultGetXml, ["CodAutorizacion", "CAE"]);
          const cae_vto = pickDate8MaxFromTags(resultGetXml, ["CAEFchVto", "FchVto"]);
          const cbte_fch_wsfe = pickDate8MaxFromTags(resultGetXml, ["CbteFch"]);

          if (cae) return { ok: true, cae, cae_vto, cbte_fch: cbte_fch_wsfe, raw };
          await sleep(200 * i);
        } catch (_) {
          await sleep(200 * i);
        }
      }
      return { ok: false, cae: null };
    };

    // Nro + fecha coherente + reserva robusta (reintento ante uq_cbte)
    const MAX_ALLOC_TRIES = 5;
    let info, next, cbte_fch, reqObj, req_json;

    for (let attempt = 1; attempt <= MAX_ALLOC_TRIES; attempt++) {
      info = await getNextAndDates(pto_vta, cbte_tipo);
      next = info.next;
      cbte_fch = info.cbte_fch;

      reqObj = {
        fuente: "facturas_mostrador",
        factura_mostrador_id: facturaId,
        cbte_tipo,
        pto_vta,
        cbte_fch,
        cbte_nro: next,
        doc_tipo,
        doc_nro,
        receptor_cond_iva_id,
        receptor_nombre,
        receptor_domicilio,
        totales: { imp_total, imp_neto, imp_iva },
        iva: { omitirIva, ivaAlicuotas },
        items: itemsCalc,
        debug: {
          ultimo_autorizado: info.ultimo,
          last_cbte_fch: info.lastCbteFch,
          today: info.today,
          alloc_attempt: attempt,
        },
      };

      req_json = JSON.stringify(reqObj, null, 2);

      try {
        arcaId = await arcaModel.crearComprobante({
          factura_mostrador_id: facturaId,
          ambiente,
          cuit_emisor,
          pto_vta,
          cbte_tipo,
          cbte_nro: next,
          cbte_fch,
          doc_tipo,
          doc_nro,
          receptor_nombre,
          receptor_cond_iva_id,
          imp_total,
          imp_neto,
          imp_iva,
          imp_exento: 0,
          mon_id: "PES",
          mon_cotiz: 1,
          req_json,
          estado: "PENDIENTE",
        });
        break;
      } catch (err) {
        if (isDupKey(err, "uq_factura_activa")) {
          const row = await arcaModel.buscarUltimoPorFacturaMostradorId(facturaId);
          return res.status(409).json({
            error: `Ya existe un comprobante ARCA en estado ${row?.estado} para esta factura`,
            arca_id: row?.id || null,
            estado: row?.estado || null,
            cae: row?.cae || null,
            cbte_nro: row?.cbte_nro || null,
          });
        }

        if (isDupKey(err, "uq_cbte")) {
          if (attempt === MAX_ALLOC_TRIES) {
            throw new Error("No se pudo reservar cbte_nro por choque de numeración (uq_cbte) tras múltiples reintentos");
          }
          await sleep(120 * attempt);
          continue;
        }

        throw err;
      }
    }

    if (!arcaId) throw new Error("No se pudo crear comprobante PENDIENTE (reserva de numeración fallida)");

    await arcaModel.insertarItems(arcaId, itemsCalc);

    // WSFE
    let cae;

    const doAuditFromCae = async (caeObj, phase) => {
      const respXml = forceNonEmpty(caeObj?.raw, `FECAESolicitar:${phase}`);
      await insertWsfeConsultaSafe({
        arca_comprobante_id: arcaId,
        ok: caeObj?.resultado === "A",
        parsed_json: {
          action: "FECAESolicitar",
          phase,
          http_status: caeObj?.meta?.statusCode ?? null,
          soapAction: caeObj?.meta?.soapAction ?? null,
          url: caeObj?.meta?.url ?? null,
          req_xml: caeObj?.meta?.requestXml ?? null, // redacted
          resultado: caeObj?.resultado ?? null,
          obsCode: caeObj?.obsCode ?? null,
          obsMsg: caeObj?.obsMsg ?? null,
        },
        resp_xml: respXml,
      });
      return respXml;
    };

    try {
      cae = await wsfe.FECAESolicitar({
        ptoVta: pto_vta,
        cbteTipo: cbte_tipo,
        concepto: 1,
        docTipo: doc_tipo,
        docNro: doc_nro,
        receptorCondIvaId: receptor_cond_iva_id,
        cbteFch: cbte_fch,
        cbteNro: next,
        impTotal: imp_total,
        impTotConc: 0,
        impNeto: imp_neto,
        impOpEx: 0,
        impIVA: imp_iva,
        impTrib: 0,
        ivaAlicuotas,
        omitirIva,
        monId: "PES",
        monCotiz: "1.000",
      });

      // Auditoría SIEMPRE
      await doAuditFromCae(cae, "initial");
    } catch (err) {
      const msg = err?.message || String(err);

      const httpStatus = err?.statusCode || err?.status || null;
      const soapAction = err?.soapAction || null;
      const wsfeUrl = err?.url || null;
      const reqXml = err?.requestXmlRedacted || err?.requestXml || null;

      const bodyRaw =
        (err && Object.prototype.hasOwnProperty.call(err, "body")) ? String(err.body ?? "") :
        (err && Object.prototype.hasOwnProperty.call(err, "raw")) ? String(err.raw ?? "") :
        "";

      const respStore = forceNonEmpty(bodyRaw, `WSFE_EXC:${httpStatus || "NO_STATUS"}`);

      await insertWsfeConsultaSafe({
        arca_comprobante_id: arcaId,
        ok: 0,
        parsed_json: {
          action: "FECAESolicitar",
          phase: "exception",
          http_status: httpStatus,
          soapAction,
          url: wsfeUrl,
          req_xml: reqXml,
          message: msg,
        },
        resp_xml: respStore,
      });

      // Reconciliar
      const rec = await reconciliarEnWsfe(pto_vta, cbte_tipo, next);
      if (rec.ok && rec.cae) {
        const recXml = forceNonEmpty(rec.raw, "FECompConsultar:reconciliado");

        await updateRespSafe(arcaId, {
          resultado: "A",
          cae: rec.cae,
          cae_vto: rec.cae_vto || null,
          obs_code: "RECONCILIADO",
          obs_msg: "Autorizado en WSFE luego de excepción",
          resp_xml: recXml,
          estado: "EMITIDO",
        });

        await insertWsfeConsultaSafe({
          arca_comprobante_id: arcaId,
          ok: 1,
          parsed_json: { action: "FECompConsultar", phase: "reconcile", ok: 1 },
          resp_xml: recXml,
        });

        return res.status(200).json({
          arca_id: arcaId,
          estado: "EMITIDO",
          pto_vta,
          cbte_tipo,
          cbte_fch: rec.cbte_fch || cbte_fch,
          cbte_nro: next,
          ultimo_autorizado: info?.ultimo ?? null,
          last_cbte_fch: info?.lastCbteFch ?? null,
          resultado: "A",
          cae: rec.cae,
          cae_vto: rec.cae_vto || null,
          obs_code: "RECONCILIADO",
          obs_msg: "Autorizado en WSFE luego de excepción",
        });
      }

      // SOAP Fault / request inválida => RECHAZADO y liberar cbte_nro
      const isSoapFault =
        /<soap:Fault|:Fault>/i.test(respStore) ||
        /faultstring/i.test(respStore) ||
        /XML document|SOAPAction/i.test(msg);

      if (isSoapFault) {
        await updateRespSafe(arcaId, {
          resultado: "R",
          cae: null,
          cae_vto: null,
          obs_code: "SOAP_FAULT",
          obs_msg: (`${httpStatus ? `[HTTP ${httpStatus}] ` : ""}${msg}`).slice(0, 1000),
          resp_xml: respStore,
          estado: "RECHAZADO",
        });
        await query(`UPDATE arca_comprobantes SET cbte_nro=NULL, updated_at=NOW() WHERE id=?`, [arcaId]);
        return res.status(502).json({
          arca_id: arcaId,
          estado: "RECHAZADO",
          cbte_nro: null,
          error: "SOAP Fault / request inválida (ver resp_xml / arca_wsfe_consultas)",
          detail: msg,
        });
      }

      // Caso transitorio: PENDIENTE con evidencia
      await updateRespSafe(arcaId, {
        resultado: null,
        cae: null,
        cae_vto: null,
        obs_code: "WSFE_EXC",
        obs_msg: (`${httpStatus ? `[HTTP ${httpStatus}] ` : ""}${msg}`).slice(0, 1000),
        resp_xml: respStore,
        estado: "PENDIENTE",
      });

      return res.status(202).json({
        arca_id: arcaId,
        estado: "PENDIENTE",
        pto_vta,
        cbte_tipo,
        cbte_fch,
        cbte_nro: next,
        error: "Fallo WSFE (requiere confirmación)",
        detail: msg,
      });
    }

    // Reintento si 10016 (fecha)
    if (cae.resultado === "R" && String(cae.obsCode) === "10016") {
      let updated = false;

      for (let attempt = 1; attempt <= MAX_ALLOC_TRIES; attempt++) {
        info = await getNextAndDates(pto_vta, cbte_tipo);
        next = info.next;
        cbte_fch = info.cbte_fch;

        reqObj.cbte_nro = next;
        reqObj.cbte_fch = cbte_fch;
        reqObj.debug = {
          ultimo_autorizado: info.ultimo,
          last_cbte_fch: info.lastCbteFch,
          today: info.today,
          retry: true,
          alloc_attempt: attempt,
        };
        req_json = JSON.stringify(reqObj, null, 2);

        try {
          await query(`UPDATE arca_comprobantes SET cbte_nro=?, cbte_fch=?, req_json=?, updated_at=NOW() WHERE id=?`, [
            next,
            cbte_fch,
            req_json,
            arcaId,
          ]);
          updated = true;
          break;
        } catch (err) {
          if (isDupKey(err, "uq_cbte")) {
            if (attempt === MAX_ALLOC_TRIES) {
              await updateRespSafe(arcaId, {
                resultado: "R",
                cae: null,
                cae_vto: null,
                obs_code: "DUP_CBTE",
                obs_msg: "Choque de numeración (uq_cbte) al reintentar por 10016",
                resp_xml: forceNonEmpty(err?.body || err?.raw, "DUP_CBTE"),
                estado: "RECHAZADO",
              });
              await query(`UPDATE arca_comprobantes SET cbte_nro=NULL, updated_at=NOW() WHERE id=?`, [arcaId]);
              return res.status(409).json({ error: "Choque de numeración al reintentar (uq_cbte)", arca_id: arcaId });
            }
            await sleep(120 * attempt);
            continue;
          }
          throw err;
        }
      }

      if (!updated) throw new Error("No se pudo reservar numeración en reintento 10016");

      // volver a pedir CAE con el nro reservado
      try {
        cae = await wsfe.FECAESolicitar({
          ptoVta: pto_vta,
          cbteTipo: cbte_tipo,
          concepto: 1,
          docTipo: doc_tipo,
          docNro: doc_nro,
          receptorCondIvaId: receptor_cond_iva_id,
          cbteFch: cbte_fch,
          cbteNro: next,
          impTotal: imp_total,
          impTotConc: 0,
          impNeto: imp_neto,
          impOpEx: 0,
          impIVA: imp_iva,
          impTrib: 0,
          ivaAlicuotas,
          omitirIva,
          monId: "PES",
          monCotiz: "1.000",
        });

        await doAuditFromCae(cae, "retry10016");
      } catch (err) {
        const msg = err?.message || String(err);

        const httpStatus = err?.statusCode || err?.status || null;
        const soapAction = err?.soapAction || null;
        const wsfeUrl = err?.url || null;
        const reqXml = err?.requestXmlRedacted || err?.requestXml || null;

        const bodyRaw =
          (err && Object.prototype.hasOwnProperty.call(err, "body")) ? String(err.body ?? "") :
          (err && Object.prototype.hasOwnProperty.call(err, "raw")) ? String(err.raw ?? "") :
          "";

        const respStore = forceNonEmpty(bodyRaw, `WSFE_EXC_RETRY:${httpStatus || "NO_STATUS"}`);

        await insertWsfeConsultaSafe({
          arca_comprobante_id: arcaId,
          ok: 0,
          parsed_json: {
            action: "FECAESolicitar",
            phase: "exception-retry10016",
            http_status: httpStatus,
            soapAction,
            url: wsfeUrl,
            req_xml: reqXml,
            message: msg,
          },
          resp_xml: respStore,
        });

        const rec = await reconciliarEnWsfe(pto_vta, cbte_tipo, next);
        if (rec.ok && rec.cae) {
          const recXml = forceNonEmpty(rec.raw, "FECompConsultar:reconciliado:retry10016");

          await updateRespSafe(arcaId, {
            resultado: "A",
            cae: rec.cae,
            cae_vto: rec.cae_vto || null,
            obs_code: "RECONCILIADO",
            obs_msg: "Autorizado en WSFE luego de excepción (retry)",
            resp_xml: recXml,
            estado: "EMITIDO",
          });

          await insertWsfeConsultaSafe({
            arca_comprobante_id: arcaId,
            ok: 1,
            parsed_json: { action: "FECompConsultar", phase: "reconcile-retry10016", ok: 1 },
            resp_xml: recXml,
          });

          return res.status(200).json({
            arca_id: arcaId,
            estado: "EMITIDO",
            pto_vta,
            cbte_tipo,
            cbte_fch: rec.cbte_fch || cbte_fch,
            cbte_nro: next,
            ultimo_autorizado: info?.ultimo ?? null,
            last_cbte_fch: info?.lastCbteFch ?? null,
            resultado: "A",
            cae: rec.cae,
            cae_vto: rec.cae_vto || null,
            obs_code: "RECONCILIADO",
            obs_msg: "Autorizado en WSFE luego de excepción (retry)",
          });
        }

        const isSoapFault =
          /<soap:Fault|:Fault>/i.test(respStore) ||
          /faultstring/i.test(respStore) ||
          /XML document|SOAPAction/i.test(msg);

        if (isSoapFault) {
          await updateRespSafe(arcaId, {
            resultado: "R",
            cae: null,
            cae_vto: null,
            obs_code: "SOAP_FAULT",
            obs_msg: (`${httpStatus ? `[HTTP ${httpStatus}] ` : ""}${msg}`).slice(0, 1000),
            resp_xml: respStore,
            estado: "RECHAZADO",
          });
          await query(`UPDATE arca_comprobantes SET cbte_nro=NULL, updated_at=NOW() WHERE id=?`, [arcaId]);
          return res.status(502).json({
            arca_id: arcaId,
            estado: "RECHAZADO",
            cbte_nro: null,
            error: "SOAP Fault / request inválida (retry10016)",
            detail: msg,
          });
        }

        await updateRespSafe(arcaId, {
          resultado: null,
          cae: null,
          cae_vto: null,
          obs_code: "WSFE_EXC",
          obs_msg: (`${httpStatus ? `[HTTP ${httpStatus}] ` : ""}${msg}`).slice(0, 1000),
          resp_xml: respStore,
          estado: "PENDIENTE",
        });

        return res.status(202).json({
          arca_id: arcaId,
          estado: "PENDIENTE",
          pto_vta,
          cbte_tipo,
          cbte_fch,
          cbte_nro: next,
          error: "Fallo WSFE (retry) (requiere confirmación)",
          detail: msg,
        });
      }
    }

    const estado = cae.resultado === "A" ? "EMITIDO" : "RECHAZADO";
    const respXmlFinal = forceNonEmpty(cae?.raw, `FECAESolicitar:final:${cae?.meta?.statusCode ?? "NO_STATUS"}`);

    await updateRespSafe(arcaId, {
      resultado: cae.resultado || null,
      cae: cae.cae || null,
      cae_vto: cae.caeVto || null,
      obs_code: cae.obsCode || null,
      obs_msg: cae.obsMsg || null,
      resp_xml: respXmlFinal,
      estado,
    });

    // Si quedó RECHAZADO, liberar cbte_nro para permitir reintento sin chocar uq_cbte
    if (estado === "RECHAZADO") {
      await query(`UPDATE arca_comprobantes SET cbte_nro=NULL, updated_at=NOW() WHERE id=?`, [arcaId]);
    }

    // Cache receptor (solo si tiene doc real)
    if (doc_nro > 0 && doc_tipo !== 99) {
      try {
        await arcaModel.upsertReceptorCache({
          doc_tipo,
          doc_nro,
          razon_social: receptor_nombre || null,
          nombre: receptor_nombre || null,
          cond_iva_id: receptor_cond_iva_id || null,
          domicilio: receptor_domicilio,
        });
      } catch (e) {
        console.warn("⚠️ No se pudo cachear receptor:", e.message);
      }
    }

    return res.json({
      arca_id: arcaId,
      estado,
      pto_vta,
      cbte_tipo,
      cbte_fch,
      cbte_nro: next,
      ultimo_autorizado: info.ultimo,
      last_cbte_fch: info.lastCbteFch,
      resultado: cae.resultado || null,
      cae: cae.cae || null,
      cae_vto: cae.caeVto || null,
      obs_code: cae.obsCode || null,
      obs_msg: cae.obsMsg || null,
    });
  } catch (e) {
    // Si ya creamos el comprobante y algo explotó, no dejarlo colgado
    if (arcaId) {
      try {
        const msg = (e?.message || String(e)).slice(0, 1000);
        const httpStatus = e?.statusCode || e?.status || null;

        const bodyRaw =
          (e && Object.prototype.hasOwnProperty.call(e, "body")) ? String(e.body ?? "") :
          (e && Object.prototype.hasOwnProperty.call(e, "raw")) ? String(e.raw ?? "") :
          "";

        const respStore = forceNonEmpty(bodyRaw, `EXC:${httpStatus || "NO_STATUS"}`);

        await updateRespSafe(arcaId, {
          resultado: "R",
          cae: null,
          cae_vto: null,
          obs_code: "EXC",
          obs_msg: msg,
          resp_xml: respStore,
          estado: "RECHAZADO",
        });

        await query(`UPDATE arca_comprobantes SET cbte_nro=NULL, updated_at=NOW() WHERE id=?`, [arcaId]);

        await insertWsfeConsultaSafe({
          arca_comprobante_id: arcaId,
          ok: 0,
          parsed_json: { action: "EXC", message: msg },
          resp_xml: respStore,
        });
      } catch (_) {}
    }

    console.error("❌ ARCA emitirDesdeFacturaMostrador:", e);
    return res.status(500).json({ error: e?.message || "Error interno" });
  }
}

async function emitirNotaCreditoPorArcaId(req, res) {
  let arcaId = null;

  const qBool = (v) => ["1", "true", "yes", "on"].includes(String(v || "").toLowerCase());

  const NC_BY_FACT = { 1: 3, 51: 53, 6: 8, 11: 13 };

  const IVA_ALIC_MAP = [
    { id: 3, porc: 0 },
    { id: 4, porc: 10.5 },
    { id: 5, porc: 21 },
    { id: 6, porc: 27 },
    { id: 8, porc: 5 },
    { id: 9, porc: 2.5 },
  ];

  const porcToWsfeId = (porc) => {
    const p = Number(porc);
    const hit = IVA_ALIC_MAP.find((a) => Math.abs(a.porc - p) < 0.02);
    return hit ? hit.id : null;
  };

  const round2local = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  try {
    const origenId = Number(req.params.arcaIdOrigen || 0);
    if (!Number.isFinite(origenId) || origenId <= 0) {
      return res.status(400).json({ error: "arcaIdOrigen inválido" });
    }

    const origen = await arcaModel.buscarPorId(origenId);
    if (!origen) return res.status(404).json({ error: "Comprobante origen no encontrado" });

    if (origen.estado !== "EMITIDO") {
      return res.status(409).json({
        error: "El comprobante origen debe estar EMITIDO",
        origen_id: origenId,
        estado: origen.estado
      });
    }

    if (!origen.cbte_nro || !origen.pto_vta || !origen.cbte_tipo || !origen.cbte_fch) {
      return res.status(409).json({
        error: "Origen inválido (faltan datos pto_vta/cbte_tipo/cbte_nro/cbte_fch)"
      });
    }

    const tipoNcAuto = NC_BY_FACT[Number(origen.cbte_tipo)];
    if (!tipoNcAuto) {
      return res.status(400).json({
        error: "El origen no es una factura soportada para NC",
        origen_cbte_tipo: origen.cbte_tipo
      });
    }

    const cbte_tipo = Number(req.body.cbte_tipo || tipoNcAuto);
    if (cbte_tipo !== tipoNcAuto) {
      return res.status(400).json({
        error: "cbte_tipo de NC no coincide con el tipo del origen",
        esperado: tipoNcAuto,
        recibido: cbte_tipo
      });
    }

    // Guard rail: si hay NC PENDIENTE asociada al origen, no crear otra
    const pend = await query(
      `
      SELECT ac.id, ac.estado, ac.cbte_nro
      FROM arca_cbtes_asoc a
      JOIN arca_comprobantes ac ON ac.id = a.arca_comprobante_id
      WHERE a.asociado_arca_id = ?
        AND ac.cbte_tipo = ?
        AND ac.estado = 'PENDIENTE'
      ORDER BY ac.id DESC
      LIMIT 1
      `,
      [origenId, cbte_tipo]
    );
    if (pend.length) {
      return res.status(409).json({
        error: "Ya existe una NC PENDIENTE asociada a este comprobante. Auditar/reconciliar antes de reintentar.",
        nc_pendiente: pend[0],
        origen: { arca_id: origenId, cbte_tipo: origen.cbte_tipo, cbte_nro: origen.cbte_nro, cbte_fch: origen.cbte_fch }
      });
    }

    const clase = claseFromCbteTipo(cbte_tipo);
    if (!["A", "B"].includes(clase)) {
      return res.status(400).json({ error: "Solo NC A/B en este paso", clase, cbte_tipo });
    }

    const doc_tipo = Number(origen.doc_tipo);
    const doc_nro = Number(origen.doc_nro);

    let receptor_cond_iva_id =
      origen.receptor_cond_iva_id != null
        ? Number(origen.receptor_cond_iva_id)
        : Number(req.body.receptor_cond_iva_id || 0);

    if (!receptor_cond_iva_id || !Number.isFinite(receptor_cond_iva_id)) {
      return res.status(400).json({ error: "Falta receptor_cond_iva_id (origen no lo tiene y no vino en body)" });
    }

    if (clase === "A" && doc_tipo !== 80) {
      return res.status(400).json({ error: "Para NC A el receptor debe ser CUIT (DocTipo=80)", doc_tipo });
    }

    const allowed = await getAllowedCondIvaIdsForCbte(cbte_tipo);
    if (allowed.ids?.length && !allowed.ids.includes(receptor_cond_iva_id)) {
      return res.status(400).json({
        error: "receptor_cond_iva_id no permitido para este tipo de comprobante",
        cbte_tipo,
        clase,
        receptor_cond_iva_id,
        allowed_ids: allowed.ids,
      });
    }

    const origenTotal = Number(origen.imp_total);
    const targetTotal = req.body.imp_total != null ? Number(req.body.imp_total) : origenTotal;

    if (!Number.isFinite(targetTotal) || targetTotal <= 0) {
      return res.status(400).json({ error: "imp_total inválido (debe ser > 0)" });
    }

    const yaAcreditado = await arcaModel.sumarTotalEmitidoAsociado(origenId);
    const remanente = round2local(origenTotal - Number(yaAcreditado || 0));
    if (targetTotal > remanente + 0.01) {
      return res.status(409).json({
        error: "La NC supera el remanente acreditable del comprobante origen",
        origen_id: origenId,
        origen_total: origenTotal,
        ya_acreditado: Number(yaAcreditado || 0),
        remanente,
        solicitado: targetTotal,
      });
    }

    const origItems = await arcaModel.listarItemsPorArcaId(origenId);
    if (!origItems.length) return res.status(409).json({ error: "El origen no tiene items guardados en ARCA" });

    const factor = origenTotal > 0 ? targetTotal / origenTotal : 1;

    const items = origItems.map((it) => {
      const cantidad = Number(it.cantidad || 0) || 1;
      let imp_total = round2local(Number(it.imp_total) * factor);

      const iva_alicuota = Number(it.iva_alicuota || 0);
      const imp_neto = iva_alicuota === 0 ? imp_total : round2local(imp_total / (1 + iva_alicuota / 100));
      const imp_iva = round2local(imp_total - imp_neto);

      return {
        producto_id: it.producto_id ?? null,
        descripcion: it.descripcion,
        cantidad,
        precio_unitario: round2local(imp_total / cantidad),
        bonif: Number(it.bonif || 0),
        iva_alicuota,
        imp_neto,
        imp_iva,
        imp_total,
      };
    });

    const sumAntes = round2local(items.reduce((a, i) => a + Number(i.imp_total || 0), 0));
    const diff = round2local(targetTotal - sumAntes);
    if (Math.abs(diff) >= 0.01 && items.length) {
      const last = items[items.length - 1];
      last.imp_total = round2local(Number(last.imp_total) + diff);
      const p = Number(last.iva_alicuota || 0);
      last.imp_neto = p === 0 ? last.imp_total : round2local(last.imp_total / (1 + p / 100));
      last.imp_iva = round2local(last.imp_total - last.imp_neto);
      last.precio_unitario = round2local(last.imp_total / Number(last.cantidad || 1));
    }

    const imp_total = round2local(items.reduce((a, i) => a + Number(i.imp_total || 0), 0));
    const imp_neto  = round2local(items.reduce((a, i) => a + Number(i.imp_neto || 0), 0));
    const imp_iva   = round2local(items.reduce((a, i) => a + Number(i.imp_iva || 0), 0));

    const map = new Map();
    for (const it of items) {
      const id = porcToWsfeId(it.iva_alicuota);
      if (!id) {
        return res.status(400).json({ error: "IVA no soportado para WSFE", iva_alicuota: it.iva_alicuota, descripcion: it.descripcion });
      }
      const prev = map.get(id) || { id, baseImp: 0, importe: 0 };
      prev.baseImp = round2local(prev.baseImp + Number(it.imp_neto || 0));
      prev.importe = round2local(prev.importe + Number(it.imp_iva || 0));
      map.set(id, prev);
    }
    const ivaAlicuotas = [...map.values()].sort((a, b) => a.id - b.id);

    const allowIva0 = qBool(req.query.allow_iva_0);
    if (!allowIva0 && imp_iva === 0 && imp_neto > 0) {
      return res.status(409).json({
        error: "IVA quedó en 0. Reintentar con allow_iva_0=1 o revisar IVA de los productos/origen.",
        imp_neto, imp_iva, imp_total
      });
    }

    const pto_vta = Number(origen.pto_vta);
    const info = await getNextAndDates(pto_vta, cbte_tipo);

    let next = info.next;
    let cbte_fch = info.cbte_fch;

    for (let i = 0; i < 3; i++) {
      try {
        const req_json = JSON.stringify({
          fuente: "NC",
          asociado: {
            arca_id: origenId,
            pto_vta: Number(origen.pto_vta),
            cbte_tipo: Number(origen.cbte_tipo),
            cbte_nro: Number(origen.cbte_nro),
            cbte_fch: String(origen.cbte_fch),
          },
          parcial: factor < 0.999,
          factor,
        });

        arcaId = await arcaModel.crearComprobante({
          factura_mostrador_id: null,
          ambiente: origen.ambiente,
          cuit_emisor: origen.cuit_emisor,
          pto_vta,
          cbte_tipo,
          cbte_nro: next,
          cbte_fch,
          doc_tipo,
          doc_nro,
          receptor_nombre: origen.receptor_nombre || null,
          receptor_cond_iva_id,
          imp_total,
          imp_neto,
          imp_iva,
          imp_exento: 0,
          mon_id: origen.mon_id || "PES",
          mon_cotiz: origen.mon_cotiz || 1,
          req_json,
          estado: "PENDIENTE",
        });
        break;
      } catch (e) {
        if (isDupKey(e, "uq_cbte")) {
          next++;
          continue;
        }
        throw e;
      }
    }

    if (!arcaId) return res.status(500).json({ error: "No se pudo reservar cbte_nro para NC" });

    await arcaModel.insertarItems(arcaId, items);

    await arcaModel.insertarAsocCbte({
      arca_comprobante_id: arcaId,
      asociado_arca_id: origenId,
      asoc_pto_vta: Number(origen.pto_vta),
      asoc_cbte_tipo: Number(origen.cbte_tipo),
      asoc_cbte_nro: Number(origen.cbte_nro),
      asoc_cbte_fch: String(origen.cbte_fch),
      asoc_cuit: Number(origen.cuit_emisor),
    });

    const cae = await wsfe.FECAESolicitar({
      ptoVta: pto_vta,
      cbteTipo: cbte_tipo,
      cbteDesde: next,
      cbteHasta: next,
      cbteFch: cbte_fch,
      docTipo: doc_tipo,
      docNro: doc_nro,
      condicionIVAReceptorId: receptor_cond_iva_id,
      impTotal: imp_total,
      impNeto: imp_neto,
      impIVA: imp_iva,
      impOpEx: 0,
      impTotConc: 0,
      impTrib: 0,
      monId: origen.mon_id || "PES",
      monCotiz: origen.mon_cotiz || 1,
      omitirIva: false,
      ivaAlicuotas,
      // SOLO 3 CAMPOS (Tipo/PtoVta/Nro)
      cbtesAsoc: [{
        tipo: Number(origen.cbte_tipo),
        pto_vta: Number(origen.pto_vta),
        nro: Number(origen.cbte_nro),
      }],
    });

    // Auditoría SIEMPRE
    try {
      await arcaModel.insertarWsfeConsulta({
        arca_comprobante_id: arcaId,
        ok: cae?.resultado === "A",
        parsed_json: {
          mode: "emitir",
          action: "FECAESolicitar",
          http_status: cae?.meta?.statusCode ?? null,
          soapAction: cae?.meta?.soapAction ?? null,
          url: cae?.meta?.url ?? null,
          req_xml: cae?.meta?.requestXml ?? null,
          resultado: cae?.resultado ?? null,
          obsCode: cae?.obsCode ?? null,
          obsMsg: cae?.obsMsg ?? null,
        },
        resp_xml: (cae?.raw && String(cae.raw).trim()) ? cae.raw : "<!-- WSFE EMPTY BODY -->",
      });
    } catch (e) {
      console.warn("⚠️ insertarWsfeConsulta (NC) falló:", e?.message || e);
    }

    const resultado = cae?.resultado ?? null;
    const httpStatus = cae?.meta?.statusCode ?? null;
    const rawLen = String(cae?.raw || "").trim().length;

    let estado;
    if (resultado === "A") estado = "EMITIDO";
    else if (resultado === "R") estado = "RECHAZADO";
    else if (httpStatus && httpStatus >= 400 && httpStatus < 500) estado = "RECHAZADO"; // request inválida
    else estado = "PENDIENTE"; // sin confirmación real

    const obs_code =
      estado === "PENDIENTE" ? "WSFE_SIN_CONFIRM"
      : (cae?.obsCode || (httpStatus ? `HTTP_${httpStatus}` : "RECHAZADO"));

    const obs_msg =
      estado === "PENDIENTE"
        ? `WSFE sin confirmación (http_status=${httpStatus}, rawLen=${rawLen})`
        : (cae?.obsMsg || (httpStatus ? `WSFE HTTP ${httpStatus} (rawLen=${rawLen})` : "Rechazado"));

    await arcaModel.actualizarRespuesta(arcaId, {
      resultado,
      cae: cae?.cae || null,
      cae_vto: cae?.caeVto || null,
      obs_code,
      obs_msg,
      resp_xml: (cae?.raw && String(cae.raw).trim()) ? cae.raw : "<!-- WSFE EMPTY BODY -->",
      estado,
    });

    if (estado === "RECHAZADO") {
      await query(`UPDATE arca_comprobantes SET cbte_nro=NULL, updated_at=NOW() WHERE id=?`, [arcaId]);
    }

    if (estado === "PENDIENTE") {
      return res.status(502).json({
        arca_id: arcaId,
        estado,
        pto_vta,
        cbte_tipo,
        cbte_fch,
        cbte_nro: next,
        error: "WSFE sin confirmación. Requiere auditoría/reconciliación antes de reintentar.",
        origen: { arca_id: origenId, cbte_tipo: origen.cbte_tipo, cbte_nro: origen.cbte_nro, cbte_fch: origen.cbte_fch },
        parcial: factor < 0.999,
        remanente_antes: remanente,
        acreditado_total_origen: Number(yaAcreditado || 0),
      });
    }

    return res.status(200).json({
      arca_id: arcaId,
      estado,
      pto_vta,
      cbte_tipo,
      cbte_fch,
      cbte_nro: next,
      resultado,
      cae: cae?.cae || null,
      cae_vto: cae?.caeVto || null,
      obs_code,
      obs_msg,
      origen: { arca_id: origenId, cbte_tipo: origen.cbte_tipo, cbte_nro: origen.cbte_nro, cbte_fch: origen.cbte_fch },
      parcial: factor < 0.999,
      remanente_antes: remanente,
      acreditado_total_origen: Number(yaAcreditado || 0),
    });
  } catch (e) {
    if (arcaId) {
      try {
        await arcaModel.actualizarRespuesta(arcaId, {
          resultado: null,
          cae: null,
          cae_vto: null,
          obs_code: "EXC",
          obs_msg: (e?.message || String(e)).slice(0, 1000),
          resp_xml: (e?.body || e?.raw || null),
          estado: "RECHAZADO",
        });
        await query(`UPDATE arca_comprobantes SET cbte_nro=NULL, updated_at=NOW() WHERE id=?`, [arcaId]);
      } catch (_) {}
    }
    return res.status(500).json({ error: e.message || "Error interno" });
  }
}

async function statusPorFacturaMostrador(req, res) {
  try {
    const facturaId = Number(req.params.id || 0);
    if (!Number.isFinite(facturaId) || facturaId <= 0) {
      return res.status(400).json({ error: "facturaId inválido" });
    }

    const row = await arcaModel.buscarUltimoPorFacturaMostradorId(facturaId);
    if (!row) return res.status(404).json({ error: "Sin comprobante ARCA asociado" });

    return res.json({
      arca_id: row.id,
      estado: row.estado,
      cbte_tipo: row.cbte_tipo,
      cbte_nro: row.cbte_nro,
      cbte_fch: row.cbte_fch,
      resultado: row.resultado,
      cae: row.cae,
      cae_vto: row.cae_vto,
      obs_code: row.obs_code,
      obs_msg: row.obs_msg,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error interno" });
  }
}

// ===== UI / API para pantalla =====

// GET /arca
async function vistaArcaIndex(req, res) {
  try {
    return res.render("arca/index");
  } catch (e) {
    return res.status(500).send(e.message || "Error renderizando ARCA");
  }
}

async function listarFacturasMostrador(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const rows = await query(
      `
      SELECT
        fm.id,

        CASE
          WHEN fm.vendedor IS NOT NULL AND fm.vendedor <> '' THEN fm.vendedor
          WHEN fm.nombre_cliente IS NOT NULL AND fm.nombre_cliente <> '' AND fm.nombre_cliente <> 'MOSTRADOR' THEN fm.nombre_cliente
          ELSE NULL
        END AS vendedor,

        CASE
          WHEN ac.id IS NOT NULL THEN
            CASE
              WHEN ac.doc_tipo = 99 THEN 'CONSUMIDOR FINAL'
              ELSE COALESCE(ac.receptor_nombre, fm.cliente_nombre, fm.nombre_cliente)
            END
          ELSE COALESCE(fm.cliente_nombre, fm.nombre_cliente)
        END AS cliente,

        CASE
          WHEN ac.cbte_tipo IN (1, 51) THEN 'A'
          WHEN ac.cbte_tipo = 6 THEN 'B'
          WHEN ac.cbte_tipo IN (3, 53) THEN 'NC A'
          WHEN ac.cbte_tipo = 8 THEN 'NC B'
          ELSE NULL
        END AS tipo,

        CASE
          WHEN ac.cbte_fch IS NOT NULL AND ac.cbte_fch <> ''
            THEN DATE_FORMAT(STR_TO_DATE(ac.cbte_fch, '%Y%m%d'), '%Y-%m-%d')
          ELSE DATE_FORMAT(fm.fecha, '%Y-%m-%d')
        END AS fecha,

        fm.total,
        fm.metodos_pago,
        DATE_FORMAT(fm.creado_en, '%Y-%m-%d %H:%i:%s') AS creado_en,

        ac.estado      AS arca_estado,
        ac.resultado   AS arca_resultado,
        ac.cae         AS arca_cae,
        ac.cae_vto     AS arca_cae_vto,
        ac.cbte_tipo   AS arca_cbte_tipo,
        ac.cbte_nro    AS arca_cbte_nro,
        ac.doc_tipo    AS arca_doc_tipo,
        ac.doc_nro     AS arca_doc_nro,
        ac.receptor_nombre      AS arca_receptor_nombre,
        ac.receptor_cond_iva_id AS arca_receptor_cond_iva_id,
        ac.obs_code    AS arca_obs_code,
        ac.obs_msg     AS arca_obs_msg

      FROM facturas_mostrador fm
      LEFT JOIN (
        SELECT t1.*
        FROM arca_comprobantes t1
        JOIN (
          SELECT factura_mostrador_id, MAX(id) AS max_id
          FROM arca_comprobantes
          GROUP BY factura_mostrador_id
        ) t2
          ON t1.factura_mostrador_id = t2.factura_mostrador_id
         AND t1.id = t2.max_id
      ) ac
        ON ac.factura_mostrador_id = fm.id
      ORDER BY fm.id DESC
      LIMIT ? OFFSET ?
      `,
      [limit, offset]
    );

    return res.json({ rows, limit, offset });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error listando facturas" });
  }
}

async function detalleFacturaMostrador(req, res) {
  try {
    const facturaId = Number(req.params.id || 0);
    if (!facturaId) return res.status(400).json({ error: "id inválido" });

const cab = await query(
  `SELECT
     id,
     -- vendedor real si existe; si no, fallback a nombre_cliente (histórico)
     COALESCE(NULLIF(vendedor,''), NULLIF(nombre_cliente,'MOSTRADOR')) AS vendedor,
     -- cliente interno (si no hay, MOSTRADOR)
     COALESCE(NULLIF(cliente_nombre,''), 'MOSTRADOR') AS cliente,
     DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
     total,
     metodos_pago,
     DATE_FORMAT(creado_en, '%Y-%m-%d %H:%i:%s') AS creado_en
   FROM facturas_mostrador
   WHERE id=? LIMIT 1`,
  [facturaId]
);

    if (!cab.length) return res.status(404).json({ error: "Factura no encontrada" });

    const items = await query(
      `
      SELECT
        fi.id, fi.factura_id, fi.producto_id,
        COALESCE(p.nombre,'(sin nombre)') AS descripcion,
        fi.cantidad, fi.precio_unitario, fi.subtotal
      FROM factura_items fi
      LEFT JOIN productos p ON p.id = fi.producto_id
      WHERE fi.factura_id = ?
      ORDER BY fi.id ASC
      `,
      [facturaId]
    );

    return res.json({ factura: cab[0], items });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error detalle factura" });
  }
}

async function historialArcaPorFactura(req, res) {
  try {
    const facturaId = Number(req.params.id || 0);
    if (!facturaId) return res.status(400).json({ error: "id inválido" });

    const rows = await query(
  `SELECT
     ac.id,
     ac.factura_mostrador_id,
     ac.estado,
     ac.resultado,
     ac.pto_vta,
     ac.cbte_tipo,
     ac.cbte_nro,
     ac.cbte_fch,
     ac.cae,
     ac.cae_vto,
     ac.imp_neto,
     ac.imp_iva,
     ac.imp_total,
     ac.doc_tipo,
     ac.doc_nro,

     -- receptor directo si lo guardaste en arca_comprobantes
     ac.receptor_nombre,
     ac.receptor_cond_iva_id,

     -- fallback desde cache (si no vino en ac.receptor_nombre)
     rc.nombre        AS cache_nombre,
     rc.razon_social  AS cache_razon_social,
     rc.domicilio     AS cache_domicilio,
     rc.cond_iva_id   AS cache_cond_iva_id,

     -- asociación (nota de crédito)
     a.asociado_arca_id,
     a.asoc_pto_vta,
     a.asoc_cbte_tipo,
     a.asoc_cbte_nro,
     a.asoc_cbte_fch,
     a.asoc_cuit,

     ac.obs_code,
     ac.obs_msg,
     DATE_FORMAT(ac.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
   FROM arca_comprobantes ac
   LEFT JOIN arca_receptores_cache rc
     ON rc.doc_tipo = ac.doc_tipo AND rc.doc_nro = ac.doc_nro
   LEFT JOIN arca_cbtes_asoc a
     ON a.arca_comprobante_id = ac.id
   WHERE ac.factura_mostrador_id=?
   ORDER BY ac.id DESC`,
  [facturaId]
);


    return res.json({ rows });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error historial ARCA" });
  }
}
function padLeft(n, len) {
  return String(n ?? "").padStart(len, "0");
}
function ymdToDMY(yyyymmdd) {
  if (!yyyymmdd || !/^\d{8}$/.test(String(yyyymmdd))) return "-";
  const s = String(yyyymmdd);
  return `${s.slice(6,8)}/${s.slice(4,6)}/${s.slice(0,4)}`;
}
function formatCuit(cuit) {
  const d = String(cuit ?? "").replace(/\D/g, "");
  if (d.length !== 11) return String(cuit ?? "");
  return `${d.slice(0,2)}-${d.slice(2,10)}-${d.slice(10)}`;
}
function cbteTitulo(cbteTipo) {
  const t = Number(cbteTipo || 0);

  // Facturas
  if ([1, 6, 11, 51].includes(t)) return "FACTURA ELECTRÓNICA";

  // Notas de Crédito
  if ([3, 8, 13, 53].includes(t)) return "NOTA DE CRÉDITO ELECTRÓNICA";

  // Notas de Débito
  if ([2, 7, 12, 52].includes(t)) return "NOTA DE DÉBITO ELECTRÓNICA";

  return "COMPROBANTE ELECTRÓNICO";
}

function resolveFsPath(p) {
  if (!p) return null;
  if (path.isAbsolute(p)) return p;
  return path.join(process.cwd(), p); // tu .env usa public/images/logo.png
}
function safeImage(doc, filePath, x, y, opts) {
  try {
    const abs = resolveFsPath(filePath);
    if (abs && fs.existsSync(abs)) doc.image(abs, x, y, opts);
  } catch (_) {}
}


function ymdToISO(yyyymmdd) {
  const s = String(yyyymmdd || "");
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}


function buildAfipQrUrl(c) {
  const payload = {
    ver: 1,
    fecha: ymdToISO(c.cbte_fch),
    cuit: Number(c.cuit_emisor),
    ptoVta: Number(c.pto_vta),
    tipoCmp: Number(c.cbte_tipo),
    nroCmp: Number(c.cbte_nro),
    importe: Number(c.imp_total),
    moneda: String(c.mon_id || "PES"),
    cotiz: Number(c.mon_cotiz || 1),
    tipoDocRec: Number(c.doc_tipo),
    nroDocRec: Number(c.doc_nro),
    tipoCodAut: "E",
    codAut: String(c.cae),
  };

  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `https://www.afip.gob.ar/fe/qr/?p=${encodeURIComponent(b64)}`;
}
async function descargarPDFComprobante(req, res) {
  try {
    const arcaId = Number(req.params.arcaId || 0);
    if (!arcaId) return res.status(400).send("arcaId inválido");

    const cab = await query(
      `SELECT c.*,
              rc.nombre       AS cache_nombre,
              rc.razon_social AS cache_razon_social,
              rc.domicilio    AS receptor_domicilio,
              rc.cond_iva_id  AS cache_cond_iva_id
       FROM arca_comprobantes c
       LEFT JOIN arca_receptores_cache rc
         ON rc.doc_tipo=c.doc_tipo AND rc.doc_nro=c.doc_nro
       WHERE c.id=? LIMIT 1`,
      [arcaId]
    );

    const c = cab?.[0];
    if (!c) return res.status(404).send("Comprobante ARCA no encontrado");
    if (c.estado !== "EMITIDO") return res.status(409).send("Solo PDF si está EMITIDO");

    const items = await query(
      `SELECT descripcion, cantidad, precio_unitario, iva_alicuota, imp_neto, imp_iva, imp_total
       FROM arca_comprobante_items
       WHERE arca_comprobante_id=?
       ORDER BY id ASC`,
      [arcaId]
    );

    const qrUrl = buildAfipQrUrl(c);
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 220 });
    const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");

    const emisor = {
      fantasia: process.env.ARCA_PDF_FANTASIA || "AUTOFAROS",
      tagline: process.env.ARCA_PDF_TAGLINE || "LA CASA DE LOS FAROS",
      razon: process.env.ARCA_PDF_RAZON_SOCIAL || "FAWA S.A.S.",
      iva: process.env.ARCA_PDF_IVA || "Responsable Inscripto",
      domicilio: process.env.ARCA_PDF_DOMICILIO || "IGUALDAD 88 - CENTRO - CORDOBA",
      iibb: process.env.ARCA_PDF_IIBB || "289499857",
      inicioAct: process.env.ARCA_PDF_INICIO_ACT || "01/02/2026",
    };

    const letra = claseFromCbteTipo(c.cbte_tipo) || "";
    const titulo = cbteTitulo(c.cbte_tipo);
    const nroFmt = `${padLeft(c.pto_vta, 4)}-${padLeft(c.cbte_nro, 8)}`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="ARCA_${c.pto_vta}-${c.cbte_tipo}-${c.cbte_nro}.pdf"`
    );

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const topY = 40;

    // ===== Footer QR fijo (pegado abajo) =====
    const QR_BLOCK_H = 95;
    const bottomY = () => doc.page.height - doc.page.margins.bottom;
    const footerTopY = () => bottomY() - QR_BLOCK_H;

    const ensureRoomAboveFooter = (extra = 0) => {
      if (doc.y + extra > footerTopY() - 8) doc.addPage();
    };

const drawQrFooter = () => {
  const ft = footerTopY();

  // línea superior del footer
  doc.moveTo(left, ft).lineTo(right, ft).strokeColor("#eee").stroke();

  // QR a la izquierda
  const qrSize = 85;
  const qrX = left;
  const qrY = ft + 6;
  doc.image(qrBuffer, qrX, qrY, { width: qrSize });

  // Texto “ARCA / COMPROBANTE AUTORIZADO” a la derecha del QR
  const textX = qrX + qrSize + 14;
  const textW = right - textX;

  doc.fillColor("#000").font("Helvetica-Bold").fontSize(18)
    .text("ARCA", textX, ft + 18, { width: textW, align: "left" });

  doc.fillColor("#000").font("Helvetica-Bold").fontSize(10)
    .text("COMPROBANTE AUTORIZADO", textX, ft + 40, { width: textW, align: "left" });

  doc.fillColor("#666").font("Helvetica").fontSize(8)
    .text("Verificable escaneando el código QR.", textX, ft + 56, { width: textW, align: "left" });
};


    // ================= HEADER =================
    const pageW = doc.page.width;
    const boxW = 34, boxH = 34;
    const boxX = (pageW - boxW) / 2;
    const boxY = topY;

    // ORIGINAL arriba del cuadrado
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(8)
      .text("ORIGINAL", boxX - 12, boxY - 12, { width: boxW + 24, align: "center" });

    doc.lineWidth(1).strokeColor("#000").rect(boxX, boxY, boxW, boxH).stroke();
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(18)
      .text(letra, boxX, boxY + 7, { width: boxW, align: "center" });

    // “Logo” en texto, a la izquierda
    const brandY = boxY + boxH + 10;

    doc.fillColor("#0B2A6B").font("Helvetica-Bold").fontSize(30)
      .text(emisor.fantasia, left, brandY, { align: "left" });

    // Tagline centrado respecto al ancho de “AUTOFAROS”
    const brandTextW = doc.widthOfString(emisor.fantasia);
    const tagTextW = doc.widthOfString(emisor.tagline);
    const tagX = left + Math.max(0, (brandTextW - tagTextW) / 2);

    doc.fillColor("#666").font("Helvetica").fontSize(10)
      .text(emisor.tagline, tagX, brandY + 30, { align: "left" });

    // 1 renglón de espacio antes de datos FAWA
    const lineGap = 12;
    const infoY = brandY + 44 + lineGap;

    doc.fillColor("#000").font("Helvetica-Bold").fontSize(11)
      .text(`${emisor.razon} · CUIT ${formatCuit(c.cuit_emisor)}`, left, infoY, { width: right - left });

    doc.fillColor("#444").font("Helvetica").fontSize(9)
      .text(`${emisor.iva} · ${emisor.domicilio}`, left, infoY + 14, { width: right - left });

    doc.fillColor("#444").font("Helvetica").fontSize(9)
      .text(`Ingresos Brutos: ${emisor.iibb} · Inicio de Actividad: ${emisor.inicioAct}`, left, infoY + 28, {
        width: right - left,
      });

    const headerBottom = infoY + 28 + 12;
    doc.moveTo(left, headerBottom).lineTo(right, headerBottom).strokeColor("#ddd").stroke();
    doc.y = headerBottom + 12;

    // ================= CUERPO =================
    ensureRoomAboveFooter(70);

    doc.fillColor("#000").font("Helvetica-Bold").fontSize(14).text(titulo, left, doc.y);
    doc.moveDown(0.4);

    doc.font("Helvetica").fontSize(10).fillColor("#333");
    doc.text(`Comprobante N°: ${nroFmt}`);
    doc.text(`Fecha: ${ymdToDMY(c.cbte_fch)}`);
    doc.text(`CAE: ${c.cae}`);
    doc.text(`Vto CAE: ${ymdToDMY(c.cae_vto)}`);

    doc.moveDown(0.8);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#eee").stroke();
    doc.moveDown(0.6);

    // CLIENTE
    const isCF = Number(c.doc_tipo) === 99 && Number(c.doc_nro) === 0;

    ensureRoomAboveFooter(120);

    doc.fillColor("#000").font("Helvetica-Bold").fontSize(11).text("CLIENTE", { underline: true });
    doc.font("Helvetica").fontSize(10).fillColor("#333");

    if (isCF) {
      doc.text("CONSUMIDOR FINAL");
    } else {
      const nombre =
        (c.receptor_nombre || "").trim() ||
        (c.cache_razon_social || "").trim() ||
        (c.cache_nombre || "").trim() ||
        "-";

      doc.text(nombre);
      doc.text(`CUIT: ${formatCuit(c.doc_nro)}`);
      if (c.receptor_domicilio) doc.text(`Domicilio: ${String(c.receptor_domicilio).trim()}`);

      const condId = Number(c.receptor_cond_iva_id || c.cache_cond_iva_id || 0);
      if (condId) {
        let condTexto = `ID ${condId}`;
        try {
          const rows = await getCondIvaReceptorCached();
          const hit = (rows || []).find((x) => Number(x.id) === condId);
          if (hit && hit.desc) condTexto = String(hit.desc).trim();
        } catch (_) {}
        doc.text(`Cond. IVA: ${condTexto}`);
      }
    }

    // ===== NUEVO: un renglón + separador antes del DETALLE =====
    doc.moveDown(1);
    ensureRoomAboveFooter(40);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#eee").stroke();
    doc.moveDown(0.8);

    // ITEMS
    ensureRoomAboveFooter(160);

    doc.fillColor("#000").font("Helvetica-Bold").fontSize(11).text("DETALLE", { underline: true });
    doc.moveDown(0.4);

    const col = { desc: left, cant: 340, unit: 390, iva: 460, sub: right - 70 };

    const headerY = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor("#333");
    doc.text("Descripción", col.desc, headerY);
    doc.text("Cant.", col.cant, headerY, { width: 40, align: "right" });
    doc.text("P.Unit", col.unit, headerY, { width: 60, align: "right" });
    doc.text("IVA", col.iva, headerY, { width: 40, align: "right" });
    doc.text("Subtotal", col.sub, headerY, { width: 70, align: "right" });

    doc.moveDown(0.2);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#ddd").stroke();
    doc.moveDown(0.5);

    doc.fillColor("#000").font("Helvetica").fontSize(9);

    for (const it of items || []) {
      ensureRoomAboveFooter(52);

      const y = doc.y;
      const ivaPct =
        it.iva_alicuota != null && it.iva_alicuota !== ""
          ? `${Number(it.iva_alicuota).toFixed(2)}%`
          : "";

      doc.text(String(it.descripcion || ""), col.desc, y, { width: 290 });
      doc.text(String(it.cantidad ?? ""), col.cant, y, { width: 40, align: "right" });
      doc.text(Number(it.precio_unitario || 0).toFixed(2), col.unit, y, { width: 60, align: "right" });
      doc.text(ivaPct, col.iva, y, { width: 40, align: "right" });
      doc.text(Number(it.imp_total || 0).toFixed(2), col.sub, y, { width: 70, align: "right" });

      doc.moveDown(0.8);
    }

    // ===== NUEVO: Totales abajo de todo (antes del QR) =====
    const TOTALS_BLOCK_H = 90;
    const totalsTop = () => footerTopY() - TOTALS_BLOCK_H - 8;

    if (doc.y > totalsTop() - 8) doc.addPage();
    doc.y = totalsTop();

    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#ddd").stroke();
    doc.moveDown(0.8);

    doc.font("Helvetica").fontSize(10).fillColor("#333");
    doc.text(`Neto: ${Number(c.imp_neto || 0).toFixed(2)}`, { align: "right" });
    doc.text(`IVA: ${Number(c.imp_iva || 0).toFixed(2)}`, { align: "right" });
    if (Number(c.imp_exento || 0) > 0) doc.text(`Exento: ${Number(c.imp_exento).toFixed(2)}`, { align: "right" });

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#000");
    doc.text(`TOTAL: ${Number(c.imp_total || 0).toFixed(2)}`, { align: "right" });

    // Footer QR
    drawQrFooter();

    doc.end();
  } catch (e) {
    console.error("❌ PDF ARCA:", e);
    return res.status(500).send(e.message || "Error generando PDF");
  }
}

function isTrue(v) {
  return ["1", "true", "on", "si", "yes"].includes(String(v ?? "").trim().toLowerCase());
}
function receptorCacheWriteEnabled() {
  // En local+homo con túnel a DB del server: ARCA_DISABLE_RECEPTOR_CACHE_WRITE=1
  return !isTrue(process.env.ARCA_DISABLE_RECEPTOR_CACHE_WRITE);
}

// controllers/arcaController.js
async function buscarReceptor(req, res) {
  try {
    const doc_tipo = Number(req.query.doc_tipo || 0);

    const docNroRaw    = String(req.query.doc_nro ?? "").trim();
    const docNroDigits = docNroRaw.replace(/\D/g, "");
    const doc_nro      = Number(docNroDigits || 0);

    const resolve = isTrue(req.query.resolve);
    const refresh = isTrue(req.query.refresh);
    const debug   = isTrue(req.query.debug);

    // ---------- Validaciones ----------
    if (!Number.isFinite(doc_tipo) || doc_tipo <= 0) {
      return res.status(400).json({ error: "doc_tipo inválido" });
    }
    if (!docNroDigits) {
      return res.status(400).json({ error: "doc_nro inválido" });
    }
    if (doc_tipo === 80 && docNroDigits.length !== 11) {
      return res.status(400).json({ error: "CUIT inválido (se esperan 11 dígitos)" });
    }
    if (!Number.isFinite(doc_nro) || doc_nro <= 0) {
      return res.status(400).json({ error: "doc_nro inválido" });
    }

    if (debug) {
      console.log("[ARCA][buscarReceptor] query =", req.query);
      console.log("[ARCA][buscarReceptor] parsed =", { doc_tipo, doc_nro, docNroDigits });
      console.log("[ARCA][buscarReceptor] resolve =", resolve, "refresh =", refresh);
      console.log("[ARCA][buscarReceptor] cacheWriteEnabled =", receptorCacheWriteEnabled());
    }

    // ---------- 1) Cache (lectura SIEMPRE; cache incompleto => MISS) ----------
    if (!refresh) {
      const cache = await arcaModel.buscarReceptorCache(doc_tipo, doc_nro);

      const cacheOk =
        cache &&
        (
          (cache.razon_social && String(cache.razon_social).trim()) ||
          (cache.nombre && String(cache.nombre).trim()) ||
          (cache.domicilio && String(cache.domicilio).trim())
        );

      if (cacheOk) return res.json(cache);

      if (debug && cache) {
        console.log("[ARCA][buscarReceptor] cache incompleto => MISS", {
          doc_tipo, doc_nro,
          nombre: cache.nombre,
          razon_social: cache.razon_social,
          domicilio: cache.domicilio,
          cond_iva_id: cache.cond_iva_id,
          updated_at: cache.updated_at
        });
      }
    }

    // ---------- 2) Si no pide resolve => termina acá ----------
    if (!resolve) {
      return res.status(404).json({ error: "No encontrado en cache" });
    }

    // ---------- 3) Resolve contra padrón (solo CUIT) ----------
    if (doc_tipo !== 80) {
      return res.status(400).json({ error: "resolve=1 solo soporta doc_tipo=80 (CUIT)" });
    }

    const cuitRepresentada = Number(process.env.ARCA_CUIT || 0);
    if (!Number.isFinite(cuitRepresentada) || cuitRepresentada <= 0) {
      return res.status(500).json({ error: "ARCA_CUIT no configurado" });
    }

    const out = await padron.getPersonaV2({ idPersona: doc_nro, cuitRepresentada });

    // Errores upstream / no encontrado
    if (!out || out.ok === false) {
      const msg = String(out?.fault || out?.error || "No se pudo resolver en padrón");
      const isNotFound = out?.notFound || /no existe|no se encuentra|inexistente/i.test(msg);
      return res.status(isNotFound ? 404 : 502).json({
        error: msg,
        service: out?.service || "ws_sr_padron_a13"
      });
    }

    if (!out.data) {
      return res.status(404).json({
        error: "La Clave (CUIT/CUIL) consultada es inexistente",
        service: out?.service || "ws_sr_padron_a13"
      });
    }

    const receptorData = {
      doc_tipo,
      doc_nro,
      nombre: out.data?.nombre || null,
      razon_social: out.data?.razon_social || out.data?.nombre || null,
      cond_iva_id: null, // si luego mapeás cond IVA desde padrón, setear acá
      domicilio: out.data?.domicilio || null
    };

    // ---------- 4) Guardar en cache (opcional) ----------
    if (receptorCacheWriteEnabled()) {
      await arcaModel.upsertReceptorCache(receptorData);
      const saved = await arcaModel.buscarReceptorCache(doc_tipo, doc_nro);

      // si por alguna razón no quedó completo, igual devolvemos datos de padrón
      return res.json(saved || receptorData);
    }

    // cache write deshabilitado => devolver directo
    return res.json({ ...receptorData, cache_write: false });

  } catch (e) {
    console.error("❌ ARCA buscarReceptor:", e);
    return res.status(500).json({ error: e.message || "Error receptor" });
  }
}

async function paramsCondIvaReceptor(req, res) {
  try {
    const cbte_tipo = Number(req.query.cbte_tipo || 0);
    if (!cbte_tipo) return res.status(400).json({ error: "cbte_tipo requerido" });

    const clase = claseFromCbteTipo(cbte_tipo);
    const all = await getCondIvaReceptorCached();

    const rows = clase
      ? all.filter(x => String(x.cmp_clase || "").toUpperCase().includes(clase))
      : all;

    return res.json({ cbte_tipo, clase, rows });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error params" });
  }
}
async function guardarReceptorCache(req, res) {
  try {
    const doc_tipo = Number(req.body?.doc_tipo || 0);
    const doc_nro_str = String(req.body?.doc_nro ?? "").trim();

    if (!Number.isFinite(doc_tipo) || doc_tipo <= 0) return res.status(400).json({ error: "doc_tipo inválido" });
    if (!/^\d+$/.test(doc_nro_str)) return res.status(400).json({ error: "doc_nro inválido" });
    
    if (doc_tipo === 99) return res.status(400).json({ error: "No se cachea doc_tipo=99 (Consumidor Final)" });
    
    const doc_nro = Number(doc_nro_str);
    if (!Number.isFinite(doc_nro) || doc_nro <= 0) return res.status(400).json({ error: "doc_nro inválido (debe ser > 0)" });

    
    if (doc_tipo === 80 && doc_nro_str.length !== 11) return res.status(400).json({ error: "CUIT inválido (debe tener 11 dígitos)" });

    const nombre = String(req.body?.nombre || "").trim() || null;
    const razon_social = String(req.body?.razon_social || "").trim() || nombre || null;

    let cond_iva_id = req.body?.cond_iva_id;
    cond_iva_id = cond_iva_id === "" || cond_iva_id === undefined || cond_iva_id === null ? null : Number(cond_iva_id);
    if (cond_iva_id !== null && (!Number.isFinite(cond_iva_id) || cond_iva_id <= 0)) {
      return res.status(400).json({ error: "cond_iva_id inválido" });
    }

    const domicilio = String(req.body?.domicilio || "").trim() || null;
    if (!receptorCacheWriteEnabled()) {
  return res.status(403).json({ error: "Cache receptor deshabilitado por ARCA_DISABLE_RECEPTOR_CACHE_WRITE" });
}

    await arcaModel.upsertReceptorCache({ doc_tipo, doc_nro, nombre, razon_social, cond_iva_id, domicilio });

    const saved = await arcaModel.buscarReceptorCache(doc_tipo, doc_nro);
    return res.json(saved || { doc_tipo, doc_nro, nombre, razon_social, cond_iva_id, domicilio });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error guardando cache" });
  }
}

async function auditarWsfePorArcaId(req, res) {
  try {
    const arcaId = Number(req.params.arcaId || 0);
    if (!arcaId) return res.status(400).json({ error: "arcaId inválido" });

    const reconciliar = String(req.query.reconciliar || "") === "1";

    const cab = await query(`SELECT * FROM arca_comprobantes WHERE id=? LIMIT 1`, [arcaId]);
    if (!cab.length) return res.status(404).json({ error: "Comprobante ARCA no encontrado" });

    const c = cab[0];

    const permitido = c.estado === "EMITIDO" || (reconciliar && c.estado === "PENDIENTE");
    if (!permitido) {
      return res.status(409).json({
        error: "Solo se permite auditar EMITIDO, o reconciliar PENDIENTE con ?reconciliar=1",
        estado: c.estado,
      });
    }

    if (!c.cbte_nro) {
      return res.status(409).json({
        error: "El comprobante no tiene cbte_nro reservado (no se puede consultar en WSFE)",
        estado: c.estado,
      });
    }

    // ---------------- Helpers XML ----------------
    const pickBlock = (xml, tag) => {
      const r = new RegExp(
        `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
        "i"
      );
      const m = String(xml || "").match(r);
      return m ? m[1] : "";
    };

    const pickTag = (xml, tag) => {
      const s = String(xml || "");
      const r = new RegExp(
        `<(?:(?:\\w+):)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
        "i"
      );
      const m = s.match(r);
      if (!m) return null;
      return String(m[1] ?? "").trim();
    };

    const pickFirstErr = (xml) => {
      const errorsBlock = pickBlock(xml, "Errors");
      if (!errorsBlock) return null;
      const errBlock = pickBlock(errorsBlock, "Err") || errorsBlock;
      const code = pickTag(errBlock, "Code");
      const msg = pickTag(errBlock, "Msg");
      if (!code && !msg) return null;
      return { code: code || null, msg: msg || null };
    };

    const isValidYMD = (yyyymmdd) => {
      if (!/^\d{8}$/.test(yyyymmdd)) return false;
      const y = Number(yyyymmdd.slice(0, 4));
      const m = Number(yyyymmdd.slice(4, 6));
      const d = Number(yyyymmdd.slice(6, 8));
      if (m < 1 || m > 12) return false;
      const dt = new Date(Date.UTC(y, m - 1, d));
      return (
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() === m - 1 &&
        dt.getUTCDate() === d
      );
    };

    const pickDateTagsStrict = (xml, tags) => {
      const s = String(xml || "");
      for (const tag of tags) {
        const r = new RegExp(
          `<(?:(?:\\w+):)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
          "i"
        );
        const m = s.match(r);
        if (!m) continue;

        const digits = String(m[1]).replace(/\D/g, "");
        const candidates = digits.match(/20\d{6}/g) || [];

        let best = null;
        for (const cand of candidates) {
          if (!isValidYMD(cand)) continue;
          best = best ? (cand > best ? cand : best) : cand;
        }
        if (best) return best;
      }
      return null;
    };

    const pickDate8MaxFromTags = (xml, tags) => pickDateTagsStrict(xml, tags);

    const pickFirst = (xml, tags) => {
      for (const t of tags) {
        const v = pickTag(String(xml || ""), t);
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
      return null;
    };

    const toNum = (x) => Number(Number(x || 0).toFixed(2));

    // ---------------- WSFE Consultar ----------------
    const out = await wsfe.FECompConsultar(c.pto_vta, c.cbte_tipo, c.cbte_nro);

    let raw = out?.raw || "";
    const meta = out?.meta || {};
    if (!raw) {
      raw = `<!-- WSFE EMPTY BODY cbte_tipo=${c.cbte_tipo} pto_vta=${c.pto_vta} cbte_nro=${c.cbte_nro} -->`;
    }

    // SOAP Fault (consultar)
    const fault = pickTag(raw, "faultstring");
    if (fault) {
      await arcaModel.insertarWsfeConsulta({
        arca_comprobante_id: arcaId,
        ok: false,
        parsed_json: {
          mode: "consultar",
          action: "FECompConsultar",
          http_status: meta?.statusCode ?? null,
          soapAction: meta?.soapAction ?? null,
          url: meta?.url ?? null,
          req_xml: meta?.requestXml ?? null,
          fault,
          raw_hint: "faultstring",
        },
        resp_xml: raw,
      });

      return res.status(502).json({
        arca_id: arcaId,
        ok: false,
        reconciliado: false,
        wsfe_error: { type: "SOAP_FAULT", faultstring: fault },
        wsfe: null,
        db: {
          cbte_nro: Number(c.cbte_nro),
          cbte_fch: c.cbte_fch,
          cae: c.cae,
          cae_vto: c.cae_vto,
          imp_total: c.imp_total,
          imp_neto: c.imp_neto,
          imp_iva: c.imp_iva,
        },
      });
    }

    // Errors (ej: 602 No existen datos)
    const err = pickFirstErr(raw);
    if (err?.code) {
      const payload = {
        mode: "consultar",
        action: "FECompConsultar",
        http_status: meta?.statusCode ?? null,
        soapAction: meta?.soapAction ?? null,
        url: meta?.url ?? null,
        req_xml: meta?.requestXml ?? null,
        wsfe_error: { code: String(err.code), msg: err.msg || null },
      };

      await arcaModel.insertarWsfeConsulta({
        arca_comprobante_id: arcaId,
        ok: false,
        parsed_json: payload,
        resp_xml: raw,
      });

      // 602 => no existe en WSFE (clave para detectar falsos EMITIDO)
      if (String(err.code) === "602") {
        return res.json({
          arca_id: arcaId,
          reconciliado: false,
          ok: false,
          diffs: { wsfe_error: { code: "602", msg: err.msg || null } },
          wsfe_error: { code: "602", msg: err.msg || null },
          wsfe: null,
          db: {
            cbte_nro: Number(c.cbte_nro),
            cbte_fch: c.cbte_fch,
            cae: c.cae,
            cae_vto: c.cae_vto,
            imp_total: c.imp_total,
            imp_neto: c.imp_neto,
            imp_iva: c.imp_iva,
          },
        });
      }

      return res.status(502).json({
        arca_id: arcaId,
        ok: false,
        reconciliado: false,
        wsfe_error: { code: String(err.code), msg: err.msg || null },
      });
    }

    const resultGetBlock = pickBlock(raw, "ResultGet");
    if (!resultGetBlock) {
      // sin Errors pero sin ResultGet => no confiable
      const payload = {
        mode: "consultar",
        action: "FECompConsultar",
        http_status: meta?.statusCode ?? null,
        soapAction: meta?.soapAction ?? null,
        url: meta?.url ?? null,
        req_xml: meta?.requestXml ?? null,
        wsfe_error: { code: "NO_RESULTGET", msg: "WSFE no devolvió ResultGet" },
      };

      await arcaModel.insertarWsfeConsulta({
        arca_comprobante_id: arcaId,
        ok: false,
        parsed_json: payload,
        resp_xml: raw,
      });

      return res.status(502).json({
        arca_id: arcaId,
        ok: false,
        reconciliado: false,
        wsfe_error: payload.wsfe_error,
      });
    }

    const parsed = {
      cbte_nro: Number(pickFirst(resultGetBlock, ["CbteDesde", "CbteNro"])) || Number(c.cbte_nro),
      cbte_fch: pickDate8MaxFromTags(resultGetBlock, ["CbteFch"]),
      cae: pickFirst(resultGetBlock, ["CodAutorizacion", "CAE"]),
      cae_vto: pickDate8MaxFromTags(resultGetBlock, ["CAEFchVto", "FchVto"]),
      doc_tipo: Number(pickFirst(resultGetBlock, ["DocTipo"])) || Number(c.doc_tipo),
      doc_nro: Number(pickFirst(resultGetBlock, ["DocNro"])) || Number(c.doc_nro),
      imp_total: Number(pickFirst(resultGetBlock, ["ImpTotal"])) || 0,
      imp_neto: Number(pickFirst(resultGetBlock, ["ImpNeto"])) || 0,
      imp_iva: Number(pickFirst(resultGetBlock, ["ImpIVA"])) || 0,
      mon_id: pickFirst(resultGetBlock, ["MonId"]) || "PES",
      mon_cotiz: pickFirst(resultGetBlock, ["MonCotiz"]) || "1",
    };

    // diffs contra DB actual
    const diffs = {};

    if (String(parsed.cae || "") !== String(c.cae || ""))
      diffs.cae = { wsfe: parsed.cae || null, db: c.cae || null };

    if (String(parsed.cae_vto || "") !== String(c.cae_vto || ""))
      diffs.cae_vto = { wsfe: parsed.cae_vto || null, db: c.cae_vto || null };

    if (String(parsed.cbte_fch || "") !== String(c.cbte_fch || ""))
      diffs.cbte_fch = { wsfe: parsed.cbte_fch || null, db: c.cbte_fch || null };

    if (toNum(parsed.imp_total) !== toNum(c.imp_total))
      diffs.imp_total = { wsfe: toNum(parsed.imp_total), db: toNum(c.imp_total) };

    if (toNum(parsed.imp_neto) !== toNum(c.imp_neto))
      diffs.imp_neto = { wsfe: toNum(parsed.imp_neto), db: toNum(c.imp_neto) };

    if (toNum(parsed.imp_iva) !== toNum(c.imp_iva))
      diffs.imp_iva = { wsfe: toNum(parsed.imp_iva), db: toNum(c.imp_iva) };

    let ok = Object.keys(diffs).length === 0;
    let reconciliado = ok;

    // reconciliar PENDIENTE si WSFE trae CAE
    if (reconciliar && c.estado === "PENDIENTE" && parsed.cae) {
      await arcaModel.actualizarRespuesta(arcaId, {
        resultado: "A",
        cae: parsed.cae,
        cae_vto: parsed.cae_vto || null,
        obs_code: "RECONCILIADO",
        obs_msg: "Autorizado en WSFE luego de confirmación manual",
        resp_xml: raw,
        estado: "EMITIDO",
      });

      reconciliado = true;
      ok = true;

      if (parsed.cbte_fch && parsed.cbte_fch !== c.cbte_fch) {
        await query(`UPDATE arca_comprobantes SET cbte_fch=?, updated_at=NOW() WHERE id=?`, [
          parsed.cbte_fch,
          arcaId,
        ]);
      }
    }

    // Guardar auditoría (consultar)
    const auditParsed = {
      mode: "consultar",
      action: "FECompConsultar",
      http_status: meta?.statusCode ?? null,
      soapAction: meta?.soapAction ?? null,
      url: meta?.url ?? null,
      req_xml: meta?.requestXml ?? null,

      reconciliar,
      reconciliado,
      ok,
      diffs: reconciliado ? {} : diffs,
      parsed,
    };

    await arcaModel.insertarWsfeConsulta({
      arca_comprobante_id: arcaId,
      ok,
      parsed_json: auditParsed,
      resp_xml: raw,
    });

    return res.json({
      arca_id: arcaId,
      reconciliado,
      ok,
      diffs: reconciliado ? {} : diffs,
      wsfe: parsed,
      db: {
        cbte_nro: Number(c.cbte_nro),
        cbte_fch: c.cbte_fch,
        cae: c.cae,
        cae_vto: c.cae_vto,
        imp_total: c.imp_total,
        imp_neto: c.imp_neto,
        imp_iva: c.imp_iva,
      },
    });
  } catch (e) {
    console.error("❌ auditarWsfePorArcaId:", e);
    return res.status(500).json({ error: e.message || "Error consultando WSFE" });
  }
}

async function listarWsfeConsultas(req, res) {
  try {
    const arcaId = Number(req.params.arcaId || 0);
    if (!Number.isFinite(arcaId) || arcaId <= 0) {
      return res.status(400).json({ error: "arcaId inválido" });
    }

    const limitRaw = Number(req.query.limit || 20);
    const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? limitRaw : 20));

    const rows = await arcaModel.listarWsfeConsultas(arcaId, limit);

    const safeJson = (v) => {
      try {
        if (v == null) return null;
        if (typeof v === "string") return JSON.parse(v);
        return v; // mysql puede devolver objeto si es JSON nativo
      } catch {
        return null;
      }
    };

    const mapped = rows.map((r) => {
      const pj = safeJson(r.parsed_json);
      return {
        id: r.id,
        ok: !!r.ok,
        created_at: r.created_at,
        diffs: pj?.diffs ?? null,
        parsed: pj?.parsed ?? null,
        fault: pj?.fault ?? null,
        debug: pj?.debug ?? null,
      };
    });

    return res.json({ arca_id: arcaId, limit, rows: mapped });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error listando auditorías WSFE" });
  }
}
function isoToYmd8(iso) {
  // iso: YYYY-MM-DD
  return String(iso || "").replace(/-/g, "");
}
function ymd8ToIso(ymd8) {
  return `${ymd8.slice(0,4)}-${ymd8.slice(4,6)}-${ymd8.slice(6,8)}`;
}

function todayIsoAR() {
  // evita UTC (Argentina)
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Cordoba" }).format(new Date());
}

async function reportesResumen(req, res) {
  try {
    const desde = req.query.desde;
    const hasta = req.query.hasta;
    if (!desde || !hasta) return res.status(400).json({ error: "Faltan parametros: desde, hasta" });

    const desdeYmd = isoToYmd8(desde);
    const hastaYmd = isoToYmd8(hasta);
    if (!isValidYMD(desdeYmd) || !isValidYMD(hastaYmd)) {
      return res.status(400).json({ error: "Formato invalido. Use YYYY-MM-DD" });
    }

    const ambiente = process.env.ARCA_ENV || "homo";
    const cuit_emisor = process.env.ARCA_CUIT || process.env.CUIT || "30718763718";
    const pto_vta = Number(process.env.ARCA_PTO_VTA || 2);

    const estado = (req.query.estado ?? "EMITIDO"); // "" => todos
    const rows = await arcaModel.reportesResumen(pool, { ambiente, cuit_emisor, pto_vta, desdeYmd, hastaYmd, estado: estado || null });

    // Totales generales (en JS)
    const tot = rows.reduce((acc, r) => {
      acc.cant_facturas += Number(r.cant_facturas || 0);
      acc.cant_nc += Number(r.cant_nc || 0);
      acc.total_facturas += Number(r.total_facturas || 0);
      acc.total_nc += Number(r.total_nc || 0);
      acc.ventas_netas += Number(r.ventas_netas || 0);
      return acc;
    }, { cant_facturas:0, cant_nc:0, total_facturas:0, total_nc:0, ventas_netas:0 });

    return res.json({ desde, hasta, estado: estado || null, dias: rows.map(d => ({ ...d, fecha: ymd8ToIso(d.fecha_ymd) })), totales: tot });
  } catch (e) {
    console.error("[ARCA][reportesResumen]", e);
    return res.status(500).json({ error: "Error interno en reportesResumen" });
  }
}

async function reportesComprobantes(req, res) {
  try {
    const desde = req.query.desde;
    const hasta = req.query.hasta;
    if (!desde || !hasta) return res.status(400).json({ error: "Faltan parametros: desde, hasta" });

    const desdeYmd = isoToYmd8(desde);
    const hastaYmd = isoToYmd8(hasta);
    if (!isValidYMD(desdeYmd) || !isValidYMD(hastaYmd)) {
      return res.status(400).json({ error: "Formato invalido. Use YYYY-MM-DD" });
    }

    const ambiente = process.env.ARCA_ENV || "homo";
    const cuit_emisor = process.env.ARCA_CUIT || process.env.CUIT || "30718763718";
    const pto_vta = Number(process.env.ARCA_PTO_VTA || 2);

    const estado = (req.query.estado ?? "EMITIDO"); // "" => todos
    const cbte_tipo = req.query.cbte_tipo ? Number(req.query.cbte_tipo) : null;

    const rows = await arcaModel.reportesComprobantes(pool, {
      ambiente, cuit_emisor, pto_vta,
      desdeYmd, hastaYmd,
      estado: estado || null,
      cbte_tipo
    });

    return res.json({ desde, hasta, estado: estado || null, cbte_tipo, comprobantes: rows });
  } catch (e) {
    console.error("[ARCA][reportesComprobantes]", e);
    return res.status(500).json({ error: "Error interno en reportesComprobantes" });
  }
}

async function crearCierreDiario(req, res) {
  try {
    const fechaIso = req.body?.fecha || req.query?.fecha || todayIsoAR();
    const fechaYmd = isoToYmd8(fechaIso);
    if (!isValidYMD(fechaYmd)) return res.status(400).json({ error: "Fecha invalida. Use YYYY-MM-DD" });

    const ambiente = process.env.ARCA_ENV || "homo";
    const cuit_emisor = process.env.ARCA_CUIT || process.env.CUIT || "30718763718";
    const pto_vta = Number(process.env.ARCA_PTO_VTA || 2);

    const usuario_email = req.session?.usuario?.email || null;

    const r = await arcaModel.crearCierreDiario(pool, {
      ambiente, cuit_emisor, pto_vta,
      fechaYmd,
      usuario_email
    });

    return res.json({ ok: true, fecha: fechaIso, ...r });
  } catch (e) {
    // duplicate key
    if (String(e?.code) === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Ya existe cierre diario para esa fecha" });
    }
    console.error("[ARCA][crearCierreDiario]", e);
    return res.status(500).json({ error: "Error interno en crearCierreDiario" });
  }
}

async function listarCierresDiarios(req, res) {
  try {
    const desde = req.query.desde || todayIsoAR();
    const hasta = req.query.hasta || todayIsoAR();
    const desdeYmd = isoToYmd8(desde);
    const hastaYmd = isoToYmd8(hasta);
    if (!isValidYMD(desdeYmd) || !isValidYMD(hastaYmd)) return res.status(400).json({ error: "Formato invalido. Use YYYY-MM-DD" });

    const ambiente = process.env.ARCA_ENV || "homo";
    const cuit_emisor = process.env.ARCA_CUIT || process.env.CUIT || "30718763718";
    const pto_vta = Number(process.env.ARCA_PTO_VTA || 2);

    const rows = await arcaModel.listarCierresDiarios(pool, { ambiente, cuit_emisor, pto_vta, desdeYmd, hastaYmd });
    return res.json({ desde, hasta, cierres: rows.map(r => ({ ...r, fecha: ymd8ToIso(r.fecha) })) });
  } catch (e) {
    console.error("[ARCA][listarCierresDiarios]", e);
    return res.status(500).json({ error: "Error interno en listarCierresDiarios" });
  }
}

async function detalleCierreDiario(req, res) {
  try {
    const fechaParam = req.params.fecha; // acepta YYYY-MM-DD o YYYYMMDD
    const fechaYmd = String(fechaParam).includes("-") ? isoToYmd8(fechaParam) : String(fechaParam);
    if (!isValidYMD(fechaYmd)) return res.status(400).json({ error: "Fecha invalida" });

    const ambiente = process.env.ARCA_ENV || "homo";
    const cuit_emisor = process.env.ARCA_CUIT || process.env.CUIT || "30718763718";
    const pto_vta = Number(process.env.ARCA_PTO_VTA || 2);

    const row = await arcaModel.detalleCierreDiario(pool, { ambiente, cuit_emisor, pto_vta, fechaYmd });
    if (!row) return res.status(404).json({ error: "Cierre no encontrado" });

    return res.json({ ok: true, cierre: row });
  } catch (e) {
    console.error("[ARCA][detalleCierreDiario]", e);
    return res.status(500).json({ error: "Error interno en detalleCierreDiario" });
  }
}


module.exports = {
  emitirDesdeFacturaMostrador,
  statusPorFacturaMostrador,
  vistaArcaIndex,
  listarFacturasMostrador,
  detalleFacturaMostrador,
  historialArcaPorFactura,
  descargarPDFComprobante,
  buscarReceptor,
  paramsCondIvaReceptor,
  guardarReceptorCache,
  auditarWsfePorArcaId,
  listarWsfeConsultas,
  emitirNotaCreditoPorArcaId,
  reportesResumen,
reportesComprobantes,
crearCierreDiario,
listarCierresDiarios,
detalleCierreDiario,
};
