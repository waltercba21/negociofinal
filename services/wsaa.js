// services/wsaa.js
require("dotenv").config();

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const { execFile } = require("child_process");

const ENV = (process.env.ARCA_ENV || "homo").toLowerCase();
const CERT = process.env.ARCA_CERT_PATH;
const KEY  = process.env.ARCA_KEY_PATH;

const WSAA_URL =
  ENV === "prod"
    ? "https://wsaa.afip.gov.ar/ws/services/LoginCms"
    : "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";

// Cache por archivo (simple, suficiente para empezar)
const TA_CACHE_DIR = path.join(__dirname, ".cache");
const TA_CACHE = path.join(TA_CACHE_DIR, `ta_wsfe_${ENV}.json`);

function postXml(url, xml, soapAction) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = {
      "Content-Type": "text/xml; charset=utf-8",
      "Content-Length": Buffer.byteLength(xml),
    };
    if (soapAction) headers["SOAPAction"] = `"${soapAction}"`;

    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      }
    );

    req.on("error", reject);
    req.write(xml);
    req.end();
  });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { ...opts }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

function isoAR(d = new Date()) {
  const s = d
    .toLocaleString("sv-SE", { timeZone: "America/Argentina/Cordoba" })
    .replace(" ", "T");
  return `${s}-03:00`;
}

// Soporta tags normales y escapados (&lt;token&gt;)
function pickTag(xml, tag) {
  const r1 = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m1 = xml.match(r1);
  if (m1) return m1[1].trim();

  const r2 = new RegExp(
    `&lt;(?:(?:\\w+):)?${tag}[^&]*&gt;([\\s\\S]*?)&lt;\\/(?:(?:\\w+):)?${tag}&gt;`,
    "i"
  );
  const m2 = xml.match(r2);
  if (m2) return m2[1].trim();
  return "";
}

function tokenExpEpoch(tokenB64) {
  try {
    const xml = Buffer.from(tokenB64, "base64").toString("utf8");
    const m = xml.match(/exp_time="(\d+)"/);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}

function tokenIsValid(tokenB64, skewSec = 60) {
  const exp = tokenExpEpoch(tokenB64);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp - skewSec > now;
}

function loadTaFromCache(service) {
  if (!fs.existsSync(TA_CACHE)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(TA_CACHE, "utf8"));
    if (j.service !== service) return null;
    if (!j.token || !j.sign) return null;
    if (!tokenIsValid(j.token)) return null;
    return { token: j.token, sign: j.sign };
  } catch {
    return null;
  }
}

function saveTaToCache(service, token, sign) {
  if (!fs.existsSync(TA_CACHE_DIR)) fs.mkdirSync(TA_CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    TA_CACHE,
    JSON.stringify(
      { service, token, sign, exp: tokenExpEpoch(token), savedAt: new Date().toISOString() },
      null,
      2
    )
  );
}

// opcional: si ya tenés token/sign pre-generados
function loadTaFromFiles() {
  const TOKEN_PATH = process.env.ARCA_TOKEN_PATH || "";
  const SIGN_PATH  = process.env.ARCA_SIGN_PATH  || "";
  if (!TOKEN_PATH || !SIGN_PATH) return null;
  if (!fs.existsSync(TOKEN_PATH) || !fs.existsSync(SIGN_PATH)) return null;
  const token = fs.readFileSync(TOKEN_PATH, "utf8").trim();
  const sign  = fs.readFileSync(SIGN_PATH, "utf8").trim();
  if (!token || !sign) return null;
  if (!tokenIsValid(token)) return null;
  return { token, sign };
}

async function getTokenSign(service = "wsfe") {
  const cached = loadTaFromCache(service) || loadTaFromFiles();
  if (cached) return cached;

  if (!CERT || !KEY) throw new Error("Faltan ARCA_CERT_PATH / ARCA_KEY_PATH");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "arca-"));
  const traPath = path.join(tmp, "tra.xml");
  const cmsPath = path.join(tmp, "tra.cms");
  const b64Path = path.join(tmp, "tra.cms.b64");

  const gen = new Date(Date.now() - 5 * 60 * 1000);
  const exp = new Date(Date.now() + 10 * 60 * 1000);

  const tra = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${isoAR(gen)}</generationTime>
    <expirationTime>${isoAR(exp)}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;

  fs.writeFileSync(traPath, tra);

  await run("openssl", [
    "smime",
    "-sign",
    "-signer", CERT,
    "-inkey", KEY,
    "-in", traPath,
    "-out", cmsPath,
    "-outform", "DER",
    "-nodetach",
  ]);

  await run("openssl", ["base64", "-in", cmsPath, "-out", b64Path, "-A"]);
  const cmsB64 = fs.readFileSync(b64Path, "utf8").trim();

  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:loginCms>
      <ws:in0>${cmsB64}</ws:in0>
    </ws:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const resp = await postXml(WSAA_URL, soap, "urn:LoginCms");

  const token = pickTag(resp, "token");
  const sign  = pickTag(resp, "sign");

  if (token && sign) {
    saveTaToCache(service, token, sign);
    return { token, sign };
  }

  // si WSAA responde alreadyAuthenticated, reutilizamos TA guardado
  if (/alreadyAuthenticated/i.test(resp)) {
    const reuse = loadTaFromCache(service) || loadTaFromFiles();
    if (reuse) return reuse;
  }

  throw new Error("WSAA no devolvió token/sign");
}

module.exports = { getTokenSign };
