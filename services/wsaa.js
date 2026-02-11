// services/wsaa.js
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
let lastUniqueId = 0;

const ENV = String(process.env.ARCA_ENV || "homo").toLowerCase();

const WSAA_URL =
  process.env.ARCA_WSAA_URL ||
  (ENV === "prod"
    ? "https://wsaa.afip.gov.ar/ws/services/LoginCms"
    : "https://wsaahomo.afip.gov.ar/ws/services/LoginCms");

// Compat: acepto ambos nombres (los “viejos” y los “nuevos”)
const CERT_PATH = process.env.ARCA_CMS_CERT || process.env.ARCA_CERT_PATH || "";
const KEY_PATH = process.env.ARCA_CMS_KEY || process.env.ARCA_KEY_PATH || "";

const CACHE_DIR =
  process.env.ARCA_WSAA_CACHE_DIR || path.join(process.cwd(), ".cache");

const inflight = new Map(); // key: `${ENV}:${service}` => Promise

const memCache = new Map(); // key: `${ENV}:${service}` => { token, sign, expirationTime, raw? }

function ensureFile(p, label) {
  if (!p) throw new Error(`Falta ruta ${label} en .env`);
  if (!fs.existsSync(p)) throw new Error(`No existe ${label}: ${p}`);
}

function pickTag(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = String(xml || "").match(r);
  return m ? m[1].trim() : "";
}

function cacheFileFor(service) {
  const safe = String(service).replace(/[^\w.-]+/g, "_");
  return path.join(CACHE_DIR, `wsaa_${ENV}_${safe}.json`);
}

