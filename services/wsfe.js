// services/wsfe.js
require("dotenv").config();

const https = require("https");
const http = require("http");
const { getTokenSign } = require("./wsaa");

const HTTPS_AGENT = new https.Agent({ keepAlive: true });
const HTTP_AGENT = new http.Agent({ keepAlive: true });

const ENV = (process.env.ARCA_ENV || "homo").toLowerCase();
const CUIT = String(process.env.ARCA_CUIT || "").trim();
const PTO_VTA_DEFAULT = Number(process.env.ARCA_PTO_VTA || 0);

const WSFE_URL =
  process.env.ARCA_WSFE_URL ||
  (ENV === "prod"
    ? "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
    : "https://wswhomo.afip.gov.ar/wsfev1/service.asmx");

if (ENV === "prod" && /homo/i.test(WSFE_URL)) {
  throw new Error(`[ARCA][PROD] ARCA_WSFE_URL apunta a HOMO: ${WSFE_URL}`);
}
function postXml(url, xml, soapAction) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);

    const headers = {
      "Content-Type": "text/xml; charset=utf-8",
      "Content-Length": Buffer.byteLength(xml),
    };
    if (soapAction) headers["SOAPAction"] = `"${soapAction}"`;

    const req = https.request(
      { method: "POST", hostname: u.hostname, path: u.pathname + u.search, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            body: data,
            headers: res.headers || {},
          });
        });
      }
    );

    req.on("error", reject);
    req.write(xml);
    req.end();
  });
}

function normalizeSoapAction(soapAction) {
  if (!soapAction) return "";
  if (/^https?:\/\//i.test(soapAction)) return soapAction;
  return `http://ar.gov.afip.dif.FEV1/${soapAction}`;
}

async function soapRequest(action, xml, url) {
  const soapAction = `http://ar.gov.afip.dif.FEV1/${action}`;
  try {
    return await postXml(url, xml, soapAction);
  } catch (err) {
    // AFIP/ARCA suele responder SOAP Fault con HTTP 500.
    if (err && err.code === "WSFE_HTTP" && err.body) {
      return err.body; // devolvemos el XML igual
    }
    throw err;
  }
}

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
  const m = String(xml || "").match(r);
  return m ? m[1] : "";
}

function pickFirstCodeMsg(blockXml, itemTag) {
  const b = String(blockXml || "");
  const r = new RegExp(
    `<(?:(?:\\w+):)?${itemTag}[^>]*>[\\s\\S]*?<(?:(?:\\w+):)?Code[^>]*>([\\s\\S]*?)<\\/` +
      `(?:(?:\\w+):)?Code>[\\s\\S]*?<(?:(?:\\w+):)?Msg[^>]*>([\\s\\S]*?)<\\/` +
      `(?:(?:\\w+):)?Msg>[\\s\\S]*?<\\/(?:(?:\\w+):)?${itemTag}>`,
    "i"
  );
  const m = b.match(r);
  return { code: m ? String(m[1]).trim() : "", msg: m ? String(m[2]).replace(/\s+/g, " ").trim() : "" };
}

function parseWsfeCaeResponse(respXml) {
  const xml = String(respXml || "");
    if (xml.includes("<soap:Fault") || xml.includes(":Fault>")) {
    const m = xml.match(/<faultstring>([\s\S]*?)<\/faultstring>/i);
    const fault = m ? m[1] : "SOAP Fault";
    return {
      next: null,
      resultado: "R",
      cae: null,
      caeVto: null,
      obsCode: "SOAP_FAULT",
      obsMsg: fault,
      rawXml: xml,
    };
  }
  const resultado = (pickTag(respXml, "Resultado") || "").trim();
  const cae = (pickTag(respXml, "CAE") || "").trim();
  const caeVto = (pickTag(respXml, "CAEFchVto") || "").trim();

  const err = pickFirstCodeMsg(pickBlock(respXml, "Errors"), "Err");
  const obs = pickFirstCodeMsg(pickBlock(respXml, "Observaciones"), "Obs");
  const evt = pickFirstCodeMsg(pickBlock(respXml, "Events"), "Evt");

  let obsCode = "";
  let obsMsg = "";

  if (resultado.toUpperCase() === "R") {
    if (err.code) { obsCode = err.code; obsMsg = err.msg; }
    else if (obs.code) { obsCode = obs.code; obsMsg = obs.msg; }
    else if (evt.code) { obsCode = evt.code; obsMsg = evt.msg; }
  } else {
    if (obs.code) { obsCode = obs.code; obsMsg = obs.msg; }
    else if (evt.code) { obsCode = evt.code; obsMsg = evt.msg; }
  }

  return {
    resultado: resultado || null,
    cae: cae || null,
    caeVto: caeVto || null,
    obsCode: obsCode || null,
    obsMsg: obsMsg || null,
  };
}

