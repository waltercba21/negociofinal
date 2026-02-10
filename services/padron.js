// services/wsaa.js
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFile } = require("child_process");

const CERT_PATH = process.env.ARCA_CMS_CERT || "";
const KEY_PATH  = process.env.ARCA_CMS_KEY  || "";

const ENV = String(process.env.ARCA_ENV || "HOMO").toUpperCase();

const WSAA_URL =
  process.env.ARCA_WSAA_URL ||
  (ENV === "PROD"
    ? "https://wsaa.afip.gov.ar/ws/services/LoginCms"
    : "https://wsaahomo.afip.gov.ar/ws/services/LoginCms");

const CACHE_PATH =
  process.env.ARCA_TA_CACHE_PATH ||
  path.join(__dirname, "ta_cache.json");

// ---------- helpers ----------
function pickTag(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = String(xml || "").match(r);
  return m ? m[1].trim() : "";
}

function isoNowPlus(minutes) {
  const d = new Date(Date.now() + minutes * 60 * 1000);
  return d.toISOString();
}

function buildTRA(service) {
  const uniqueId = Math.floor(Date.now() / 1000);
  const generationTime = isoNowPlus(-10);
  const expirationTime = isoNowPlus(10);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generationTime}</generationTime>
    <expirationTime>${expirationTime}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

function ensureCertKey() {
  if (!CERT_PATH || !KEY_PATH) throw new Error("Faltan ARCA_CMS_CERT / ARCA_CMS_KEY en .env");
  if (!fs.existsSync(CERT_PATH)) throw new Error(`No existe CERT: ${CERT_PATH}`);
  if (!fs.existsSync(KEY_PATH)) throw new Error(`No existe KEY: ${KEY_PATH}`);
}

function signTRAWithOpenSSL(traXml) {
  ensureCertKey();

  const openssl = process.env.ARCA_OPENSSL || "openssl";
  const tmpDir = path.join(__dirname, ".tmp_wsaa");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const traPath = path.join(tmpDir, `tra_${Date.now()}.xml`);
  const outDer  = path.join(tmpDir, `tra_${Date.now()}.p7s`);

  fs.writeFileSync(traPath, traXml, "utf8");

  return new Promise((resolve, reject) => {
    // PKCS#7 DER
    const args = [
      "smime",
      "-sign",
      "-signer", CERT_PATH,
      "-inkey", KEY_PATH,
      "-in", traPath,
      "-out", outDer,
      "-outform", "DER",
      "-nodetach",
      "-binary",
    ];

    execFile(openssl, args, { windowsHide: true }, (err, stdout, stderr) => {
      try { fs.unlinkSync(traPath); } catch {}
      if (err) {
        const msg = (stderr || err.message || "").trim();
        return reject(new Error(msg || "Error ejecutando openssl (WSAA)"));
      }
      try {
        const der = fs.readFileSync(outDer);
        try { fs.unlinkSync(outDer); } catch {}
        resolve(der.toString("base64"));
      } catch (e) {
        reject(new Error(e.message || "No se pudo leer el CMS generado"));
      }
    });
  });
}

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return {};
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8") || "{}");
  } catch {
    return {};
  }
}

function saveCache(obj) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(obj, null, 2), "utf8");
  } catch {
    // no-op
  }
}

function isValid(entry) {
  if (!entry || !entry.token || !entry.sign || !entry.expirationTime) return false;
  const exp = Date.parse(entry.expirationTime);
  if (!Number.isFinite(exp)) return false;
  // margen de 60s
  return exp - Date.now() > 60 * 1000;
}

function postSoapLoginCms(in0Base64, soapActionValue) {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${in0Base64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const body = Buffer.from(envelope, "utf8");
  const url = new URL(WSAA_URL);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": body.length,
          // CLAVE: SOAPAction presente (aunque sea vacío)
          "SOAPAction": soapActionValue === undefined ? '""' : `"${soapActionValue}"`,
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, raw: data }));
      }
    );

    req.on("error", (e) => reject(e));
    req.write(body);
    req.end();
  });
}

async function loginCms(service, debug = false) {
  const tra = buildTRA(service);
  const cmsB64 = await signTRAWithOpenSSL(tra);

  // fallback SOAPAction (algunos servers exigen algo distinto)
  const tries = [undefined, "", "loginCms"];

  let last = null;
  for (const act of tries) {
    const out = await postSoapLoginCms(cmsB64, act);
    const fault = pickTag(out.raw, "faultstring");
    last = { ...out, fault: fault || null, usedSoapAction: act === undefined ? '""' : act };

    if (!fault && !/no soapaction header/i.test(out.raw || "")) {
      return { ...last, tra, cmsB64 };
    }
  }

  const msg = last?.fault || "no SOAPAction header!";
  const err = new Error(msg);
  err.raw = debug ? last?.raw : null;
  err.status = last?.status || null;
  err.usedSoapAction = last?.usedSoapAction;
  throw err;
}

// ---------- API ----------
async function getTokenSign(service, opts = {}) {
  const debug = !!opts.debug;

  const cache = loadCache();
  if (isValid(cache[service])) return cache[service];

  const out = await loginCms(service, debug);

  const loginTicketResponse = pickTag(out.raw, "loginTicketResponse");
  const token = pickTag(loginTicketResponse, "token") || pickTag(out.raw, "token");
  const sign  = pickTag(loginTicketResponse, "sign")  || pickTag(out.raw, "sign");
  const expirationTime =
    pickTag(loginTicketResponse, "expirationTime") || pickTag(out.raw, "expirationTime");

  if (!token || !sign || !expirationTime) {
    const fault = pickTag(out.raw, "faultstring") || "Respuesta WSAA inválida";
    const err = new Error(fault);
    err.raw = debug ? out.raw : null;
    throw err;
  }

  cache[service] = { token, sign, expirationTime };
  saveCache(cache);

  return cache[service];
}

// compat
async function getTA(service, opts = {}) {
  return getTokenSign(service, opts);
}

module.exports = { getTokenSign, getTA };
