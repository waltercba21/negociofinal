// services/padron.js
require("dotenv").config();

const wsaa = require("./wsaa");

const ENV = String(process.env.ARCA_ENV || "HOMO").toUpperCase();

// Default correcto: A13 (no A5)
const PADRON_URL =
  process.env.ARCA_PADRON_URL ||
  (ENV === "PROD"
    ? "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA13"
    : "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA13");

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

function formatDomicilio(domXml) {
  if (!domXml) return null;

  const calle = pickTag(domXml, "calle") || "";
  const nro = pickTag(domXml, "numero") || "";
  const piso = pickTag(domXml, "piso") || "";
  const dpto =
    pickTag(domXml, "depto") ||
    pickTag(domXml, "oficinaDptoLocal") ||
    "";
  const localidad =
    pickTag(domXml, "localidad") ||
    pickTag(domXml, "descripcionLocalidad") ||
    "";
  const provincia =
    pickTag(domXml, "descripcionProvincia") ||
    pickTag(domXml, "provincia") ||
    "";
  const cp =
    pickTag(domXml, "codigoPostal") ||
    pickTag(domXml, "codPostal") ||
    pickTag(domXml, "codPostal") ||
    "";

  const linea1 = [calle, nro].filter(Boolean).join(" ").trim();
  const linea2 = [piso ? `Piso ${piso}` : "", dpto ? `Dto/Of ${dpto}` : ""]
    .filter(Boolean)
    .join(" ")
    .trim();
  const linea3 = [localidad, provincia].filter(Boolean).join(", ").trim();
  const linea4 = cp ? `CP ${cp}` : "";

  const parts = [linea1, linea2, linea3, linea4].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

async function postXml(url, xml, soapActionValue) {
  const headers = {
    "Content-Type": "text/xml; charset=utf-8",
    Accept: "text/xml",
  };
  if (soapActionValue !== undefined) {
    const act = String(soapActionValue);
    headers["SOAPAction"] = act.startsWith('"') ? act : `"${act}"`;
  }

  const res = await fetch(url, { method: "POST", headers, body: xml });
  const text = await res.text();
  return { status: res.status, raw: text, usedSoapAction: soapActionValue };
}

async function postXmlWithSoapActionFallback(url, xml, actions) {
  let last = null;
  for (const act of actions) {
    const out = await postXml(url, xml, act);
    last = out;

    const fault = pickTag(out.raw, "faultstring") || "";
    if (!/no soapaction header/i.test(fault || "")) return out;
  }
  return last;
}

async function dummy() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a13="http://a13.soap.ws.server.puc.sr/">
  <soapenv:Header/>
  <soapenv:Body>
    <a13:dummy/>
  </soapenv:Body>
</soapenv:Envelope>`;

  const out = await postXmlWithSoapActionFallback(PADRON_URL, xml, ["", "dummy"]);
  const fault = pickTag(out.raw, "faultstring");
  return { status: out.status, fault: fault || null };
}

// Mantenemos el nombre para no romper imports/scripts, pero A13 usa getPersona
async function getPersonaV2({ idPersona, cuitRepresentada, debug = false }) {
  const serviceHint = String(process.env.ARCA_PADRON_SERVICE || "").trim();
  const servicesToTry = [serviceHint || "ws_sr_padron_a13"];

  // A13 -> getPersona :contentReference[oaicite:1]{index=1}
  const soapActions = [
    "",
    "getPersona",
    "urn:getPersona",
    "http://a13.soap.ws.server.puc.sr/getPersona",
  ];

  let last = null;

  for (const svc of servicesToTry) {
    try {
      const ts = await wsaa.getTokenSign(svc, { debug });

      const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a13="http://a13.soap.ws.server.puc.sr/">
  <soapenv:Header/>
  <soapenv:Body>
    <a13:getPersona>
      <token>${ts.token}</token>
      <sign>${ts.sign}</sign>
      <cuitRepresentada>${Number(cuitRepresentada || 0)}</cuitRepresentada>
      <idPersona>${Number(idPersona || 0)}</idPersona>
    </a13:getPersona>
  </soapenv:Body>
</soapenv:Envelope>`;

      const out = await postXmlWithSoapActionFallback(PADRON_URL, soap, soapActions);

    const fault = pickTag(out.raw, "faultstring");
if (fault) {
  const msg = String(fault || "").toLowerCase();

  // Padrón HOMO: CUIT inexistente -> tratar como "no encontrado"
if (msg.includes("consultada es inexistente")) {
  return {
    ok: true,
    notFound: true,
    data: null,
    service: svc,
    status: 200,               // status "lógico" de tu wrapper
    upstreamStatus: out.status, // 500 real del SOAP
    error: null,
    raw: debug ? out.raw : null,
  };
}


  last = { ok: false, error: fault, raw: debug ? out.raw : null, service: svc, status: out.status };
  continue;
}


      // A13: personaReturn -> persona :contentReference[oaicite:2]{index=2}
      const personaReturn = pickBlock(out.raw, "personaReturn");
      const persona = personaReturn ? pickBlock(personaReturn, "persona") : "";
      if (!persona) {
        last = { ok: false, error: "Respuesta sin personaReturn/persona", raw: debug ? out.raw : null, service: svc, status: out.status };
        continue;
      }

      const razonSocial = pickTag(persona, "razonSocial") || null;
      const nombre = pickTag(persona, "nombre") || null;
      const apellido = pickTag(persona, "apellido") || null;

      const nombreCompleto =
        razonSocial ||
        [apellido, nombre].filter(Boolean).join(" ").trim() ||
        null;

      // domicilio puede venir como <domicilio> ... </domicilio>
      const dom = pickBlock(persona, "domicilio") || pickBlock(persona, "domicilioFiscal");
      const domicilio = formatDomicilio(dom);

      return {
        ok: true,
        data: {
          nombre: nombreCompleto,
          razon_social: razonSocial || nombreCompleto,
          domicilio,
        },
        raw: debug ? out.raw : null,
        service: svc,
        status: out.status,
      };
    } catch (e) {
      last = { ok: false, error: e.message || String(e), raw: e.raw || null, service: svc, status: e.status || null };
    }
  }

  return last || { ok: false, error: "Sin respuesta", raw: null };
}

module.exports = { dummy, getPersonaV2 };
