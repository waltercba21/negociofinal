// controllers/arcaController.js
const pool = require("../config/conexion");
const util = require("util");

const arcaModel = require("../models/arcaModel");
const wsfe = require("../services/wsfe");

function getQuery() {
  if (pool.promise && typeof pool.promise === "function") {
    return (sql, params=[]) => pool.promise().query(sql, params).then(([rows]) => rows);
  }
  const q = util.promisify(pool.query).bind(pool);
  return (sql, params=[]) => q(sql, params);
}
const query = getQuery();

function round2(n) {
  const x = Number(n);
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/**
 * MVP: emitir FACTURA B desde facturas_mostrador
 * - IVA fijo 21% (Id 5 en WSFE)
 * - No toca stock
 *
 * Body esperado (mínimo):
 * {
 *   "doc_tipo": 99,
 *   "doc_nro": 0,
 *   "receptor_cond_iva_id": 5,
 *   "receptor_nombre": "Consumidor Final" (opcional),
 *   "cbte_tipo": 6 (opcional, default 6)
 * }
 */
async function emitirDesdeFacturaMostrador(req, res) {
  try {
    const facturaId = Number(req.params.id || 0);
    if (!facturaId) return res.status(400).json({ error: "facturaId inválido" });

    // Evitar doble emisión por link
    const existente = await arcaModel.buscarPorFacturaMostradorId(facturaId);
    if (existente && existente.estado === "EMITIDO") {
      return res.status(409).json({
        error: "Ya existe un comprobante ARCA emitido para esta factura",
        arca_id: existente.id,
        cae: existente.cae,
        cbte_nro: existente.cbte_nro
      });
    }

    const cbte_tipo = Number(req.body.cbte_tipo || 6); // Factura B
    const doc_tipo = Number(req.body.doc_tipo);
    const doc_nro  = Number(req.body.doc_nro);
    const receptor_cond_iva_id = Number(req.body.receptor_cond_iva_id || 5);
    const receptor_nombre = (req.body.receptor_nombre || null);

    if (!doc_tipo && doc_tipo !== 0) return res.status(400).json({ error: "Falta doc_tipo" });
    if (!Number.isFinite(doc_nro)) return res.status(400).json({ error: "doc_nro inválido" });

    // Traer factura + items con producto_id
    const rows = await query(`
      SELECT
        fm.id AS factura_id, fm.nombre_cliente, fm.fecha, fm.total, fm.creado_en,
        fi.producto_id, COALESCE(p.nombre,'(sin nombre)') AS descripcion,
        fi.cantidad, fi.precio_unitario, fi.subtotal
      FROM facturas_mostrador fm
      JOIN factura_items fi ON fm.id = fi.factura_id
      LEFT JOIN productos p ON p.id = fi.producto_id
      WHERE fm.id = ?
    `, [facturaId]);

    if (!rows.length) return res.status(404).json({ error: "Factura no encontrada o sin items" });

    const factura = {
      id: rows[0].factura_id,
      fecha: rows[0].fecha,
      nombre_cliente: rows[0].nombre_cliente,
    };

    // IVA fijo 21% (MVP)
    const alic = 21;

    const itemsCalc = rows.map(r => {
      const imp_total = round2(r.subtotal);
      const imp_neto  = round2(imp_total / (1 + alic/100));
      const imp_iva   = round2(imp_total - imp_neto);
      return {
        producto_id: r.producto_id,
        descripcion: r.descripcion,
        cantidad: round2(r.cantidad),
        precio_unitario: round2(r.precio_unitario),
        bonif: 0,
        iva_alicuota: round2(alic),
        imp_neto,
        imp_iva,
        imp_total
      };
    });

    const imp_total = round2(itemsCalc.reduce((a,i)=> a + i.imp_total, 0));
    const imp_neto  = round2(itemsCalc.reduce((a,i)=> a + i.imp_neto,  0));
    const imp_iva   = round2(itemsCalc.reduce((a,i)=> a + i.imp_iva,   0));

    const pto_vta = Number(process.env.ARCA_PTO_VTA || 0);
    const cuit_emisor = Number(process.env.ARCA_CUIT || 0);
    const ambiente = (process.env.ARCA_ENV || "homo").toUpperCase() === "PROD" ? "PROD" : "HOMO";

    // fecha comprobante: usamos la fecha de la factura (si parsea), si no hoy
    let cbte_fch;
    try {
      cbte_fch = wsfe.yyyymmddARFromDate(factura.fecha);
    } catch {
      cbte_fch = wsfe.yyyymmddARFromDate(new Date());
    }

    // 1) obtener próximo número
    const ult = await wsfe.FECompUltimoAutorizado(pto_vta, cbte_tipo);
    const next = Number(ult.ultimo || 0) + 1;

    // 2) insertar cabecera PENDIENTE + items + req_json
    const req_json = JSON.stringify({
      fuente: "facturas_mostrador",
      factura_mostrador_id: facturaId,
      cbte_tipo,
      pto_vta,
      cbte_fch,
      doc_tipo,
      doc_nro,
      receptor_cond_iva_id,
      totales: { imp_total, imp_neto, imp_iva },
      iva_mvp: { alicuota: 21, wsfe_id: 5 },
      items: itemsCalc
    }, null, 2);

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
      estado: "PENDIENTE"
    });

    await arcaModel.insertarItems(arcaId, itemsCalc);

    // 3) solicitar CAE
    const cae = await wsfe.FECAESolicitar({
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
      monCotiz: "1.000"
    });

    const estado = cae.resultado === "A" ? "EMITIDO" : "RECHAZADO";

    await arcaModel.actualizarRespuesta(arcaId, {
      resultado: cae.resultado || null,
      cae: cae.cae || null,
      cae_vto: cae.caeVto || null,
      obs_code: cae.obsCode || null,
      obs_msg: cae.obsMsg || null,
      resp_xml: cae.raw || null,
      estado
    });

    return res.json({
      arca_id: arcaId,
      estado,
      cbte_nro: next,
      resultado: cae.resultado || null,
      cae: cae.cae || null,
      cae_vto: cae.caeVto || null,
      obs_code: cae.obsCode || null,
      obs_msg: cae.obsMsg || null
    });

  } catch (e) {
    console.error("❌ ARCA emitirDesdeFacturaMostrador:", e);
    return res.status(500).json({ error: e.message || "Error interno" });
  }
}

async function statusPorFacturaMostrador(req, res) {
  try {
    const facturaId = Number(req.params.id || 0);
    if (!facturaId) return res.status(400).json({ error: "facturaId inválido" });

    const row = await arcaModel.buscarPorFacturaMostradorId(facturaId);
    if (!row) return res.status(404).json({ error: "Sin comprobante ARCA asociado" });

    return res.json({
      arca_id: row.id,
      estado: row.estado,
      cbte_tipo: row.cbte_tipo,
      cbte_nro: row.cbte_nro,
      resultado: row.resultado,
      cae: row.cae,
      cae_vto: row.cae_vto,
      obs_code: row.obs_code,
      obs_msg: row.obs_msg
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error interno" });
  }
}

module.exports = { emitirDesdeFacturaMostrador, statusPorFacturaMostrador };
