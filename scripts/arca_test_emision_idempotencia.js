// scripts/arca_test_emision_idempotencia.js
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

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
          resolve({ status: res.statusCode, headers: res.headers, raw: data, json });
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function reqBuffer(method, fullUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(fullUrl);
    const lib = u.protocol === "https:" ? https : http;

    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks) }));
      }
    );

    req.on("error", reject);
    req.end();
  });
}

(async () => {
  console.log("=== ARCA TEST EMISION + IDEMPOTENCIA ===");

  const base = (process.env.ARCA_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  console.log("BASE:", base);

  // 1) Buscar una factura mostrador que tenga items y no tenga ARCA activo
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
    LIMIT 1
  `);

  assert(cand.length === 1, "No encontré una factura_mostrador candidata (sin ARCA activo y con items)");
  const facturaId = cand[0].id;
  console.log("Factura candidata:", facturaId);

  // 2) Emitir (Consumidor Final: doc_tipo=99, doc_nro=0) - Factura B por defecto
  const body = {
    cbte_tipo: 6,
    doc_tipo: 99,
    doc_nro: 0,
    receptor_cond_iva_id: 5,
    receptor_nombre: "CONSUMIDOR FINAL",
  };

  const emitUrl = `${base}/arca/emitir-desde-factura/${facturaId}`;
  const r1 = await reqJson("POST", emitUrl, body);

  console.log("POST emitir #1 status:", r1.status);
  if (r1.json) console.log("Resp #1:", r1.json);
  else console.log("Resp #1 raw:", r1.raw);

  assert(r1.status === 200, `Emisión #1 falló (HTTP ${r1.status}). Detalle arriba.`);
  assert(r1.json && r1.json.arca_id, "Emisión #1 no devolvió arca_id");

  const arcaId = r1.json.arca_id;
  const estado1 = r1.json.estado;
  console.log("arca_id:", arcaId, "estado:", estado1);

  assert(estado1 === "EMITIDO", `Bloqueante: quedó ${estado1}. obs_code=${r1.json.obs_code} obs_msg=${r1.json.obs_msg}`);

  // 3) Idempotencia: segunda emisión debe dar 409 con el mismo arca_id
  const r2 = await reqJson("POST", emitUrl, body);
  console.log("POST emitir #2 status:", r2.status);
  if (r2.json) console.log("Resp #2:", r2.json);
  else console.log("Resp #2 raw:", r2.raw);

  assert(r2.status === 409, `Bloqueante: la segunda emisión NO devolvió 409 (devolvió ${r2.status})`);
  assert(r2.json && Number(r2.json.arca_id) === Number(arcaId), "Bloqueante: 409 pero arca_id distinto (idempotencia rota)");

  // 4) Ver estado por factura
  const stUrl = `${base}/arca/status/factura/${facturaId}`;
  const st = await reqJson("GET", stUrl);
  console.log("GET status factura:", st.status, st.json || st.raw);
  assert(st.status === 200, "No pude leer status por factura");
  assert(Number(st.json.arca_id) === Number(arcaId), "Status factura devolvió otro arca_id");

  // 5) PDF: debe ser application/pdf y con tamaño razonable
  const pdfUrl = `${base}/arca/pdf/${arcaId}`;
  const pdf = await reqBuffer("GET", pdfUrl);
  console.log("GET pdf status:", pdf.status, "content-type:", pdf.headers["content-type"], "bytes:", pdf.buf.length);

  assert(pdf.status === 200, `PDF falló (HTTP ${pdf.status})`);
  assert(String(pdf.headers["content-type"] || "").includes("pdf"), "PDF no devolvió content-type pdf");
  assert(pdf.buf.length > 1000, "PDF demasiado chico (probable error)");

  // 6) Auditoría WSFE: debe dar ok=true
  const auUrl = `${base}/arca/wsfe/consultar/${arcaId}`;
  const au = await reqJson("GET", auUrl);
  console.log("GET auditoria:", au.status, au.json || au.raw);
  assert(au.status === 200, "Auditoría WSFE falló");
  assert(au.json && au.json.ok === true, `Auditoría no OK. diffs=${JSON.stringify(au.json?.diffs || au.json, null, 2)}`);

  // 7) Check DB: solo 1 activo para esa factura
  const c = await query(
    `SELECT COUNT(*) AS n FROM arca_comprobantes WHERE factura_mostrador_id=? AND estado IN ('PENDIENTE','EMITIDO')`,
    [facturaId]
  );
  console.log("Activos para factura:", c[0].n);
  assert(Number(c[0].n) === 1, "Bloqueante: hay más de 1 comprobante activo para la misma factura");

  console.log("✅ TEST COMPLETO OK");
  process.exit(0);
})().catch((e) => {
  console.error("❌ TEST FAIL:", e.message);
  process.exit(1);
});
