// services/wsaa.js
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const util = require("util");

const execFileAsync = util.promisify(execFile);

const ENV = String(process.env.ARCA_ENV || "homo").toLowerCase() === "prod" ? "prod" : "homo";

const CERT_PATH = process.env.ARCA_CMS_CERT || "";
const KEY_PATH  = process.env.ARCA_CMS_KEY  || "";

const WSAA_PROD = process.env.ARCA_WSAA_URL_PROD || "https://wsaa.afip.gov.ar/ws/services/LoginCms";
const WSAA_HOMO = process.env.ARCA_WSAA_URL_HOMO || "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";

function wsaaUrl() {
  return ENV === "prod" ? WSAA_PROD : WSAA_HOMO;
}

function cacheDir() {
  return path.join(__dirname, "..", "cache");
}

function taCachePath(service) {
  // un archivo por servicio para no pisarse (wsfe vs padrón)
  const safe = String(service || "wsfe").replace(/[^a-z0-9_\\-]/gi, "_");
  return path.join(cacheDir(), `ta_${safe}_${ENV}.json`);
}

function ensureCacheDir() {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadTaFromCache(service) {
  try {
    const p = taCachePath(service);
    if (!fs.existsSync(p)) return null;
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    if (!j || j.service !== service) return null;

    // expiración (por seguridad: 1h antes)
    const exp = j.expirationTime ? new Date(j.expirationTime).getTime() : 0;
    if (!exp) return null;

    const now = Date.now();
    if (now >= (exp - 60 * 60 * 1000)) return null;

    return j;
  } catch {
    return null;
  }
}

function saveTaToCache(service, taObj) {
  ensureCacheDir();
  const p = taCachePath(service);
  fs.writeFileSync(p, JSON.stringify({ ...taObj, service }, null, 2), "utf8");
}

// Crea TRA (loginTicketRequest)
function buildTRA(service) {
  const uniq = crypto.randomBytes(8).toString("hex");
  const now = new Date();
  const genTime = new Date(now.getTime() - 60 * 1000).toISOString();
  const expTime = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${parseInt(uniq, 16)}</uniqueId>
    <generationTime>${genTime}</generationTime>
    <expirationTime>${expTime}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;
}

async function signTRA(traXml) {
  if (!CERT_PATH || !KEY_PATH) {
    throw new Error("Faltan ARCA_CMS_CERT / ARCA_CMS_KEY en .env");
  }

  ensureCacheDir();
  const tmpTra = path.join(cacheDir(), `tra_${Date.now()}.xml`);
  const tmpCms = path.join(cacheDir(), `tra_${Date.now()}.cms`);

  fs.writeFileSync(tmpTra, traXml, "utf8");

  // openssl smime -sign -in tra.xml -signer cert -inkey key -outform DER -out tra.cms
  await execFileAsync("openssl", [
    "smime", "-sign",
    "-in", tmpTra,
    "-signer", CERT_PATH,
    "-inkey", KEY_PATH,
    "-nodetach",
    "-outform", "DER",
    "-out", tmpCms
  ]);

  const cms = fs.readFileSync(tmpCms).toString("base64");

  try { fs.unlinkSync(tmpTra); } catch {}
  try { fs.unlinkSync(tmpCms); } catch {}

  return cms;
}

function pickTag(xml, tag) {
  const r = new RegExp(`<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`, "i");
  const m = String(xml || "").match(r);
  return m ? m[1].trim() : "";
}

async function loginCms(service) {
  const cached = loadTaFromCache(service);
  if (cached) return cached;

  const tra = buildTRA(service);
  const cms = await signTRA(tra);

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const https = require("https");
  const url = new URL(wsaaUrl());

  const respXml = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(soapBody),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.write(soapBody);
    req.end();
  });

  const token = pickTag(respXml, "token");
  const sign = pickTag(respXml, "sign");
  const expTime = pickTag(respXml, "expirationTime");

  if (!token || !sign) {
    const fault = pickTag(respXml, "faultstring") || "WSAA loginCms sin token/sign";
    throw new Error(fault);
  }

  const ta = { token, sign, expirationTime: expTime || null };
  saveTaToCache(service, ta);
  return ta;
}

async function getTokenSign(service) {
  const ta = await loginCms(service);
  return { token: ta.token, sign: ta.sign };
}

module.exports = {
  getTokenSign,
};
