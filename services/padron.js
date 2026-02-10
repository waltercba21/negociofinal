// services/padron.js
"use strict";

const https = require("https");
const { URL } = require("url");
const wsaa = require("./wsaa");

// URLs oficiales (HOMO / PROD)
const URL_HOMO = "https://awshomo.arca.gov.ar/sr-padron/webservices/personaServiceA5";
const URL_PROD = "https://aws.arca.gov.ar/sr-padron/webservices/personaServiceA5";

// Namespace correcto (según manual)
const NS_A5 = "http://a5.soap.ws.server.puc.sr/";

// Service ID para pedir TA a WSAA (según manual)
const WSAA_SERVICE_ID = "ws_sr_constancia_inscripcion";

function isProd() {
  return String(process.env.ARCA_ENV || "homo").toLowerCase() === "prod";
}

function endpoint() {
  return isProd() ? URL_PROD : URL_HOMO;
}

function stripXml(xml) {
  return String(xml || "").replace(/\r?\n/g, " ").trim();
}

// Extrae tag simple <tag>valor</tag> (sin importar prefijos)
function pickTag(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = String(xml || "").match(r);
  return m ? m[1].trim() : "";
}

// Extrae un bloque completo <tag>...</tag>
function pickBlock(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = String(xml || "").match(r);
  return m ? m[1] : "";
}

function postXml(urlStr, xml) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const body = Buffer.from(xml, "utf8");

    // IMPORTANTE:
    // - SOAP 1.1 => Content-Type text/xml
    // - SOAPAction debe existir; si va vacío, mandalo como '""'
    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": String(body.length),
          "SOAPAction": '""',
          "Accept": "text/xml",
          "Connection": "close",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode || 0, raw });
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function dummy() {
  const xml = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="${NS_A5}">
  <soapenv:Header/>
  <soapenv:Body>
    <a5:dummy/>
  </soapenv:Body>
</soapenv:Envelope>`.trim();

  const { status, raw } = await postXml(endpoint(), xml);

  if (status >= 400) {
    const err = new Error(stripXml(raw) || `HTTP ${status}`);
    err.status = status;
    err.raw = raw;
    throw err;
  }

  return { raw };
}

async function getPersonaV2({ cuitRepresentada, idPersona }) {
  const cuitRep = Number(cuitRepresentada || 0);
  const idPers = Number(idPersona || 0);
  if (!cuitRep || !idPers) throw new Error("Faltan cuitRepresentada / idPersona");

  // TA de WSAA para el service id correcto
  const ta = await wsaa.getTA(WSAA_SERVICE_ID);
  const token = ta?.token;
  const sign = ta?.sign;
  if (!token || !sign) throw new Error("No se pudo obtener token/sign (WSAA)");

  const xml = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="${NS_A5}">
  <soapenv:Header/>
  <soapenv:Body>
    <a5:getPersona_v2>
      <token>${token}</token>
      <sign>${sign}</sign>
      <cuitRepresentada>${cuitRep}</cuitRepresentada>
      <idPersona>${idPers}</idPersona>
    </a5:getPersona_v2>
  </soapenv:Body>
</soapenv:Envelope>`.trim();

  const { status, raw } = await postXml(endpoint(), xml);

  if (status >= 400) {
    // Si viene SOAP Fault, devolvemos algo legible
    const fault = pickTag(raw, "faultstring") || stripXml(raw);
    const err = new Error(fault || `HTTP ${status}`);
    err.status = status;
    err.raw = raw;
    throw err;
  }

  // Parse mínimo (razón social/nombre + domicilio fiscal)
  const razonSocial = pickTag(raw, "razonSocial");
  const nombre = pickTag(raw, "nombre");
  const apellido = pickTag(raw, "apellido");

  // domicilioFiscal es un bloque con tags internos (direccion, localidad, codPostal, etc.)
  const domBlock = pickBlock(raw, "domicilioFiscal");
  const direccion = pickTag(domBlock, "direccion");
  const localidad = pickTag(domBlock, "localidad");
  const codPostal = pickTag(domBlock, "codPostal");

  const domicilio = [direccion, localidad, codPostal].filter(Boolean).join(" · ") || null;

  return {
    raw,
    razon_social: razonSocial || null,
    nombre: (apellido || nombre) ? [apellido, nombre].filter(Boolean).join(" ") : null,
    domicilio,
  };
}

module.exports = {
  dummy,
  getPersonaV2,
};
