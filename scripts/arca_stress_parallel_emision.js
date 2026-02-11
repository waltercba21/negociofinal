// scripts/arca_stress_parallel_emision.js
require("dotenv").config();

const http = require("http");
const https = require("https");
const { URL } = require("url");

const pool = require("../config/conexion");
const util = require("util");

function getQuery() {
  if (pool.promise && typeof pool.promise === "function") {
    return (sql, params = []) => pool.promise().query(sql, params).then(([rows]) => rows);
  }
  const q = util.promisify(pool.query).bind(pool);
  return (sql, params = []) => q(sql, params);
}
const query = getQuery();

function reqJson(method, fullUrl, bodyObj) {
  return new Promise((resolve, reject) => {
    const u = new URL(fullUrl);
    const lib = u.protocol === "https:" ? https : http;
    const body = bodyObj ? JSON.stringify(bodyObj) : null;

    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          "Content-Type": "application/json",
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let json = null;
          try { json = data ? JSON.parse(data) : null; } catch (_) {}
          resolve({ status: res.statusCode, json, raw: data });
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  console.log("=== ARCA STRESS PARALLEL EMISION ===");

  const base = (process.env.ARCA_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  console.log("BASE:", base);

  const cand = await query(`
    SELECT fm.id
    FROM facturas_mostrador fm
    WHERE EXISTS (SELECT 1 FROM factura_items fi WHERE fi.factura_id = fm.id)
      AND NOT EXISTS (
        SELECT 1 FROM arca_comprobantes ac
        WHERE ac.factura_mostrador_id = fm.id
          AND ac.estado IN ('PENDIENTE','EMITIDO')
      )
    ORDER BY fm.id DESC
    LIMIT 3
  `);

  if (cand.length < 2) {
    console.log("❌ No hay suficientes facturas candidatas (mínimo 2, ideal 3).");
    process.exit(2);
  }

  const facturas = cand.map(x => x.id);
  console.log("Facturas:", facturas);

  const body = {
    cbte_tipo: 6,
    doc_tipo: 99,
    doc_nro: 0,
    receptor_cond_iva_id: 5,
    receptor_nombre: "CONSUMIDOR FINAL",
  };

  const reqs = facturas.map((id) => reqJson("POST", `${base}/arca/emitir-desde-factura/${id}`, body));
  const resps = await Promise.all(reqs);

  resps.forEach((r, i) => {
    console.log(`Factura ${facturas[i]} -> HTTP ${r.status}`, r.json || r.raw);
  });

  // todas deben ser 200
  const bad = resps.filter(r => r.status !== 200);
  if (bad.length) {
    console.log("❌ STRESS FAIL: alguna emisión no devolvió 200.");
    process.exit(1);
  }

  // cbte_nro distintos
  const nros = resps.map(r => r.json?.cbte_nro).filter(Boolean);
  const uniq = new Set(nros);
  console.log("cbte_nro:", nros);

  if (uniq.size !== nros.length) {
    console.log("❌ STRESS FAIL: cbte_nro repetidos.");
    process.exit(1);
  }

  console.log("✅ STRESS OK");
  process.exit(0);
})().catch((e) => {
  console.error("❌ STRESS FAIL:", e.message);
  process.exit(1);
});
