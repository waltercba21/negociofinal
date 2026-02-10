// services/padron.js
const https = require("https");
const wsaa = require("./wsaa");

function pickTag(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = xml.match(r);
  return m ? m[1].trim() : "";
}

function pickBlock(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = xml.match(r);
  return m ? m[1] : "";
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
  const parts = [dir, loc, prov, cp].map(s => (s || "").trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function getPadronUrl() {
  if (process.env.ARCA_PADRON_URL) return process.env.ARCA_PADRON_URL;
  const env = String(process.env.ARCA_ENV || "homo").toLowerCase();
  const host = env === "prod" ? "aws.arca.gov.ar" : "awshomo.arca.gov.ar";
  // URL del servicio A5 (sin ?wsdl)
  return `https://${host}/sr-padron/webservices/personaServiceA5`;
}

function postXml(urlStr, xml) {
  const u = new URL(urlStr);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + (u.search || ""),
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(xml),
          SOAPAction: ""
        }
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, raw: data }));
      }
    );
    req.on("error", reject);
    req.write(xml);
    req.end();
  });
}

async function dummy() {
  const url = getPadronUrl();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:a5="http://a5.soap.ws.server.puc.sr.arca.gov.ar/">
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

  // Servicio WSAA del padrón/constancia (recomendado) + fallback legacy
  const servicesToTry = ["ws_sr_constancia_inscripcion", "ws_sr_padron_a5"];

  let last = null;

  for (const svc of servicesToTry) {
    const { token, sign } = await wsaa.getTokenSign(svc); // si wsaa ignora args, no rompe
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:a5="http://a5.soap.ws.server.puc.sr.arca.gov.ar/">
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
      last = { ok: false, fault, raw: out.raw, service: svc };
      continue;
    }

    const personaReturn = pickBlock(out.raw, "personaReturn") || out.raw;

    // Errores propios del servicio (cuando no hay datos / no autorizado, etc.)
    const errConst = pickBlock(personaReturn, "errorConstancia");
    const errMsg = pickTag(errConst, "error");
    if (errMsg) {
      last = { ok: false, error: errMsg, raw: out.raw, service: svc };
      continue;
    }

    const dg = pickBlock(personaReturn, "datosGenerales");
    if (!dg) {
      last = { ok: false, error: "Respuesta sin datosGenerales", raw: out.raw, service: svc };
      continue;
    }

    const razonSocial = pickTag(dg, "razonSocial") || null;
    const nombre = pickTag(dg, "nombre") || null;
    const apellido = pickTag(dg, "apellido") || null;

    const nombreCompleto =
      razonSocial ||
      [apellido, nombre].filter(Boolean).join(" ").trim() ||
      null;

    const dom = pickBlock(dg, "domicilioFiscal") || pickBlock(dg, "domicilio");
    const domicilio = formatDomicilio(dom);

    return {
      ok: true,
      data: {
        nombre: nombreCompleto,
        razon_social: razonSocial || nombreCompleto,
        domicilio
      },
      raw: out.raw,
      service: svc
    };
  }

  return last || { ok: false, error: "Sin respuesta", raw: "" };
}

module.exports = { dummy, getPersonaV2 };
