// controllers/arcaController.js
require("dotenv").config();
const arcaCalc = require("../services/arca_calc");

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

function claseFromCbteTipo(cbteTipo) {
  const t = Number(cbteTipo);
  if ([1,2,3,4,5].includes(t)) return "A";     // Fact A / ND A / NC A / ...
  if ([6,7,8,9,10].includes(t)) return "B";    // Fact B / ND B / NC B / ...
  if ([11,12,13,14,15].includes(t)) return "C"; // Fact C / ND C / NC C / ...
  return null;
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

    const doc_nro_str = String(req.body.doc_nro ?? "").trim();
    if (!/^\d+$/.test(doc_nro_str)) return res.status(400).json({ error: "doc_nro inválido" });
    const doc_nro = Number(doc_nro_str);

    const receptor_cond_iva_id = Number(req.body.receptor_cond_iva_id || 5);
    let receptor_nombre = String(req.body.receptor_nombre || "").trim() || null;

    if (!Number.isFinite(cbte_tipo) || cbte_tipo <= 0) return res.status(400).json({ error: "cbte_tipo inválido" });
    if (!Number.isFinite(doc_tipo) || doc_tipo <= 0) return res.status(400).json({ error: "doc_tipo inválido" });
    if (!Number.isFinite(receptor_cond_iva_id) || receptor_cond_iva_id <= 0) {
      return res.status(400).json({ error: "receptor_cond_iva_id inválido" });
    }

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

    // ===== Reglas de negocio (server-side) =====
    const { clase, ids: allowedCondIvaIds } = await getAllowedCondIvaIdsForCbte(cbte_tipo);
    if (!clase) return res.status(400).json({ error: "cbte_tipo no soportado", cbte_tipo });

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

    const pto_vta = Number(process.env.ARCA_PTO_VTA || 0);
    const cuit_emisor = Number(process.env.ARCA_CUIT || 0);
    if (!Number.isFinite(pto_vta) || pto_vta <= 0) return res.status(500).json({ error: "ARCA_PTO_VTA no configurado" });
    if (!Number.isFinite(cuit_emisor) || cuit_emisor <= 0) return res.status(500).json({ error: "ARCA_CUIT no configurado" });

    const ambiente = String(process.env.ARCA_ENV || "homo").toUpperCase() === "PROD" ? "PROD" : "HOMO";

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
    const imp_neto  = totales.imp_neto;
    const imp_iva   = totales.imp_iva;

    // --- helpers para reconciliación (FECompConsultar devuelve solo XML crudo) ---
    const pickBlock = (xml, tag) => {
      const r = new RegExp(`<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`, "i");
      const m = String(xml || "").match(r);
      return m ? m[1] : "";
    };
    const pickDate8 = (xml, tags) => {
      for (const t of tags) {
        const v = pickTag(xml, t);
        if (!v) continue;
        const digits = String(v).replace(/\D/g, "");
        const m = digits.match(/(20\d{6})/);
        if (m) return m[1];
      }
      return null;
    };
    const pickFirst = (xml, tags) => {
      for (const t of tags) {
        const v = pickTag(xml, t);
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
      return null;
    };
    const reconciliarEnWsfe = async (ptoVta, cbteTipo, cbteNro) => {
      // 3 intentos cortos por consistencia eventual
      for (let i = 1; i <= 3; i++) {
        try {
          const out = await wsfe.FECompConsultar(ptoVta, cbteTipo, cbteNro);
          const raw = out?.raw || "";

          const fault = pickTag(raw, "faultstring");
          if (fault) return { ok: false, fault, raw };

          const resultGetXml = pickBlock(raw, "ResultGet") || raw;
          const cae = pickFirst(resultGetXml, ["CodAutorizacion", "CAE"]);
          const cae_vto = pickDate8(resultGetXml, ["FchVto", "CAEFchVto"]);
          const cbte_fch_wsfe = pickDate8(resultGetXml, ["CbteFch"]);

          if (cae) return { ok: true, cae, cae_vto, cbte_fch: cbte_fch_wsfe, raw };
          // no hay CAE -> puede no existir todavía / no autorizado
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
        totales: { imp_total, imp_neto, imp_iva },
        iva: { omitirIva, ivaAlicuotas },
        items: itemsCalc,
        debug: { ultimo_autorizado: info.ultimo, last_cbte_fch: info.lastCbteFch, today: info.today, alloc_attempt: attempt },
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
    try {
      cae = await wsfe.FECAESolicitar({
        ptoVta: pto_vta,
        cbteTipo: cbte_tipo,
        docTipo: doc_tipo,
        docNro: doc_nro,
        condicionIVAReceptorId: receptor_cond_iva_id,
        cbteFch: cbte_fch,
        cbteDesde: next,
        cbteHasta: next,
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
    } catch (err) {
      const msg = err?.message || String(err);

      // Reconciliar: si se autorizó igual, marcar EMITIDO
      const rec = await reconciliarEnWsfe(pto_vta, cbte_tipo, next);
      if (rec.ok && rec.cae) {
        await arcaModel.actualizarRespuesta(arcaId, {
          resultado: "A",
          cae: rec.cae,
          cae_vto: rec.cae_vto || null,
          obs_code: "RECONCILIADO",
          obs_msg: "Autorizado en WSFE luego de excepción",
          resp_xml: rec.raw || null,
          estado: "EMITIDO",
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

      // No se pudo confirmar: dejar PENDIENTE (no liberar cbte_nro)
      await arcaModel.actualizarRespuesta(arcaId, {
        resultado: null,
        cae: null,
        cae_vto: null,
        obs_code: "WSFE_EXC",
        obs_msg: msg.slice(0, 1000),
        resp_xml: null,
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

    // Reintento si 10016 (fecha) + reserva robusta ante uq_cbte
    if (cae.resultado === "R" && String(cae.obsCode) === "10016") {
      let updated = false;

      for (let attempt = 1; attempt <= MAX_ALLOC_TRIES; attempt++) {
        info = await getNextAndDates(pto_vta, cbte_tipo);
        next = info.next;
        cbte_fch = info.cbte_fch;

        reqObj.cbte_nro = next;
        reqObj.cbte_fch = cbte_fch;
        reqObj.debug = { ultimo_autorizado: info.ultimo, last_cbte_fch: info.lastCbteFch, today: info.today, retry: true, alloc_attempt: attempt };
        req_json = JSON.stringify(reqObj, null, 2);

        try {
          await query(
            `UPDATE arca_comprobantes SET cbte_nro=?, cbte_fch=?, req_json=?, updated_at=NOW() WHERE id=?`,
            [next, cbte_fch, req_json, arcaId]
          );
          updated = true;
          break;
        } catch (err) {
          if (isDupKey(err, "uq_cbte")) {
            if (attempt === MAX_ALLOC_TRIES) {
              await arcaModel.actualizarRespuesta(arcaId, {
                resultado: "R",
                cae: null,
                cae_vto: null,
                obs_code: "DUP_CBTE",
                obs_msg: "Choque de numeración (uq_cbte) al reintentar por 10016",
                resp_xml: null,
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
          docTipo: doc_tipo,
          docNro: doc_nro,
          condicionIVAReceptorId: receptor_cond_iva_id,
          cbteFch: cbte_fch,
          cbteDesde: next,
          cbteHasta: next,
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
      } catch (err) {
        const msg = err?.message || String(err);

        const rec = await reconciliarEnWsfe(pto_vta, cbte_tipo, next);
        if (rec.ok && rec.cae) {
          await arcaModel.actualizarRespuesta(arcaId, {
            resultado: "A",
            cae: rec.cae,
            cae_vto: rec.cae_vto || null,
            obs_code: "RECONCILIADO",
            obs_msg: "Autorizado en WSFE luego de excepción (retry)",
            resp_xml: rec.raw || null,
            estado: "EMITIDO",
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

        await arcaModel.actualizarRespuesta(arcaId, {
          resultado: null,
          cae: null,
          cae_vto: null,
          obs_code: "WSFE_EXC",
          obs_msg: msg.slice(0, 1000),
          resp_xml: null,
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

    await arcaModel.actualizarRespuesta(arcaId, {
      resultado: cae.resultado || null,
      cae: cae.cae || null,
      cae_vto: cae.caeVto || null,
      obs_code: cae.obsCode || null,
      obs_msg: cae.obsMsg || null,
      resp_xml: cae.raw || null,
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
          domicilio: null,
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
    // Si ya creamos el comprobante y algo explotó, no dejarlo PENDIENTE colgado
    if (arcaId) {
      try {
        await arcaModel.actualizarRespuesta(arcaId, {
          resultado: null,
          cae: null,
          cae_vto: null,
          obs_code: "EXC",
          obs_msg: (e?.message || String(e)).slice(0, 1000),
          resp_xml: null,
          estado: "RECHAZADO",
        });
        await query(`UPDATE arca_comprobantes SET cbte_nro=NULL, updated_at=NOW() WHERE id=?`, [arcaId]);
      } catch (_) {}
    }

    console.error("❌ ARCA emitirDesdeFacturaMostrador:", e);
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

// GET /arca/ui/facturas?limit=50&offset=0
async function listarFacturasMostrador(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const rows = await query(
      `
      SELECT
        fm.id,
        fm.nombre_cliente,
        DATE_FORMAT(fm.fecha, '%Y-%m-%d') AS fecha,
        fm.total,
        fm.metodos_pago,
        DATE_FORMAT(fm.creado_en, '%Y-%m-%d %H:%i:%s') AS creado_en,

        ac.estado      AS arca_estado,
        ac.resultado   AS arca_resultado,
        ac.cae         AS arca_cae,
        ac.cae_vto     AS arca_cae_vto,
        ac.cbte_tipo   AS arca_cbte_tipo,
        ac.cbte_nro    AS arca_cbte_nro,
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


// GET /arca/ui/facturas/:id
async function detalleFacturaMostrador(req, res) {
  try {
    const facturaId = Number(req.params.id || 0);
    if (!facturaId) return res.status(400).json({ error: "id inválido" });

    const cab = await query(
  `SELECT
     id,
     nombre_cliente,
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

// GET /arca/ui/arca-por-factura/:id
async function historialArcaPorFactura(req, res) {
  try {
    const facturaId = Number(req.params.id || 0);
    if (!facturaId) return res.status(400).json({ error: "id inválido" });

    const rows = await query(
      `
      SELECT id, factura_mostrador_id, ambiente, pto_vta, cbte_tipo, cbte_nro, cbte_fch,
             doc_tipo, doc_nro, imp_total, imp_neto, imp_iva,
             resultado, cae, cae_vto, obs_code, obs_msg, estado, created_at
      FROM arca_comprobantes
      WHERE factura_mostrador_id=?
      ORDER BY id DESC
      LIMIT 20
      `,
      [facturaId]
    );

    return res.json({ rows });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error historial ARCA" });
  }
}
function ymdToHuman(yyyymmdd) {
  if (!yyyymmdd || !/^\d{8}$/.test(String(yyyymmdd))) return "-";
  const s = String(yyyymmdd);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function ymdToISO(yyyymmdd) {
  // AFIP QR usa YYYY-MM-DD
  return ymdToHuman(yyyymmdd);
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
      `SELECT * FROM arca_comprobantes WHERE id=? LIMIT 1`,
      [arcaId]
    );
    if (!cab.length) return res.status(404).send("Comprobante no encontrado");

    const c = cab[0];

    if (c.estado !== "EMITIDO") {
      return res.status(409).send("Solo PDF si está EMITIDO");
    }

    const items = await query(
      `SELECT descripcion, cantidad, precio_unitario, iva_alicuota, imp_neto, imp_iva, imp_total
       FROM arca_comprobante_items
       WHERE arca_comprobante_id=?
       ORDER BY id ASC`,
      [arcaId]
    );

    // QR
    const qrUrl = buildAfipQrUrl(c);
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 180 });
    const qrBase64 = qrDataUrl.split(",")[1];
    const qrBuffer = Buffer.from(qrBase64, "base64");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="ARCA_${c.pto_vta}-${c.cbte_tipo}-${c.cbte_nro}.pdf"`
    );

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    // Encabezado
    doc.fontSize(16).text("Comprobante electrónico", 40, 40);
    doc.fontSize(10).fillColor("#444");

    doc.text(`Ambiente: ${c.ambiente}  |  CUIT emisor: ${c.cuit_emisor}`);
    doc.text(`PtoVta: ${c.pto_vta}  |  Tipo: ${c.cbte_tipo}  |  Nro: ${c.cbte_nro}`);
    doc.text(`Fecha: ${ymdToHuman(c.cbte_fch)}  |  CAE: ${c.cae}  |  Vto CAE: ${ymdToHuman(c.cae_vto)}`);

    // QR a la derecha
    doc.image(qrBuffer, 430, 40, { width: 120 });

    doc.moveDown(1.2);
    doc.fillColor("#000").fontSize(11).text("Receptor", { underline: true });
    doc.fontSize(10).text(`DocTipo: ${c.doc_tipo}  |  DocNro: ${c.doc_nro}`);
    if (c.receptor_nombre) doc.text(`Nombre / Razón social: ${c.receptor_nombre}`);
    if (c.receptor_cond_iva_id) doc.text(`Cond. IVA ID: ${c.receptor_cond_iva_id}`);

    doc.moveDown(0.8);
    doc.fontSize(11).text("Items", { underline: true });
    doc.moveDown(0.4);

    // Tabla simple
    const startY = doc.y;
    doc.fontSize(9).fillColor("#333");
    doc.text("Descripción", 40, startY);
    doc.text("Cant.", 320, startY, { width: 40, align: "right" });
    doc.text("P.Unit", 370, startY, { width: 70, align: "right" });
    doc.text("Total", 450, startY, { width: 90, align: "right" });
    doc.moveDown(0.2);
    doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor("#ddd").stroke();
    doc.moveDown(0.5);

    doc.fillColor("#000");
    for (const it of items) {
      const y = doc.y;
      doc.fontSize(9).text(String(it.descripcion || ""), 40, y, { width: 260 });
      doc.text(String(it.cantidad), 320, y, { width: 40, align: "right" });
      doc.text(Number(it.precio_unitario).toFixed(2), 370, y, { width: 70, align: "right" });
      doc.text(Number(it.imp_total).toFixed(2), 450, y, { width: 90, align: "right" });
      doc.moveDown(0.7);
    }

    doc.moveDown(0.4);
    doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor("#ddd").stroke();
    doc.moveDown(0.6);

    doc.fontSize(10);
    doc.text(`Neto: ${Number(c.imp_neto).toFixed(2)}`, { align: "right" });
    doc.text(`IVA: ${Number(c.imp_iva).toFixed(2)}`, { align: "right" });
    if (Number(c.imp_exento || 0) > 0) doc.text(`Exento: ${Number(c.imp_exento).toFixed(2)}`, { align: "right" });
    doc.fontSize(12).text(`TOTAL: ${Number(c.imp_total).toFixed(2)}`, { align: "right" });

    doc.moveDown(0.8);
    doc.fontSize(8).fillColor("#666").text(qrUrl, { width: 510 });

    doc.end();
  } catch (e) {
    console.error("❌ PDF ARCA:", e);
    return res.status(500).send(e.message || "Error generando PDF");
  }
}
// controllers/arcaController.js
// Requiere arriba: const padron = require("../services/padron");

async function buscarReceptor(req, res) {
  try {
    const doc_tipo = Number(req.query.doc_tipo || 0);
    const doc_nro  = Number(req.query.doc_nro  || 0);

    const resolveStr = String(req.query.resolve ?? "").trim().toLowerCase();
    const resolve = ["1", "true", "on", "si", "yes"].includes(resolveStr);

    const refreshStr = String(req.query.refresh ?? "").trim().toLowerCase();
    const refresh = ["1", "true", "on", "si", "yes"].includes(refreshStr);

    const debugStr = String(req.query.debug ?? "").trim().toLowerCase();
    const debug = ["1", "true", "on", "si", "yes"].includes(debugStr);

    if (!Number.isFinite(doc_tipo) || doc_tipo <= 0) {
      return res.status(400).json({ error: "doc_tipo inválido" });
    }
    if (!Number.isFinite(doc_nro) || doc_nro <= 0) {
      return res.status(400).json({ error: "doc_nro inválido" });
    }

    if (debug) {
      console.log("[ARCA][buscarReceptor] query =", req.query);
      console.log("[ARCA][buscarReceptor] resolve =", resolve, "refresh =", refresh);
    }

    // 1) cache (si no forzás refresh)
    if (!refresh) {
      const cache = await arcaModel.buscarReceptorCache(doc_tipo, doc_nro);
      if (cache) return res.json(cache);
    }

    // 2) si no pide resolve => termina acá
    if (!resolve) {
      return res.status(404).json({ error: "No encontrado en cache" });
    }

    // 3) resolve contra padrón (solo CUIT por ahora)
    if (doc_tipo !== 80) {
      return res.status(400).json({ error: "resolve=1 solo soporta doc_tipo=80 (CUIT)" });
    }

    const cuitRepresentada = Number(process.env.ARCA_CUIT || 0);
    if (!Number.isFinite(cuitRepresentada) || cuitRepresentada <= 0) {
      return res.status(500).json({ error: "ARCA_CUIT no configurado" });
    }

    const out = await padron.getPersonaV2({ idPersona: doc_nro, cuitRepresentada });
if (out?.notFound || !out?.data) {
  return res.status(404).json({
    error: "No encontrado en padrón",
    service: out?.service || "ws_sr_padron_a13",
  });
}

   if (!out || !out.ok) {
  const msg = String(out?.fault || out?.error || "No se pudo resolver en padrón");
  const isNotFound = /no existe|no se encuentra|inexistente/i.test(msg);
  return res.status(isNotFound ? 404 : 502).json({ error: msg, service: out?.service || null });
}
// Si el servicio respondió "OK" pero sin datos, lo tratamos como NO ENCONTRADO
if (!out.data) {
  return res.status(404).json({
    error: "La Clave (CUIT/CUIL) consultada es inexistente",
    service: out?.service || "ws_sr_padron_a13",
  });
}


    // Guardar en cache
    await arcaModel.upsertReceptorCache({
      doc_tipo,
      doc_nro,
      nombre: out.data?.nombre || null,
      razon_social: out.data?.razon_social || out.data?.nombre || null,
      cond_iva_id: null,
      domicilio: out.data?.domicilio || null,
    });

    const saved = await arcaModel.buscarReceptorCache(doc_tipo, doc_nro);
    return res.json(saved || {
      doc_tipo,
      doc_nro,
      nombre: out.data?.nombre || null,
      razon_social: out.data?.razon_social || out.data?.nombre || null,
      cond_iva_id: null,
      domicilio: out.data?.domicilio || null,
    });
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

    await arcaModel.upsertReceptorCache({ doc_tipo, doc_nro, nombre, razon_social, cond_iva_id, domicilio });

    const saved = await arcaModel.buscarReceptorCache(doc_tipo, doc_nro);
    return res.json(saved || { doc_tipo, doc_nro, nombre, razon_social, cond_iva_id, domicilio });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error guardando cache" });
  }
}
// GET /arca/wsfe/consultar/:arcaId
// - EMITIDO: audita y compara
// - PENDIENTE + ?reconciliar=1: consulta WSFE y si hay CAE, actualiza a EMITIDO
async function auditarWsfePorArcaId(req, res) {
  try {
    const arcaId = Number(req.params.arcaId || 0);
    if (!arcaId) return res.status(400).json({ error: "arcaId inválido" });

    const reconciliar = String(req.query.reconciliar || "") === "1";

    const cab = await query(`SELECT * FROM arca_comprobantes WHERE id=? LIMIT 1`, [arcaId]);
    if (!cab.length) return res.status(404).json({ error: "Comprobante ARCA no encontrado" });

    const c = cab[0];

    const permitido =
      c.estado === "EMITIDO" || (reconciliar && c.estado === "PENDIENTE");

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

    const out = await wsfe.FECompConsultar(c.pto_vta, c.cbte_tipo, c.cbte_nro);
    const raw = out?.raw || "";

    const pickBlock = (xml, tag) => {
      const r = new RegExp(
        `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
        "i"
      );
      const m = String(xml || "").match(r);
      return m ? m[1] : "";
    };

    const pickDate8 = (xml, tags) => {
      for (const t of tags) {
        const v = pickTag(String(xml || ""), t);
        if (!v) continue;
        const digits = String(v).replace(/\D/g, "");
        const m = digits.match(/(20\d{6})/);
        if (m) return m[1];
      }
      return null;
    };

    const pickFirst = (xml, tags) => {
      for (const t of tags) {
        const v = pickTag(String(xml || ""), t);
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
      return null;
    };

    const fault = pickTag(raw, "faultstring");
    if (fault) {
      const parsed_json = { fault, raw_hint: "faultstring" };
      await arcaModel.insertarWsfeConsulta({
        arca_comprobante_id: arcaId,
        ok: false,
        parsed_json,
        resp_xml: raw,
      });

      return res.status(502).json({
        arca_id: arcaId,
        ok: false,
        diffs: { faultstring: fault },
        wsfe: { faultstring: fault },
      });
    }

    const resultGetXml = pickBlock(raw, "ResultGet") || raw;

    const parsed = {
      cbte_nro: Number(pickFirst(resultGetXml, ["CbteDesde", "CbteNro"])) || Number(c.cbte_nro),
      cbte_fch: pickDate8(resultGetXml, ["CbteFch"]),
      cae: pickFirst(resultGetXml, ["CodAutorizacion", "CAE"]),
      cae_vto: pickDate8(resultGetXml, ["FchVto", "CAEFchVto"]),
      doc_tipo: Number(pickFirst(resultGetXml, ["DocTipo"])) || Number(c.doc_tipo),
      doc_nro: Number(pickFirst(resultGetXml, ["DocNro"])) || Number(c.doc_nro),
      imp_total: Number(pickFirst(resultGetXml, ["ImpTotal"])) || 0,
      imp_neto: Number(pickFirst(resultGetXml, ["ImpNeto"])) || 0,
      imp_iva: Number(pickFirst(resultGetXml, ["ImpIVA"])) || 0,
      mon_id: pickFirst(resultGetXml, ["MonId"]) || "PES",
      mon_cotiz: pickFirst(resultGetXml, ["MonCotiz"]) || "1",
    };

    const toNum = (x) => Number(Number(x || 0).toFixed(2));

    // diffs contra DB actual
    const diffs = {};

    if (String(parsed.cae || "") !== String(c.cae || "")) diffs.cae = { wsfe: parsed.cae || null, db: c.cae || null };
    if (String(parsed.cae_vto || "") !== String(c.cae_vto || "")) diffs.cae_vto = { wsfe: parsed.cae_vto || null, db: c.cae_vto || null };
    if (String(parsed.cbte_fch || "") !== String(c.cbte_fch || "")) diffs.cbte_fch = { wsfe: parsed.cbte_fch || null, db: c.cbte_fch || null };

    if (toNum(parsed.imp_total) !== toNum(c.imp_total)) diffs.imp_total = { wsfe: toNum(parsed.imp_total), db: toNum(c.imp_total) };
    if (toNum(parsed.imp_neto) !== toNum(c.imp_neto)) diffs.imp_neto = { wsfe: toNum(parsed.imp_neto), db: toNum(c.imp_neto) };
    if (toNum(parsed.imp_iva) !== toNum(c.imp_iva)) diffs.imp_iva = { wsfe: toNum(parsed.imp_iva), db: toNum(c.imp_iva) };

    let ok = Object.keys(diffs).length === 0;
    let reconciliado = false;

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

      // si querés también “alinear” cbte_fch (opcional, pero recomendado)
      if (parsed.cbte_fch && parsed.cbte_fch !== c.cbte_fch) {
        await query(`UPDATE arca_comprobantes SET cbte_fch=?, updated_at=NOW() WHERE id=?`, [
          parsed.cbte_fch,
          arcaId,
        ]);
      }
    }

    // Guardar auditoría (si se reconcilió, guardamos ok=true y sin diffs)
    const parsed_json = {
      reconciliar,
      reconciliado,
      ok,
      diffs: reconciliado ? {} : diffs,
      parsed,
    };

    await arcaModel.insertarWsfeConsulta({
      arca_comprobante_id: arcaId,
      ok,
      parsed_json,
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
};
