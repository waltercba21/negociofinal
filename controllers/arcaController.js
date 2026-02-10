// controllers/arcaController.js
require("dotenv").config();

const pool = require("../config/conexion");
const util = require("util");

const arcaModel = require("../models/arcaModel");
const wsfe = require("../services/wsfe");

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const _condIvaCache = {
  ts: 0,
  rows: null,
  raw: null
};

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
        cbte_nro: existente.cbte_nro,
      });
    }

    const cbte_tipo = Number(req.body.cbte_tipo || 6); // 6 = Factura B (MVP)
    const doc_tipo = Number(req.body.doc_tipo);

    // soporta doc_nro como number o string
    const doc_nro_str = String(req.body.doc_nro ?? "").trim();
    if (!/^\d+$/.test(doc_nro_str)) {
      return res.status(400).json({ error: "doc_nro inválido" });
    }
    const doc_nro = Number(doc_nro_str);

    const receptor_cond_iva_id = Number(req.body.receptor_cond_iva_id || 5);
    const receptor_nombre = (req.body.receptor_nombre || "").trim() || null;

    if (!Number.isFinite(cbte_tipo) || cbte_tipo <= 0)
      return res.status(400).json({ error: "cbte_tipo inválido" });

    if (!Number.isFinite(doc_tipo) || doc_tipo <= 0)
      return res.status(400).json({ error: "doc_tipo inválido" });

    // Validación doc_nro según doc_tipo
    // 99 = Consumidor Final => doc_nro puede ser 0
    if (doc_tipo === 99) {
      if (!Number.isFinite(doc_nro) || doc_nro < 0) {
        return res.status(400).json({ error: "doc_nro inválido" });
      }
    } else {
      // DNI/CUIT/etc => debe ser > 0
      if (!Number.isFinite(doc_nro) || doc_nro <= 0) {
        return res.status(400).json({ error: "doc_nro inválido (debe ser > 0)" });
      }
    }

    // 80 = CUIT => 11 dígitos
    if (doc_tipo === 80 && doc_nro_str.length !== 11) {
      return res.status(400).json({ error: "CUIT inválido (debe tener 11 dígitos)" });
    }

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
      receptor_nombre,
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

    // Cache receptor (solo si tiene doc real > 0)
    if (doc_nro > 0) {
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
async function buscarReceptor(req, res) {
  try {
    const doc_tipo = Number(req.query.doc_tipo);
    const doc_nro = Number(req.query.doc_nro);

    if (!Number.isFinite(doc_tipo) || doc_tipo <= 0) {
      return res.status(400).json({ error: "doc_tipo inválido" });
    }
    if (!Number.isFinite(doc_nro) || doc_nro <= 0) {
      return res.status(400).json({ error: "doc_nro inválido" });
    }

    const row = await arcaModel.buscarReceptorCache(doc_tipo, doc_nro);
    if (!row) return res.status(404).json({ error: "No encontrado en cache" });

    return res.json(row);
  } catch (e) {
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
};
