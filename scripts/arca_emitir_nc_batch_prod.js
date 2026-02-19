
const http = require("http");
const https = require("https");
const { URL } = require("url");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Pendientes de tu query (Facturas B EMITIDAS sin NC):
const ORIGENES = [58, 59, 63, 81, 83, 84, 85, 86, 87, 88, 89, 90];

function reqRaw(method, path, bodyObj) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, BASE_URL);
    const lib = u.protocol === "https:" ? https : http;

    const body =
      bodyObj === undefined ? null : Buffer.from(JSON.stringify(bodyObj), "utf8");

    const req = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          ...(body ? { "Content-Type": "application/json", "Content-Length": body.length } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode, headers: res.headers, text });
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function reqJson(method, path, bodyObj) {
  const r = await reqRaw(method, path, bodyObj);
  let json = null;
  try {
    json = r.text ? JSON.parse(r.text) : null;
  } catch (_) {}
  return { ...r, json };
}

function fail(step, extra) {
  console.error(`\n❌ FAIL: ${step}`);
  if (extra) console.error(extra);
  process.exit(1);
}

async function ensureOkConsultar(ncId) {
  const r = await reqJson("GET", `/arca/wsfe/consultar/${ncId}`, undefined);
  if (r.status !== 200) fail(`consultar ${ncId} status!=200`, r.text);
  if (!r.json || r.json.ok !== true) fail(`consultar ${ncId} ok!=true`, r.text);
  if (r.json.diffs && Object.keys(r.json.diffs).length) {
    fail(`consultar ${ncId} diffs!=empty`, JSON.stringify(r.json.diffs, null, 2));
  }
  return r.json;
}

async function ensurePdf(ncId) {
  const r = await reqRaw("HEAD", `/arca/pdf/${ncId}`, undefined);
  if (r.status !== 200) fail(`pdf ${ncId} status!=200`, r.text);
  const ct = String(r.headers["content-type"] || "");
  if (!ct.includes("application/pdf")) fail(`pdf ${ncId} content-type!=pdf`, ct);
  return true;
}

async function main() {
  console.log("BASE_URL:", BASE_URL);
  console.log("ORIGENES:", ORIGENES.join(", "));

  // evidencia inicial (no emite)
  const ult = await reqJson("GET", `/arca/wsfe/ultimo-nc-b?pto=2`, undefined).catch(() => null);
  // si no existe esa ruta en tu app, ignoramos (no falla). La evidencia fuerte ya la tenés por node -e.
  if (ult?.status === 200) console.log("Ult NC B (api):", ult.text);

  const results = [];

  for (const origenId of ORIGENES) {
    console.log(`\n=== ORIGEN arca_fact_id=${origenId} ===`);

    // 1) Emitir NC
    const emit = await reqJson("POST", `/arca/emitir-nc/${origenId}`, {});
    const js = emit.json;

    if (!js) fail(`emitir-nc ${origenId} JSON inválido`, emit.text);

    // Caso: ya no hay remanente (o ya existe NC suficiente)
    if (emit.status === 409) {
      fail(`emitir-nc ${origenId} devolvió 409`, emit.text);
    }

    // 2) Clasificar respuesta
    const ncId = Number(js.arca_id || 0);
    if (!ncId) fail(`emitir-nc ${origenId} sin arca_id`, emit.text);

    console.log("emit status:", emit.status, "resp.estado:", js.estado, "ncId:", ncId);

    if (emit.status === 200 && js.estado === "EMITIDO") {
      // ok, seguimos
    } else if (emit.status === 502 && js.estado === "PENDIENTE") {
      // reconciliar 1 vez (no reintentar emisión)
      console.log("PENDIENTE => reconciliar=1");
      const rec = await reqJson("GET", `/arca/wsfe/consultar/${ncId}?reconciliar=1`, undefined);
      if (rec.status !== 200) fail(`reconciliar ${ncId} status!=200`, rec.text);
      // Luego verificamos con consultar normal
    } else if (emit.status === 200 && js.estado === "RECHAZADO") {
      fail(`NC RECHAZADA origen=${origenId} ncId=${ncId}`, emit.text);
    } else {
      fail(`Respuesta inesperada emitir-nc origen=${origenId}`, emit.text);
    }

    // 3) Evidencia WSFE vs DB (consultar)
    const audit = await ensureOkConsultar(ncId);
    console.log("consultar ok:", audit.ok, "reconciliado:", audit.reconciliado);

    // 4) Evidencia PDF
    await ensurePdf(ncId);
    console.log("pdf: OK");

    results.push({ origenId, ncId });
  }

  console.log("\n✅ COMPLETADO (origen -> ncId):");
  for (const r of results) console.log(`${r.origenId} -> ${r.ncId}`);

  console.log("\nSiguiente evidencia (DB):");
  console.log(`
-- Verificar que cada origen quedó con remanente 0 (NC B EMITIDA)
SELECT
  f.id AS arca_fact_id,
  f.factura_mostrador_id,
  f.imp_total,
  COALESCE(SUM(nc.imp_total),0) AS nc_emitidas_total,
  ROUND(f.imp_total-COALESCE(SUM(nc.imp_total),0),2) AS remanente
FROM arca_comprobantes f
LEFT JOIN arca_cbtes_asoc a ON a.asociado_arca_id=f.id
LEFT JOIN arca_comprobantes nc ON nc.id=a.arca_comprobante_id AND nc.cbte_tipo=8 AND nc.estado='EMITIDO'
WHERE f.id IN (${ORIGENES.join(",")})
GROUP BY f.id, f.factura_mostrador_id, f.imp_total
ORDER BY f.id;
`);
}

main().catch((e) => {
  console.error("❌ ERROR:", e?.message || e);
  process.exit(1);
});