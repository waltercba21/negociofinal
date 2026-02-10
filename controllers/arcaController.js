// controllers/arcaController.js
require("dotenv").config();

const pool = require("../config/conexion");
const util = require("util");

const arcaModel = require("../models/arcaModel");
const wsfe = require("../services/wsfe");

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

/**
 * POST /arca/emitir-desde-factura/:id
 * MVP: FACTURA B, IVA fijo 21%, no toca stock
 */
async function emitirDesdeFacturaMostrador(req, res) {
  try {
    const facturaId = Number(req.params.id || 0);
    if (!Number.isFinite(facturaId) || facturaId <= 0) {
      return res.status(400).json({ error: "facturaId inválido" });
    }

    // Bloqueo seguro de duplicados
    const existente = await arcaModel.buscarUltimoPorFacturaMostradorId(facturaId);
    if (existente && (existente.estado === "PENDIENTE" || existente.estado === "EMITIDO")) {
      return res.status(409).json({
        error: `Ya existe un comprobante ARCA en estado ${existente.estado} para esta factura`,
        arca_id: existente.id,
        estado: existente.estado,
        cae: existente.cae,
        cbte_nro: existente.cbte_nro
      });
    }

    const cbte_tipo = Number(req.body.cbte_tipo || 6); // Factura B
    const doc_tipo = Number(req.body.doc_tipo);
    const doc_nro = Number(req.body.doc_nro);
    const receptor_cond_iva_id = Number(req.body.receptor_cond_iva_id || 5);
    const receptor_nombre = req.body.receptor_nombre || null;

    if (!Number.isFinite(cbte_tipo) || cbte_tipo <= 0)
      return res.status(400).json({ error: "cbte_tipo inválido" });
    if (!Number.isFinite(doc_tipo) || doc_tipo <= 0)
      return res.status(400).json({ error: "doc_tipo inválido" });
    if (!Number.isFinite(doc_nro) || doc_nro < 0)
      return res.status(400).json({ error: "doc_nro inválido" });
    if (!Number.isFinite(receptor_cond_iva_id) || receptor_cond_iva_id <= 0)
      return res.status(400).json({ error: "receptor_cond_iva_id inválido" });

    const pto_vta = Number(process.env.ARCA_PTO_VTA || 0);
    const cuit_emisor = Number(process.env.ARCA_CUIT || 0);
    if (!Number.isFinite(pto_vta) || pto_vta <= 0)
      return res.status(500).json({ error: "ARCA_PTO_VTA no configurado" });
    if (!Number.isFinite(cuit_emisor) || cuit_emisor <= 0)
      return res.status(500).json({ error: "ARCA_CUIT no configurado" });

    const ambiente =
      String(process.env.ARCA_ENV || "homo").toUpperCase() === "PROD" ? "PROD" : "HOMO";

    // Traer factura + items
    const rows = await query(
      `
      SELECT
        fm.id AS factura_id, fm.nombre_cliente, fm.fecha, fm.total, fm.creado_en,
        fi.producto_id, COALESCE(p.nombre,'(sin nombre)') AS descripcion,
        fi.cantidad, fi.precio_unitario, fi.subtotal
      FROM facturas_mostrador fm
      JOIN factura_items fi ON fm.id = fi.factura_id
      LEFT JOIN productos p ON p.id = fi.producto_id
      WHERE fm.id = ?
    `,
      [facturaId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Factura no encontrada o sin items" });
    }

    // MVP IVA 21%
    const alic = 21;

    const itemsCalc = rows.map((r) => {
      const imp_total = round2(r.subtotal);
      const imp_neto = round2(imp_total / (1 + alic / 100));
      const imp_iva = round2(imp_total - imp_neto);
      return {
        producto_id: r.producto_id,
        descripcion: r.descripcion,
        cantidad: round2(r.cantidad),
        precio_unitario: round2(r.precio_unitario),
        bonif: 0,
        iva_alicuota: round2(alic),
        imp_neto,
        imp_iva,
        imp_total,
      };
    });

    const imp_total = round2(itemsCalc.reduce((a, i) => a + i.imp_total, 0));
    const imp_neto = round2(itemsCalc.reduce((a, i) => a + i.imp_neto, 0));
    const imp_iva = round2(itemsCalc.reduce((a, i) => a + i.imp_iva, 0));

    // Obtener nro y fecha coherente con el último emitido
    let info = await getNextAndDates(pto_vta, cbte_tipo);
    let next = info.next;
    let cbte_fch = info.cbte_fch;

    const reqObj = {
      fuente: "facturas_mostrador",
      factura_mostrador_id: facturaId,
      cbte_tipo,
      pto_vta,
      cbte_fch,
      cbte_nro: next,
      doc_tipo,
      doc_nro,
      receptor_cond_iva_id,
      totales: { imp_total, imp_neto, imp_iva },
      iva_mvp: { alicuota: 21, wsfe_id: 5 },
      items: itemsCalc,
      debug: {
        ultimo_autorizado: info.ultimo,
        last_cbte_fch: info.lastCbteFch,
        today: info.today,
      },
    };

    let req_json = JSON.stringify(reqObj, null, 2);

    const arcaId = await arcaModel.crearComprobante({
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

    await arcaModel.insertarItems(arcaId, itemsCalc);

    // Intento 1
    let cae = await wsfe.FECAESolicitar({
      ptoVta: pto_vta,
      cbteTipo: cbte_tipo,
      docTipo: doc_tipo,
      docNro: doc_nro,
      condicionIVAReceptorId: receptor_cond_iva_id,
      cbteFch: cbte_fch,
      cbteDesde: next,
      cbteHasta: next,
      impTotal: imp_total,
      impNeto: imp_neto,
      impIVA: imp_iva,
      monId: "PES",
      monCotiz: "1.000",
    });

    // Reintento si 10016
    if (cae.resultado === "R" && String(cae.obsCode) === "10016") {
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
      };
      req_json = JSON.stringify(reqObj, null, 2);

      await query(
        `UPDATE arca_comprobantes SET cbte_nro=?, cbte_fch=?, req_json=?, updated_at=NOW() WHERE id=?`,
        [next, cbte_fch, req_json, arcaId]
      );

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
        impNeto: imp_neto,
        impIVA: imp_iva,
        monId: "PES",
        monCotiz: "1.000",
      });
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
      SELECT id, nombre_cliente, fecha, total, metodos_pago, creado_en
      FROM facturas_mostrador
      ORDER BY id DESC
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
      `SELECT id, nombre_cliente, fecha, total, metodos_pago, creado_en
       FROM facturas_mostrador WHERE id=? LIMIT 1`,
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

module.exports = {
  emitirDesdeFacturaMostrador,
  statusPorFacturaMostrador,
  vistaArcaIndex,
  listarFacturasMostrador,
  detalleFacturaMostrador,
  historialArcaPorFactura,
};
