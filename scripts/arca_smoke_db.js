// scripts/arca_smoke_db.js
require("dotenv").config();

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

function groupIndexes(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = r.Key_name;
    if (!m.has(k)) m.set(k, { key: k, unique: Number(r.Non_unique) === 0, cols: [] });
    m.get(k).cols.push({ col: r.Column_name, seq: Number(r.Seq_in_index) });
  }
  for (const v of m.values()) v.cols.sort((a, b) => a.seq - b.seq);
  return [...m.values()];
}

function hasUniqueKeyWithCols(indexes, cols) {
  const want = cols.map(String);
  return indexes.some(ix => {
    if (!ix.unique) return false;
    const got = ix.cols.map(c => c.col);
    return want.every(c => got.includes(c));
  });
}

(async () => {
  console.log("=== ARCA SMOKE DB ===");

  const db = await query("SELECT DATABASE() AS db");
  console.log("DB:", db[0]?.db);

  const tables = await query("SHOW TABLES LIKE 'arca_%'");
  const tnames = tables.map(o => Object.values(o)[0]);
  console.log("ARCA tables:", tnames);

  const must = ["arca_comprobantes", "arca_comprobante_items", "arca_receptores_cache", "arca_wsfe_consultas"];
  for (const t of must) assert(tnames.includes(t), `Falta tabla ${t}`);

  const cols = await query("DESCRIBE arca_comprobantes");
  const colNames = cols.map(c => c.Field);
  console.log("arca_comprobantes columns:", colNames);

  // Requeridos mínimos
  const requiredCols = [
    "id","factura_mostrador_id","ambiente","cuit_emisor","pto_vta","cbte_tipo","cbte_nro","cbte_fch",
    "doc_tipo","doc_nro","imp_total","imp_neto","imp_iva","estado"
  ];
  for (const c of requiredCols) assert(colNames.includes(c), `Falta columna ${c} en arca_comprobantes`);

  const idxRows = await query("SHOW INDEX FROM arca_comprobantes");
  const idx = groupIndexes(idxRows);
  console.log("Indexes (arca_comprobantes):");
  for (const i of idx) {
    console.log(`- ${i.key} | unique=${i.unique} | cols=${i.cols.map(x=>x.col).join(",")}`);
  }

  // 1) UNIQUE por comprobante (anti-duplicado nro en un mismo emisor/pto/tipo/ambiente)
  const needCbte = ["ambiente","cuit_emisor","pto_vta","cbte_tipo","cbte_nro"];
  assert(
    hasUniqueKeyWithCols(idx, needCbte),
    `Falta UNIQUE que cubra columnas: ${needCbte.join(", ")}`
  );

  // 2) UNIQUE por factura activa (lo esperado es columna generated factura_activa + unique)
  const hasFacturaActivaCol = colNames.includes("factura_activa");
  const hasFacturaActivaUniq = idx.some(i => i.unique && i.cols.some(c => c.col === "factura_activa"));

  console.log("factura_activa column:", hasFacturaActivaCol);
  console.log("factura_activa unique:", hasFacturaActivaUniq);

  if (!hasFacturaActivaCol || !hasFacturaActivaUniq) {
    console.log("⚠️  NO está la protección 'factura_activa' (generated + UNIQUE).");
    console.log("    Esto es bloqueante si querés 100% anti-duplicado por factura activa.");
    process.exit(2);
  }

  console.log("✅ DB SMOKE OK");
  process.exit(0);
})().catch((e) => {
  console.error("❌ DB SMOKE FAIL:", e.message);
  process.exit(1);
});
