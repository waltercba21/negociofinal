// services/padron.js
"use strict";
require("dotenv").config();

const https = require("https");
const { URL } = require("url");
const { getTokenSign } = require("./wsaa");

const ENV = String(process.env.ARCA_ENV || "homo").toLowerCase();

const PADRON_URL =
  ENV === "prod"
    ? "https://aws.arca.gov.ar/sr-padron/webservices/personaServiceA5"
    : "https://awshomo.arca.gov.ar/sr-padron/webservices/personaServiceA5";

const NS_A5 = "http://a5.soap.ws.server.puc.sr/";

function pickTag(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = String(xml || "").match(r);
  return m ? m[1].trim() : "";
}

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

    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": String(body.length),
          // IMPORTANTE: este servicio exige SOAPAction (aunque sea vacío)
          SOAPAction: '""',
          Accept: "text/xml",
          Connection: "close",
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

async function getPersonaV2({ idPersona, cuitRepresentada }) {
  try {
    const idPers = Number(idPersona || 0);
    const cuitRep = Number(cuitRepresentada || process.env.ARCA_CUIT || 0);

    if (!idPers) return { ok: false, error: "idPersona inválido" };
    if (!cuitRep) return { ok: false, error: "ARCA_CUIT (cuitRepresentada) inválido" };

    // TA para padrón (service id correcto)
    const { token, sign } = await getTokenSign("ws_sr_constancia_inscripcion");
    if (!token || !sign) return { ok: false, error: "No se pudo obtener token/sign (WSAA)" };

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

    const { status, raw } = await postXml(PADRON_URL, xml);

    const fault = pickTag(raw, "faultstring");
    if (fault) return { ok: false, fault, raw, status };
    if (status >= 400) return { ok: false, error: `HTTP ${status}`, raw, status };

    const razonSocial = pickTag(raw, "razonSocial") || null;
    const nombre = pickTag(raw, "nombre") || null;
    const apellido = pickTag(raw, "apellido") || null;

    const domBlock = pickBlock(raw, "domicilioFiscal");
    const direccion = pickTag(domBlock, "direccion");
    const localidad = pickTag(domBlock, "localidad");
    const codPostal = pickTag(domBlock, "codPostal");
    const domicilio = [direccion, localidad, codPostal].filter(Boolean).join(" · ") || null;

    return {
      ok: true,
      data: {
        razon_social: razonSocial,
        nombre: (apellido || nombre) ? [apellido, nombre].filter(Boolean).join(" ") : null,
        domicilio,
      },
      raw,
      status,
    };
  } catch (e) {
    return { ok: false, error: e.message || "Error padrón" };
  }
}

module.exports = { getPersonaV2 };