function yyyymmddARFromDate(dateLike) {
  const d = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(d.getTime())) throw new Error("Fecha inválida para CbteFch");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  const f = `${y}${m}${day}`;
  if (!/^\d{8}$/.test(f)) throw new Error(`CbteFch inválido generado: "${f}"`);
  return f;
}

async function auth() {
  if (!CUIT) throw new Error("Falta ARCA_CUIT");
  const { token, sign } = await getTokenSign("wsfe");
  return { token, sign, cuit: CUIT };
}

async function FEDummy() {
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FEDummy/>
  </soapenv:Body>
</soapenv:Envelope>`;
  const resp = await postXml(WSFE_URL, soap, "http://ar.gov.afip.dif.FEV1/FEDummy");
  return {
    app: pickTag(resp, "AppServer"),
    db: pickTag(resp, "DbServer"),
    auth: pickTag(resp, "AuthServer"),
    raw: resp
  };
}

async function FECompUltimoAutorizado(ptoVta = PTO_VTA_DEFAULT, cbteTipo) {
  const a = await auth();
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${a.token}</ar:Token>
        <ar:Sign>${a.sign}</ar:Sign>
        <ar:Cuit>${a.cuit}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${ptoVta}</ar:PtoVta>
      <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;

  const resp = await postXml(
    WSFE_URL,
    soap,
    "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado"
  );

  const ult = Number(pickTag(resp, "CbteNro") || 0);
  return { ultimo: ult, raw: resp };
}
async function FECAESolicitar(det) {
  const a = await auth();

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Header/>
  <soap:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${a.token}</ar:Token>
        <ar:Sign>${a.sign}</ar:Sign>
        <ar:Cuit>${a.cuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${det.ptoVta}</ar:PtoVta>
          <ar:CbteTipo>${det.cbteTipo}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>${det.concepto}</ar:Concepto>
            <ar:DocTipo>${det.docTipo}</ar:DocTipo>
            <ar:DocNro>${det.docNro}</ar:DocNro>
            <ar:CbteDesde>${det.cbteNro}</ar:CbteDesde>
            <ar:CbteHasta>${det.cbteNro}</ar:CbteHasta>
            <ar:CbteFch>${det.cbteFch}</ar:CbteFch>
            <ar:ImpTotal>${det.impTotal}</ar:ImpTotal>
            <ar:ImpTotConc>${det.impTotConc || 0}</ar:ImpTotConc>
            <ar:ImpNeto>${det.impNeto}</ar:ImpNeto>
            <ar:ImpOpEx>${det.impOpEx || 0}</ar:ImpOpEx>
            <ar:ImpIVA>${det.impIVA}</ar:ImpIVA>
            <ar:ImpTrib>${det.impTrib || 0}</ar:ImpTrib>
            <ar:MonId>${det.monId || "PES"}</ar:MonId>
            <ar:MonCotiz>${det.monCotiz || 1}</ar:MonCotiz>

            ${det.ivaAlicuotas?.length ? `
            <ar:Iva>
              ${det.ivaAlicuotas.map(i => `
              <ar:AlicIva>
                <ar:Id>${i.id}</ar:Id>
                <ar:BaseImp>${i.baseImp}</ar:BaseImp>
                <ar:Importe>${i.importe}</ar:Importe>
              </ar:AlicIva>`).join("")}
            </ar:Iva>` : ""}

            ${det.receptorCondIvaId ? `<ar:CondicionIVAReceptorId>${det.receptorCondIvaId}</ar:CondicionIVAReceptorId>` : ""}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;

  // IMPORTANTE: soapRequest devuelve el XML aunque WSFE responda HTTP 500 (SOAP Fault):contentReference[oaicite:3]{index=3}
  const resp = await soapRequest("FECAESolicitar", xml, process.env.ARCA_WSFE_URL);

  // Parse único y consistente (incluye SOAP Fault -> SOAP_FAULT):contentReference[oaicite:4]{index=4}
  const parsed = parseWsfeCaeResponse(resp);

  const next =
    Number(pickTag(resp, "CbteDesde") || pickTag(resp, "CbteHasta") || 0) ||
    det.cbteNro;

  return {
    next,
    resultado: parsed.resultado,
    cae: parsed.cae,
    caeVto: parsed.caeVto,
    obsCode: parsed.obsCode,
    obsMsg: parsed.obsMsg,
    parsed,
    raw: resp,
  };
}

function pickFirstErr(xml) {
  const errors = pickTag(xml, "Errors");
  if (!errors) return null;
  const err = pickTag(errors, "Err");
  if (!err) return null;
  const code = pickTag(err, "Code");
  const msg = pickTag(err, "Msg");
  return (code || msg) ? { code: code || "", msg: msg || "" } : null;
}

function pickFirstObs(xml) {
  const obsCont = pickTag(xml, "Observaciones");
  if (!obsCont) return null;
  const obs = pickTag(obsCont, "Obs");
  if (!obs) return null;
  const code = pickTag(obs, "Code");
  const msg = pickTag(obs, "Msg");
  return (code || msg) ? { code: code || "", msg: msg || "" } : null;
}

function pickFirstEvt(xml) {
  const evCont = pickTag(xml, "Events");
  if (!evCont) return null;
  const evt = pickTag(evCont, "Evt");
  if (!evt) return null;
  const code = pickTag(evt, "Code");
  const msg = pickTag(evt, "Msg");
  return (code || msg) ? { code: code || "", msg: msg || "" } : null;
}

async function FECompConsultar(ptoVta = PTO_VTA_DEFAULT, cbteTipo, cbteNro) {
  const a = await auth();
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompConsultar>
      <ar:Auth>
        <ar:Token>${a.token}</ar:Token>
        <ar:Sign>${a.sign}</ar:Sign>
        <ar:Cuit>${a.cuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCompConsReq>
        <ar:PtoVta>${ptoVta}</ar:PtoVta>
        <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
        <ar:CbteNro>${cbteNro}</ar:CbteNro>
      </ar:FeCompConsReq>
    </ar:FECompConsultar>
  </soapenv:Body>
</soapenv:Envelope>`;

  const resp = await postXml(
    WSFE_URL,
    soap,
    "http://ar.gov.afip.dif.FEV1/FECompConsultar"
  );
  return { raw: resp };
}
async function FEParamGetCondicionIvaReceptor() {
  const a = await auth();

  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FEParamGetCondicionIvaReceptor>
      <ar:Auth>
        <ar:Token>${a.token}</ar:Token>
        <ar:Sign>${a.sign}</ar:Sign>
        <ar:Cuit>${a.cuit}</ar:Cuit>
      </ar:Auth>
    </ar:FEParamGetCondicionIvaReceptor>
  </soapenv:Body>
</soapenv:Envelope>`;

  const resp = await postXml(
    WSFE_URL,
    soap,
    "http://ar.gov.afip.dif.FEV1/FEParamGetCondicionIvaReceptor"
  );

  // Devolvemos el XML crudo; lo parseás en el controller con pickTag/regex.
  return { raw: resp };
}


module.exports = {
  WSFE_URL,
  yyyymmddARFromDate,
  FEDummy,
  FECompUltimoAutorizado,
  FECAESolicitar,
  FECompConsultar,
  FEParamGetCondicionIvaReceptor
};

