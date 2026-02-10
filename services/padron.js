// services/padron.js
require("dotenv").config();

const https = require("https");
const { URL } = require("url");
const wsaa = require("./wsaa");

const env = String(process.env.ARCA_ENV || "homo").toLowerCase();
const PADRON_BASE = env === "prod" ? "https://aws.arca.gov.ar" : "https://awshomo.arca.gov.ar";

// Endpoint correcto (A5)
const PADRON_URL =
  process.env.ARCA_PADRON_URL ||
  `${PADRON_BASE}/sr-padron/webservices/personaServiceA5`;

// ID de servicio para pedir TA (WSAA)
const SERVICE =
  process.env.ARCA_PADRON_SERVICE ||
  "ws_sr_constancia_inscripcion";

function pickTag(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = String(xml || "").match(r);
  return m ? String(m[1] || "").trim() : "";
}

function postXml({ url, xml, soapAction = '""', timeoutMs = 20000 }) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const body = Buffer.from(xml, "utf8");

    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          Accept: "text/xml",
          // Debe EXISTIR aunque sea vacío (con comillas)
          SOAPAction: soapAction, // => ""
          "Content-Length": body.length,
          Connection: "close",
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () =>
          resolve({ status: res.statusCode || 0, raw: data || "" })
        );
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, raw: "", error: "timeout" });
    });

    req.on("error", (err) => {
      resolve({ status: 0, raw: "", error: err.message || "request error" });
    });

    req.write(body);
    req.end();
  });
}

async function getTokenSign(serviceName) {
  if (wsaa && typeof wsaa.getTokenSign === "function") return wsaa.getTokenSign(serviceName);
  if (wsaa && typeof wsaa.getTA === "function") return wsaa.getTA(serviceName);
  throw new Error("wsaa: falta export getTokenSign/getTA");
}

// Consulta CUIT (idPersona) en padrón A5
async function getPersonaV2({ idPersona, cuitRepresentada }) {
  try {
    const id = Number(idPersona || 0);
    const cuitRep = Number(cuitRepresentada || 0);
    if (!id || !cuitRep) {
      return { ok: false, error: "idPersona/cuitRepresentada inválidos", status: 0, raw: "" };
    }

    const ta = await getTokenSign(SERVICE);
    const token = ta.token;
    const sign = ta.sign;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="http://a5.soap.ws.server.puc.sr/">
  <soapenv:Header/>
  <soapenv:Body>
    <a5:getPersona_v2>
      <token>${token}</token>
      <sign>${sign}</sign>
      <cuitRepresentada>${cuitRep}</cuitRepresentada>
      <idPersona>${id}</idPersona>
    </a5:getPersona_v2>
  </soapenv:Body>
</soapenv:Envelope>`;

    const resp = await postXml({ url: PADRON_URL, xml, soapAction: '""' });

    const fault = pickTag(resp.raw, "faultstring") || pickTag(resp.raw, "FaultString");
    if (fault) return { ok: false, fault, status: resp.status, raw: resp.raw, service: SERVICE };

    const razon_social =
      pickTag(resp.raw, "razonSocial") ||
      pickTag(resp.raw, "razon_social") ||
      pickTag(resp.raw, "denominacion");

    const nombre =
      pickTag(resp.raw, "nombre") ||
      pickTag(resp.raw, "nombrePersona") ||
      pickTag(resp.raw, "apellidoNombre");

    const domicilio =
      pickTag(resp.raw, "direccion") ||
      pickTag(resp.raw, "domicilio") ||
      pickTag(resp.raw, "domicilioFiscal");

    if (!razon_social && !nombre) {
      return { ok: false, error: "Respuesta sin datos (ver raw)", status: resp.status, raw: resp.raw, service: SERVICE };
    }

    return {
      ok: true,
      status: resp.status,
      raw: resp.raw,
      service: SERVICE,
      data: {
        razon_social: razon_social || null,
        nombre: nombre || null,
        domicilio: domicilio || null,
      },
    };
  } catch (e) {
    return { ok: false, error: e.message || "Error padrón", status: 0, raw: "", service: SERVICE };
  }
}

module.exports = { getPersonaV2 };
