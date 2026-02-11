// scripts/arca_test_factura_c.js
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

function round2(n) {
  const x = Number(n || 0);
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

(async () => {
  console.log("=== ARCA TEST FACTURA C (SIN IVA) ===");

  const base = (process.env.ARCA_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  console.log("BASE:", base);

  // 1) Buscar factura con items y sin ARCA activo
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

  assert(cand.length === 1, "No encontré una factura candidata (sin ARCA activo y con items)");
  const facturaId = cand[0].id;
  console.log("Factura candidata:", facturaId);

  // 2) Emitir FACTURA C (CbteTipo 11), Consumidor Final
  const body = {
    cbte_tipo: 11,
    doc_tipo: 99,
    doc_nro: 0,
    receptor_cond_iva_id: 5,
    receptor_nombre: "CONSUMIDOR FINAL",
  };

  const emitUrl = `${base}/arca/emitir-desde-factura/${facturaId}`;

  const r1 = await reqJson("POST", emitUrl, body);
  console.log("POST emitir #1 status:", r1.status);
  console.log("Resp #1:", r1.json || r1.raw);

  assert(r1.status === 200, `Emisión #1 falló (HTTP ${r1.status})`);
  assert(r1.json && r1.json.arca_id, "Emisión #1 no devolvió arca_id");
  assert(r1.json.estado === "EMITIDO", `Bloqueante: quedó ${r1.json.estado}`);

  const arcaId = r1.json.arca_id;
  console.log("arca_id:", arcaId, "cbte_nro:", r1.json.cbte_nro);

  // 3) Idempotencia
  const r2 = await reqJson("POST", emitUrl, body);
  console.log("POST emitir #2 status:", r2.status);
  console.log("Resp #2:", r2.json || r2.raw);
  assert(r2.status === 409, `Bloqueante: 2da emisión no devolvió 409 (devolvió ${r2.status})`);
  assert(Number(r2.json.arca_id) === Number(arcaId), "Bloqueante: 409 con arca_id distinto");

  // 4) Verificar DB: ImpIVA = 0, ImpNeto = ImpTotal, items IVA = 0
  const cab = await query(`SELECT imp_total, imp_neto, imp_iva, req_json FROM arca_comprobantes WHERE id=?`, [arcaId]);
  assert(cab.length === 1, "No encontré cabecera en arca_comprobantes");
  const impTotal = Number(cab[0].imp_total);
  const impNeto  = Number(cab[0].imp_neto);
  const impIva   = Number(cab[0].imp_iva);

  console.log("DB cabecera:", { imp_total: impTotal, imp_neto: impNeto, imp_iva: impIva });

  assert(round2(impIva) === 0, "Bloqueante: imp_iva DB debe ser 0 para Factura C");
  assert(Math.abs(round2(impNeto) - round2(impTotal)) <= 0.02, "Bloqueante: imp_neto debe igualar imp_total en C");

  const it = await query(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN iva_alicuota<>0 OR imp_iva<>0 THEN 1 ELSE 0 END) AS bad
     FROM arca_comprobante_items WHERE arca_comprobante_id=?`,
    [arcaId]
  );
  console.log("Items DB:", it[0]);
  assert(Number(it[0].n) > 0, "No hay items guardados");
  assert(Number(it[0].bad) === 0, "Bloqueante: hay items con IVA != 0 en Factura C");

  // 5) Verificar req_json: omitirIva=true y sin alícuotas
  let req = null;
  try { req = JSON.parse(cab[0].req_json); } catch (_) {}
  assert(req && req.iva, "req_json no tiene req.iva");
  console.log("req.iva:", req.iva);

  assert(req.iva.omitirIva === true, "Bloqueante: req.iva.omitirIva debe ser true para C");
  assert(Array.isArray(req.iva.ivaAlicuotas) && req.iva.ivaAlicuotas.length === 0, "Bloqueante: ivaAlicuotas debe estar vacío en C");

  // 6) PDF
  const pdf = await reqBuffer("GET", `${base}/arca/pdf/${arcaId}`);
  console.log("PDF:", { status: pdf.status, type: pdf.headers["content-type"], bytes: pdf.buf.length });
  assert(pdf.status === 200, "PDF falló");
  assert(String(pdf.headers["content-type"] || "").includes("pdf"), "PDF no devolvió content-type pdf");
  assert(pdf.buf.length > 1000, "PDF demasiado chico");

  // 7) Auditoría WSFE
  const au = await reqJson("GET", `${base}/arca/wsfe/consultar/${arcaId}`);
  console.log("Auditoría:", au.status, au.json || au.raw);
  assert(au.status === 200, "Auditoría WSFE falló");
  assert(au.json && au.json.ok === true, `Auditoría no OK: ${JSON.stringify(au.json, null, 2)}`);

  // Chequeo adicional: wsfe imp_iva = 0
  assert(Number(au.json.wsfe?.imp_iva || 0) === 0, "Bloqueante: WSFE imp_iva debería ser 0 en C");

  console.log("✅ FACTURA C OK");
  process.exit(0);
})().catch((e) => {
  console.error("❌ FACTURA C FAIL:", e.message);
  process.exit(1);
});
