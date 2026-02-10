// services/padron.js
require("dotenv").config();

const https = require("https");
const { URL } = require("url");
const wsaa = require("./wsaa");

const NS_A5 = "http://a5.soap.ws.server.puc.sr/"; // namespace correcto (WSDL A5)

function pickTag(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = String(xml || "").match(r);
  return m ? String(m[1] || "").trim() : "";
}

function pickBlock(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = String(xml || "").match(r);
  return m ? String(m[1] || "") : "";
}

function formatDomicilio(domXml) {
  if (!domXml) return null;
  const dir = pickTag(domXml, "direccion") || "";
  const loc = pickTag(domXml, "localidad") || "";
  const prov =
    pickTag(domXml, "descripcionProvincia") ||
    pickTag(domXml, "provincia") ||
    "";
  const cp = pickTag(domXml, "codPostal") || "";
  const parts = [dir, loc, prov, cp].map((s) => (s || "").trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function getPadronUrl() {
  if (process.env.ARCA_PADRON_URL) return process.env.ARCA_PADRON_URL;

  const env = String(process.env.ARCA_ENV || "homo").toLowerCase();
  // Padrón A5 está en AFIP (homo/prod)
  const host = env === "prod" ? "aws.afip.gov.ar" : "awshomo.afip.gov.ar";
  return `https://${host}/sr-padron/webservices/personaServiceA5`;
}

function postXml(urlStr, xml, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const body = Buffer.from(xml, "utf8");

    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + (u.search || ""),
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          Accept: "text/xml",
          // CLAVE: debe existir y con comillas
          SOAPAction: '""',
          "Content-Length": body.length,
          Connection: "close",
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode || 0, raw: data || "" }));
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);

    req.write(body);
    req.end();
  });
}

async function dummy() {
  const url = getPadronUrl();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="${NS_A5}">
  <soapenv:Header/>
  <soapenv:Body>
    <a5:dummy/>
  </soapenv:Body>
</soapenv:Envelope>`;

  const out = await postXml(url, xml);
  const fault = pickTag(out.raw, "faultstring");
  return { ...out, fault: fault || null };
}

async function getPersonaV2({ idPersona, cuitRepresentada }) {
  const url = getPadronUrl();

  // WSAA service correcto para constancia
  const servicesToTry = ["ws_sr_constancia_inscripcion", "ws_sr_padron_a5"];
  let last = null;

  for (const svc of servicesToTry) {
    const { token, sign } = await wsaa.getTokenSign(svc);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="${NS_A5}">
  <soapenv:Header/>
  <soapenv:Body>
    <a5:getPersona_v2>
      <token>${token}</token>
      <sign>${sign}</sign>
      <cuitRepresentada>${cuitRepresentada}</cuitRepresentada>
      <idPersona>${idPersona}</idPersona>
    </a5:getPersona_v2>
  </soapenv:Body>
</soapenv:Envelope>`;

    const out = await postXml(url, xml);
    const fault = pickTag(out.raw, "faultstring");
    if (fault) {
      last = { ok: false, fault, raw: out.raw, service: svc, status: out.status };
      continue;
    }

    const personaReturn = pickBlock(out.raw, "personaReturn") || out.raw;

    const errConst = pickBlock(personaReturn, "errorConstancia");
    const errMsg = pickTag(errConst, "error");
    if (errMsg) {
      last = { ok: false, error: errMsg, raw: out.raw, service: svc, status: out.status };
      continue;
    }

    const dg = pickBlock(personaReturn, "datosGenerales");
    if (!dg) {
      last = { ok: false, error: "Respuesta sin datosGenerales", raw: out.raw, service: svc, status: out.status };
      continue;
    }

    const razonSocial = pickTag(dg, "razonSocial") || null;
    const nombre = pickTag(dg, "nombre") || null;
    const apellido = pickTag(dg, "apellido") || null;

    const nombreCompleto =
      razonSocial || [apellido, nombre].filter(Boolean).join(" ").trim() || null;

    const dom = pickBlock(dg, "domicilioFiscal") || pickBlock(dg, "domicilio");
    const domicilio = formatDomicilio(dom);

    return {
      ok: true,
      data: {
        nombre: nombreCompleto,
        razon_social: razonSocial || nombreCompleto,
        domicilio,
      },
      raw: out.raw,
      service: svc,
      status: out.status,
    };
  }

  return last || { ok: false, error: "Sin respuesta", raw: "" };
}

module.exports = { dummy, getPersonaV2 };
