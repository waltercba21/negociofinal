// scripts/arca_reconciliar_pendientes.js
require("dotenv").config();

const util = require("util");
const pool = require("../config/conexion");
const wsfe = require("../services/wsfe");
const arcaModel = require("../models/arcaModel");

function getQuery() {
  if (pool.promise && typeof pool.promise === "function") {
    return (sql, params = []) =>
      pool.promise().query(sql, params).then(([rows]) => rows);
  }
  const q = util.promisify(pool.query).bind(pool);
  return (sql, params = []) => q(sql, params);
}
const query = getQuery();

function pickTag(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = String(xml || "").match(r);
  return m ? m[1].trim() : "";
}

function pickBlock(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = String(xml || "").match(r);
  return m ? m[1] : "";
}

function pickDate8(xml, tags) {
  for (const t of tags) {
    const v = pickTag(xml, t);
    if (!v) continue;
    const digits = String(v).replace(/\D/g, "");
    const m = digits.match(/(20\d{6})/);
    if (m) return m[1];
  }
  return null;
}

function pickFirst(xml, tags) {
  for (const t of tags) {
    const v = pickTag(xml, t);
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

async function main() {
  const limit = Math.max(1, Math.min(100, Number(process.env.ARCA_RECONCILE_LIMIT || 20)));
  const minAge = Math.max(0, Math.min(120, Number(process.env.ARCA_RECONCILE_MIN_AGE_MINUTES || 1)));

  // embed seguro (solo número)
  const minAgeInt = Number.isFinite(minAge) ? Math.trunc(minAge) : 1;

  const pendientes = await query(
    `
    SELECT id, pto_vta, cbte_tipo, cbte_nro, estado, created_at
    FROM arca_comprobantes
    WHERE estado='PENDIENTE'
      AND cbte_nro IS NOT NULL
      AND created_at < (NOW() - INTERVAL ${minAgeInt} MINUTE)
    ORDER BY id ASC
    LIMIT ?
    `,
    [limit]
  );

  console.log("=== ARCA RECONCILIAR PENDIENTES ===");
  console.log("Pendientes a revisar:", pendientes.length);

  for (const c of pendientes) {
    try {
      const out = await wsfe.FECompConsultar(c.pto_vta, c.cbte_tipo, c.cbte_nro);
      const raw = out?.raw || "";

      const fault = pickTag(raw, "faultstring");
      if (fault) {
        await arcaModel.insertarWsfeConsulta({
          arca_comprobante_id: c.id,
          ok: 0,
          parsed_json: { mode: "reconcile", fault },
          resp_xml: raw,
        });
        console.log(`[${c.id}] fault: ${fault}`);
        continue;
      }

      const resultGetXml = pickBlock(raw, "ResultGet") || raw;
      const cae = pickFirst(resultGetXml, ["CodAutorizacion", "CAE"]);
      const cae_vto = pickDate8(resultGetXml, ["FchVto", "CAEFchVto"]);
      const cbte_fch = pickDate8(resultGetXml, ["CbteFch"]);

      if (!cae) {
        await arcaModel.insertarWsfeConsulta({
          arca_comprobante_id: c.id,
          ok: 0,
          parsed_json: { mode: "reconcile", note: "Sin CAE en WSFE" },
          resp_xml: raw,
        });
        console.log(`[${c.id}] sin CAE en WSFE (queda PENDIENTE)`);
        continue;
      }

      await query(
        `
        UPDATE arca_comprobantes
        SET estado='EMITIDO',
            resultado='A',
            cae=?,
            cae_vto=?,
            cbte_fch=COALESCE(?, cbte_fch),
            obs_code='RECONCILIADO_AUTO',
            obs_msg='Autorizado en WSFE por conciliador',
            updated_at=NOW()
        WHERE id=?
        `,
        [cae, cae_vto || null, cbte_fch || null, c.id]
      );

      await arcaModel.insertarWsfeConsulta({
        arca_comprobante_id: c.id,
        ok: 1,
        parsed_json: { mode: "reconcile", parsed: { cae, cae_vto, cbte_fch } },
        resp_xml: raw,
      });

      console.log(`[${c.id}] ✅ reconciliado -> CAE ${cae}`);
    } catch (e) {
      const msg = e?.message || String(e);
      console.log(`[${c.id}] error: ${msg}`);
    }
  }

  if (pool.end) await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("FATAL:", e);
  try { if (pool.end) await pool.end(); } catch (_) {}
  process.exit(1);
});
