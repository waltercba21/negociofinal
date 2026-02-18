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
function redactAuth(xml) {
  return String(xml || "")
    .replace(/<(\w+:)?Token>[\s\S]*?<\/(\w+:)?Token>/gi, "<$1Token>REDACTED</$1Token>")
    .replace(/<(\w+:)?Sign>[\s\S]*?<\/(\w+:)?Sign>/gi, "<$1Sign>REDACTED</$1Sign>");
}
async function soapRequestDetailed(action, xml, url) {
  const soapAction = normalizeSoapAction(action);
  const reqRedacted = redactAuth(xml);

  try {
    const meta = await postXml(url, xml, soapAction, {
      returnMeta: true,
      allowHttpErrors: true,
    });

    return {
      action,
      url,
      soapAction,
      statusCode: meta.statusCode,
      headers: meta.headers,
      body: meta.body,
      requestXmlRedacted: reqRedacted,
    };
  } catch (err) {
    // timeouts / network: adjuntamos request + SOAPAction para persistir igual
    err.soapAction = soapAction;
    err.url = url;
    err.requestXmlRedacted = reqRedacted;
    throw err;
  }
}

async function postXml(url, xml, soapAction, opts = {}) {
  const { returnMeta = false, allowHttpErrors = false, timeoutMs = 25000 } = opts;

  const u = new URL(url);
  const lib = u.protocol === "https:" ? require("https") : require("http");

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + (u.search || ""),
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(xml, "utf8"),
          SOAPAction: soapAction,
        },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          const meta = {
            statusCode: res.statusCode || 0,
            headers: res.headers || {},
            body: body || "", // nunca null acá
          };

          const isOk = meta.statusCode >= 200 && meta.statusCode < 300;
          if (!isOk && !allowHttpErrors) {
            const err = new Error(`WSFE HTTP ${meta.statusCode}`);
            err.code = "WSFE_HTTP";
            err.statusCode = meta.statusCode;
            err.headers = meta.headers;
            err.body = meta.body; // clave: body siempre adjunto
            return reject(err);
          }

          return resolve(returnMeta ? meta : meta.body);
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      const err = new Error(`WSFE TIMEOUT ${timeoutMs}ms`);
      err.code = "WSFE_TIMEOUT";
      return req.destroy(err);
    });

    req.on("error", (err) => reject(err));

    req.write(xml, "utf8");
    req.end();
  });
}


function normalizeSoapAction(soapAction) {
  if (!soapAction) return "";
  if (/^https?:\/\//i.test(soapAction)) return soapAction;
  return `http://ar.gov.afip.dif.FEV1/${soapAction}`;
}
async function soapRequest(action, xml, url) {
  const r = await soapRequestDetailed(action, xml, url);

  if ((r.statusCode || 0) >= 400) {
    const err = new Error(`WSFE HTTP ${r.statusCode}`);
    err.code = "WSFE_HTTP";
    err.statusCode = r.statusCode;
    err.headers = r.headers;
    err.body = r.body; // puede ser "" pero NO lo vamos a perder en controller
    err.soapAction = r.soapAction;
    err.url = r.url;
    err.requestXmlRedacted = r.requestXmlRedacted;
    throw err;
  }
  return r.body;
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

  const ptoVta = Number(det.ptoVta ?? det.pto_vta ?? PTO_VTA_DEFAULT);
  const cbteTipo = Number(det.cbteTipo ?? det.cbte_tipo);

  const concepto = Number(det.concepto ?? 1);
  const docTipo = Number(det.docTipo ?? det.doc_tipo);
  const docNro = String(det.docNro ?? det.doc_nro ?? "").trim();

  const receptorCondIvaId =
    det.receptorCondIvaId ??
    det.condicionIVAReceptorId ??
    det.receptor_cond_iva_id ??
    null;

  const cbteNro = Number(
    det.cbteNro ?? det.cbte_nro ?? det.cbteDesde ?? det.cbteHasta ?? det.cbteNro
  );

  const cbteFch = String(det.cbteFch ?? det.cbte_fch ?? "").trim();

  const impTotal = det.impTotal;
  const impTotConc = det.impTotConc ?? 0;
  const impNeto = det.impNeto;
  const impOpEx = det.impOpEx ?? 0;
  const impIVA = det.impIVA;
  const impTrib = det.impTrib ?? 0;

  const monId = det.monId || "PES";
  const monCotiz = det.monCotiz ?? 1;

  const ivaAlicuotas = det.ivaAlicuotas || [];
  const omitirIva = !!det.omitirIva;

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
          <ar:PtoVta>${ptoVta}</ar:PtoVta>
          <ar:CbteTipo>${cbteTipo}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>${concepto}</ar:Concepto>
            <ar:DocTipo>${docTipo}</ar:DocTipo>
            <ar:DocNro>${docNro}</ar:DocNro>
            <ar:CbteDesde>${cbteNro}</ar:CbteDesde>
            <ar:CbteHasta>${cbteNro}</ar:CbteHasta>
            <ar:CbteFch>${cbteFch}</ar:CbteFch>
            <ar:ImpTotal>${impTotal}</ar:ImpTotal>
            <ar:ImpTotConc>${impTotConc}</ar:ImpTotConc>
            <ar:ImpNeto>${impNeto}</ar:ImpNeto>
            <ar:ImpOpEx>${impOpEx}</ar:ImpOpEx>
            <ar:ImpIVA>${impIVA}</ar:ImpIVA>
            <ar:ImpTrib>${impTrib}</ar:ImpTrib>
            <ar:MonId>${monId}</ar:MonId>
            <ar:MonCotiz>${monCotiz}</ar:MonCotiz>

            ${(!omitirIva && ivaAlicuotas.length) ? `
            <ar:Iva>
              ${ivaAlicuotas.map(i => `
              <ar:AlicIva>
                <ar:Id>${i.id}</ar:Id>
                <ar:BaseImp>${i.baseImp}</ar:BaseImp>
                <ar:Importe>${i.importe}</ar:Importe>
              </ar:AlicIva>`).join("")}
            </ar:Iva>` : ""}

            ${receptorCondIvaId ? `<ar:CondicionIVAReceptorId>${receptorCondIvaId}</ar:CondicionIVAReceptorId>` : ""}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;

  const ex = await soapRequestDetailed("FECAESolicitar", xml, WSFE_URL);

  let resp = ex.body || "";
  if (!resp) resp = `<!-- WSFE EMPTY BODY status=${ex.statusCode} soapAction=${ex.soapAction} -->`;

  const parsed = parseWsfeCaeResponse(resp);

  return {
    cbteNro: Number.isFinite(cbteNro) ? cbteNro : null,
    resultado: parsed.resultado,
    cae: parsed.cae,
    caeVto: parsed.caeVto,
    obsCode: parsed.obsCode,
    obsMsg: parsed.obsMsg,
    raw: resp,
    meta: {
      statusCode: ex.statusCode,
      soapAction: ex.soapAction,
      url: ex.url,
      requestXml: ex.requestXmlRedacted,
    },
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

