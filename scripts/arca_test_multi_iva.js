// scripts/arca_test_multi_iva.js
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

function round2(n) {
  const x = Number(n || 0);
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

(async () => {
  console.log("=== ARCA TEST MULTI IVA (DB + WSFE) ===");

  const base = (process.env.ARCA_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  console.log("BASE:", base);

  // 1) Buscar factura con >=2 IVAs distintos en items (ej 21 y 10.5), sin ARCA activo
  const cand = await query(`
    SELECT fm.id
    FROM facturas_mostrador fm
    JOIN factura_items fi ON fi.factura_id = fm.id
    JOIN productos p ON p.id = fi.producto_id
    LEFT JOIN arca_comprobantes ac
      ON ac.factura_mostrador_id = fm.id
     AND ac.estado IN ('PENDIENTE','EMITIDO')
    WHERE ac.id IS NULL
    GROUP BY fm.id
    HAVING COUNT(DISTINCT ROUND(COALESCE(p.IVA, 21), 2)) >= 2
    ORDER BY fm.id DESC
    LIMIT 1
  `);

  if (!cand.length) {
    console.log("❌ No encontré una factura_mostrador con items de 2 IVAs distintos (ej 21 y 10.5).");
    console.log("Bloqueante para este paso: creá una factura de prueba con 2 productos (uno IVA 21 y otro IVA 10.5) y re-ejecutá.");
    process.exit(2);
  }

  const facturaId = cand[0].id;
  console.log("Factura candidata multi-IVA:", facturaId);

  // 2) Emitir
  const body = {
    cbte_tipo: 6,          // Factura B
    doc_tipo: 99,          // Consumidor final
    doc_nro: 0,
    receptor_cond_iva_id: 5,
    receptor_nombre: "CONSUMIDOR FINAL",
  };

  const emitUrl = `${base}/arca/emitir-desde-factura/${facturaId}`;
  const r1 = await reqJson("POST", emitUrl, body);

  console.log("POST emitir status:", r1.status);
  console.log("Resp:", r1.json || r1.raw);

  assert(r1.status === 200, `Emisión falló (HTTP ${r1.status})`);
  assert(r1.json && r1.json.arca_id, "No devolvió arca_id");
  assert(r1.json.estado === "EMITIDO", `Bloqueante: quedó ${r1.json.estado}`);

  const arcaId = r1.json.arca_id;
  console.log("arca_id:", arcaId, "cbte_nro:", r1.json.cbte_nro);

  // 3) Verificar DB: items con 2 alícuotas distintas
  const ivaItems = await query(
    `SELECT DISTINCT iva_alicuota FROM arca_comprobante_items WHERE arca_comprobante_id=? ORDER BY iva_alicuota`,
    [arcaId]
  );
  const alics = ivaItems.map(x => Number(x.iva_alicuota));
  console.log("IVA items (distintos):", alics);

  assert(alics.length >= 2, "Bloqueante: no hay 2 alícuotas distintas en arca_comprobante_items");

  // 4) Verificar req_json guardado: ivaAlicuotas con >=2 y sumas = totales
  const row = await query(`SELECT imp_neto, imp_iva, req_json FROM arca_comprobantes WHERE id=?`, [arcaId]);
  assert(row.length === 1, "No encontré arca_comprobantes por id");

  const impNetoDb = Number(row[0].imp_neto);
  const impIvaDb  = Number(row[0].imp_iva);

  let req = null;
  try { req = JSON.parse(row[0].req_json); } catch (_) {}

  assert(req && req.iva && Array.isArray(req.iva.ivaAlicuotas), "req_json no tiene iva.ivaAlicuotas");
  console.log("req.iva:", req.iva);

  assert(req.iva.omitirIva === false, "Bloqueante: omitirIva debería ser false para Factura B");
  assert(req.iva.ivaAlicuotas.length >= 2, "Bloqueante: ivaAlicuotas debería tener >=2 elementos");

  const sumBase = round2(req.iva.ivaAlicuotas.reduce((a, x) => a + Number(x.baseImp || 0), 0));
  const sumIva  = round2(req.iva.ivaAlicuotas.reduce((a, x) => a + Number(x.importe || 0), 0));

  console.log("Suma BaseImp:", sumBase, "imp_neto_db:", impNetoDb);
  console.log("Suma Importe:", sumIva, "imp_iva_db:", impIvaDb);

  assert(Math.abs(sumBase - round2(impNetoDb)) <= 0.02, "Bloqueante: suma BaseImp no coincide con imp_neto");
  assert(Math.abs(sumIva - round2(impIvaDb)) <= 0.02, "Bloqueante: suma Importe no coincide con imp_iva");

  // 5) Auditoría WSFE (debe OK)
  const auUrl = `${base}/arca/wsfe/consultar/${arcaId}`;
  const au = await reqJson("GET", auUrl);
  console.log("GET auditoria:", au.status, au.json || au.raw);

  assert(au.status === 200, "Auditoría WSFE falló");
  assert(au.json && au.json.ok === true, `Auditoría no OK: ${JSON.stringify(au.json, null, 2)}`);

  console.log("✅ MULTI IVA OK");
  process.exit(0);
})().catch((e) => {
  console.error("❌ MULTI IVA FAIL:", e.message);
  process.exit(1);
});
