// scripts/arca_smoke_wsfe.js
require("dotenv").config();

const fs = require("fs");
const { execFileSync } = require("child_process");

const wsaa = require("../services/wsaa");
const wsfe = require("../services/wsfe");

function mask(s) {
  const x = String(s || "");
  if (x.length <= 12) return "***";
  return `${x.slice(0, 6)}...${x.slice(-6)}`;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  console.log("=== ARCA SMOKE WSFE ===");

  const env = String(process.env.ARCA_ENV || "homo").toLowerCase();
  const cuit = String(process.env.ARCA_CUIT || "").trim();
  const pto = Number(process.env.ARCA_PTO_VTA || 0);

  const cert = process.env.ARCA_CMS_CERT || process.env.ARCA_CERT_PATH;
  const key  = process.env.ARCA_CMS_KEY  || process.env.ARCA_KEY_PATH;

  console.log({ env, cuit, pto, WSAA_URL: wsaa.WSAA_URL, WSFE_URL: wsfe.WSFE_URL });
  console.log({ cert, key });

  // openssl
  const opensslVer = execFileSync("openssl", ["version"], { encoding: "utf8" }).trim();
  console.log("openssl:", opensslVer);

  // paths
  assert(cuit && /^\d{11}$/.test(cuit), "ARCA_CUIT inválido o faltante");
  assert(pto > 0, "ARCA_PTO_VTA inválido o faltante");
  assert(cert && fs.existsSync(cert), `No existe cert: ${cert}`);
  assert(key && fs.existsSync(key), `No existe key: ${key}`);

  // WSAA token/sign
  const ta1 = await wsaa.getTokenSign("wsfe");
  assert(ta1.token && ta1.sign, "WSAA sin token/sign");
  assert(ta1.expirationTime, "WSAA sin expirationTime");
  console.log("TA1:", {
    token: mask(ta1.token),
    sign: mask(ta1.sign),
    generationTime: ta1.generationTime,
    expirationTime: ta1.expirationTime,
  });

  // cache check (debe salir sin pedir uno nuevo)
  const ta2 = await wsaa.getTokenSign("wsfe");
  console.log("TA2:", { token: mask(ta2.token), sign: mask(ta2.sign), expirationTime: ta2.expirationTime });

  // WSFE dummy
  const d = await wsfe.FEDummy();
  console.log("FEDummy:", { app: d.app, db: d.db, auth: d.auth });
  assert(d.app && d.db && d.auth, "FEDummy incompleto (App/Db/Auth vacíos)");

  // WSFE último autorizado (Fact B = 6 por defecto)
  const cbteTipo = 6;
  const u = await wsfe.FECompUltimoAutorizado(pto, cbteTipo);
  console.log("FECompUltimoAutorizado:", { cbteTipo, ultimo: u.ultimo });
  assert(Number.isFinite(u.ultimo), "Último autorizado no numérico");

  console.log("✅ SMOKE OK");
  process.exit(0);
})().catch((e) => {
  console.error("❌ SMOKE FAIL:", e.message);
  process.exit(1);
});
