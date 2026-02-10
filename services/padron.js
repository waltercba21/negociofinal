// services/padron.js
require("dotenv").config();

const https = require("https");
const wsaa = require("./wsaa");

const ENV = String(process.env.ARCA_ENV || "homo").toLowerCase() === "prod" ? "prod" : "homo";

function baseUrl() {
  // ARCA / AWS padrón (personaServiceA5)
  // En docs actuales se usa personaServiceA5 para constancia/padrón. :contentReference[oaicite:2]{index=2}
  return ENV === "prod"
    ? "https://aws.arca.gov.ar/sr-padron/webservices/personaServiceA5"
    : "https://awshomo.arca.gov.ar/sr-padron/webservices/personaServiceA5";
}

function pickTag(xml, tag) {
  const r = new RegExp(`<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`, "i");
  const m = String(xml || "").match(r);
  return m ? m[1].trim() : "";
}

function pickBlock(xml, tag) {
  const r = new RegExp(`<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`, "i");
  const m = String(xml || "").match(r);
  return m ? m[1] : "";
}

async function postSoap(urlStr, xml) {
  const url = new URL(urlStr);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(xml),
          // SOAPAction no siempre es obligatorio; si tu entorno lo pide, agregalo acá.
        },
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

function parsePersona(xml) {
  // Datos generales
  const dg = pickBlock(xml, "datosGenerales");
  const nombre = pickTag(dg, "nombre");
  const apellido = pickTag(dg, "apellido");

  // Para jurídicas a veces viene “apellido”/“nombre” con la denominación.
  const razon = pickTag(dg, "razonSocial") || "";
  const display = (razon || `${nombre} ${apellido}`).trim() || apellido || nombre || null;

  // Domicilio fiscal
  const df = pickBlock(xml, "domicilioFiscal");
  const direccion = pickTag(df, "direccion") || pickTag(df, "domicilio") || "";
  const localidad = pickTag(df, "localidad") || "";
  const cp = pickTag(df, "codPostal") || "";
  const prov = pickTag(df, "descripcionProvincia") || pickTag(df, "provincia") || "";

  const domicilio = [direccion, localidad, prov, cp].filter(Boolean).join(", ") || null;

  return {
    nombre: display,
    razon_social: razon || display || null,
    domicilio,
  };
}

// Consulta “getPersona_v2”
async function getPersonaV2(cuitConsultado) {
  const cuitRep = Number(process.env.ARCA_CUIT || 0);
  if (!cuitRep) throw new Error("ARCA_CUIT no configurado");

  const service = "ws_sr_constancia_inscripcion";
  const { token, sign } = await wsaa.getTokenSign(service);

  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="http://a5.soap.ws.server.puc.sr">
  <soapenv:Header/>
  <soapenv:Body>
    <a5:getPersona_v2>
      <token>${token}</token>
      <sign>${sign}</sign>
      <cuitRepresentada>${cuitRep}</cuitRepresentada>
      <idPersona>${Number(cuitConsultado)}</idPersona>
    </a5:getPersona_v2>
  </soapenv:Body>
</soapenv:Envelope>`;

  const raw = await postSoap(baseUrl(), soap);

  const fault = pickTag(raw, "faultstring");
  if (fault) {
    const err = new Error(fault);
    err.code = "PADRON_FAULT";
    throw err;
  }

  // Si no trae datosGenerales, lo tratamos como “no encontrado”
  const dg = pickBlock(raw, "datosGenerales");
  if (!dg) return null;

  return { ...parsePersona(raw), raw };
}

module.exports = {
  getPersonaV2,
};