function parseExpiration(expStr) {
  // WSAA suele devolver ISO con timezone, Date lo parsea bien
  const d = new Date(expStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isValidTa(ta) {
  if (!ta || !ta.token || !ta.sign || !ta.expirationTime) return false;
  const exp = parseExpiration(ta.expirationTime);
  if (!exp) return false;

  const marginMs = ENV === "prod" ? 2 * 60 * 1000 : 10 * 60 * 1000;
  return exp.getTime() - Date.now() > marginMs;
}


function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function buildTRA(service) {
  // uniqueId: uint32 (recomendado usar epoch en segundos)
  let uniqueId = Math.floor(Date.now() / 1000);
  if (uniqueId <= lastUniqueId) uniqueId = lastUniqueId + 1; // evita repetidos dentro del mismo segundo
  lastUniqueId = uniqueId;

  const now = new Date();
  const gen = new Date(now.getTime() - 60 * 1000);
  const exp = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const toIso = (d) => d.toISOString().replace(".000Z", "Z");

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${toIso(gen)}</generationTime>
    <expirationTime>${toIso(exp)}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}


async function signTRAWithOpenSSL(traXml) {
  ensureFile(CERT_PATH, "ARCA_CMS_CERT/ARCA_CERT_PATH");
  ensureFile(KEY_PATH, "ARCA_CMS_KEY/ARCA_KEY_PATH");

  ensureCacheDir();

  const tmpDir = path.join(CACHE_DIR, "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const traPath = path.join(tmpDir, `tra_${Date.now()}.xml`);
  const outPath = path.join(tmpDir, `tra_${Date.now()}.cms`);

  fs.writeFileSync(traPath, traXml, "utf8");

  try {
    // Genera PKCS#7 DER (CMS)
    await execFileAsync("openssl", [
      "smime",
      "-sign",
      "-signer",
      CERT_PATH,
      "-inkey",
      KEY_PATH,
      "-in",
      traPath,
      "-out",
      outPath,
      "-outform",
      "DER",
      "-nodetach",
      "-binary",
    ]);

    const cmsDer = fs.readFileSync(outPath);
    return cmsDer.toString("base64");
  } finally {
    try { fs.unlinkSync(traPath); } catch {}
    try { fs.unlinkSync(outPath); } catch {}
  }
}

function httpPostSoap(url, xml, soapActionHeaderValue) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = Buffer.from(xml, "utf8");

    const headers = {
      "Content-Type": "text/xml; charset=utf-8",
      "Content-Length": body.length,
      Accept: "text/xml",
    };

    // IMPORTANTE: algunos endpoints “quieren” SOAPAction sí o sí
    if (soapActionHeaderValue !== undefined) {
      headers["SOAPAction"] = soapActionHeaderValue;
    }

    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + (u.search || ""),
        headers,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, raw: data }));
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
function decodeXmlEntities(s) {
  if (!s) return "";
  return String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractInnerLoginTicketXml(soapRaw) {
  const innerEscaped = pickTag(soapRaw, "loginCmsReturn");
  if (!innerEscaped) return "";
  return decodeXmlEntities(innerEscaped);
}
async function loginCms(service, { debug = false } = {}) {
  const traXml = buildTRA(service);
  const cmsB64 = await signTRAWithOpenSSL(traXml);

  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    <loginCms>
      <in0>${cmsB64}</in0>
    </loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const soapActions = ['""', '"loginCms"', '"urn:loginCms"'];

  let last = null;

  for (const act of soapActions) {
    const out = await httpPostSoap(WSAA_URL, soap, act);
    last = { ...out, usedSoapAction: act };

    const fault = pickTag(out.raw, "faultstring");
    if (fault) {
      if (/no soapaction header/i.test(fault)) continue;

      const err = new Error(fault);
      if (debug) err.raw = out.raw;
      err.status = out.status;
      err.usedSoapAction = act;
      throw err;
    }

    // 1) intento directo
    let token = pickTag(out.raw, "token");
    let sign = pickTag(out.raw, "sign");
    let expirationTime = pickTag(out.raw, "expirationTime");
    let generationTime = pickTag(out.raw, "generationTime") || null;

    // 2) fallback: parsear loginTicketResponse escapado dentro de loginCmsReturn
    if (!token || !sign) {
      const innerXml = extractInnerLoginTicketXml(out.raw);
      if (innerXml) {
        token = pickTag(innerXml, "token");
        sign = pickTag(innerXml, "sign");
        expirationTime = pickTag(innerXml, "expirationTime") || expirationTime;
        generationTime = pickTag(innerXml, "generationTime") || generationTime;
      }
    }

    if (!token || !sign) {
      const err = new Error("WSAA: respuesta sin token/sign");
      if (debug) err.raw = out.raw;
      err.status = out.status;
      err.usedSoapAction = act;
      throw err;
    }

    return {
      token,
      sign,
      expirationTime,
      generationTime,
      raw: debug ? out.raw : null,
      usedSoapAction: debug ? act : undefined,
    };
  }

  const err = new Error("no SOAPAction header!");
  if (debug) err.raw = last?.raw || null;
  err.status = last?.status || null;
  err.usedSoapAction = last?.usedSoapAction || null;
  throw err;
}

function loadCache(service) {
  const key = `${ENV}:${service}`;

  const mem = memCache.get(key);
  if (isValidTa(mem)) return mem;

  const f = cacheFileFor(service);
  if (!fs.existsSync(f)) return null;

  try {
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    if (isValidTa(j)) {
      memCache.set(key, j);
      return j;
    }
  } catch {}

  return null;
}

function saveCache(service, ta) {
  const key = `${ENV}:${service}`;
  memCache.set(key, ta);

  ensureCacheDir();
  fs.writeFileSync(cacheFileFor(service), JSON.stringify(ta, null, 2), "utf8");
}
async function getTokenSign(service, { force = false, debug = false } = {}) {
  if (!service) throw new Error("WSAA: falta service");

  ensureFile(CERT_PATH, "ARCA_CMS_CERT/ARCA_CERT_PATH");
  ensureFile(KEY_PATH, "ARCA_CMS_KEY/ARCA_KEY_PATH");

  if (!force) {
    const cached = loadCache(service);
    if (isValidTa(cached)) return cached;
  }

  const key = `${ENV}:${service}`;

  if (inflight.has(key)) {
    return await inflight.get(key);
  }

  const p = (async () => {
    try {
      const ta = await loginCms(service, { debug });
      saveCache(service, ta);
      return ta;
    } catch (e) {
      const msg = String(e?.message || "");

      // Si WSAA dice que ya hay TA válido, primero intentamos leer cache
      if (/ya posee un TA valido|alreadyAuthenticated/i.test(msg)) {
        const cached2 = loadCache(service);
        if (isValidTa(cached2)) return cached2;

        // Reintento único (con TRA distinto por uniqueId)
        const ta2 = await loginCms(service, { debug });
        saveCache(service, ta2);
        return ta2;
      }

      throw e;
    }
  })();

  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}


module.exports = { getTokenSign, WSAA_URL };
