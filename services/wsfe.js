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
function postXml(url, xml, soapAction, opts = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      const err = new Error(`WSFE invalid url: ${url}`);
      err.code = "WSFE_INVALID_URL";
      return reject(err);
    }

    const lib = u.protocol === "https:" ? https : http;
    const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 20000;

    const headers = {
      "Content-Type": "text/xml; charset=utf-8",
      "Content-Length": Buffer.byteLength(xml),
      "User-Agent": "autofaros-wsfe/1.0",
    };

    if (soapAction) headers["SOAPAction"] = `"${soapAction}"`;

    const req = lib.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            const err = new Error(`WSFE HTTP ${res.statusCode}`);
            err.code = "WSFE_HTTP";
            err.statusCode = res.statusCode;
            err.body = data;
            return reject(err);
          }
          resolve(data);
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error(`WSFE timeout after ${timeoutMs}ms`)));
    req.on("error", reject);
    req.write(xml);
    req.end();
  });
}


function normalizeSoapAction(soapAction) {
  if (!soapAction) return null;
  const s = String(soapAction).trim();
  if (!s) return null;

  // Si ya viene como URL, lo dejamos
  if (/^https?:\/\//i.test(s)) return s;

  // WSFE usa este namespace para SOAPAction
  return `http://ar.gov.afip.dif.FEV1/${s}`;
}
function soapRequest(action, xml, url) {
  const ns = "http://ar.gov.afip.dif.FEV1/";
  const soapAction = String(action || "").startsWith("http") ? action : (ns + action);
  return postXml(url, xml, soapAction, { timeoutMs: 25000 });
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
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${det.token}</Token>
        <Sign>${det.sign}</Sign>
        <Cuit>${det.cuit}</Cuit>
      </Auth>
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>${det.ptoVta}</PtoVta>
          <CbteTipo>${det.cbteTipo}</CbteTipo>
        </FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>${det.concepto}</Concepto>
            <DocTipo>${det.docTipo}</DocTipo>
            <DocNro>${det.docNro}</DocNro>
            <CbteDesde>${det.cbteNro}</CbteDesde>
            <CbteHasta>${det.cbteNro}</CbteHasta>
            <CbteFch>${det.cbteFch}</CbteFch>
            <ImpTotal>${det.impTotal}</ImpTotal>
            <ImpTotConc>${det.impTotConc || 0}</ImpTotConc>
            <ImpNeto>${det.impNeto}</ImpNeto>
            <ImpOpEx>${det.impOpEx || 0}</ImpOpEx>
            <ImpIVA>${det.impIva}</ImpIVA>
            <ImpTrib>${det.impTrib || 0}</ImpTrib>
            <MonId>${det.monId || "PES"}</MonId>
            <MonCotiz>${det.monCotiz || 1}</MonCotiz>

            ${(det.condicionIVAReceptorId != null && det.condicionIVAReceptorId !== "")
              ? `<CondicionIVAReceptorId>${det.condicionIVAReceptorId}</CondicionIVAReceptorId>`
              : ""}

            ${(det.cbtesAsoc && det.cbtesAsoc.length)
              ? `<CbtesAsoc>${det.cbtesAsoc
                  .map(
                    (a) => `
                <CbteAsoc>
                  <Tipo>${a.tipo}</Tipo>
                  <PtoVta>${a.ptoVta}</PtoVta>
                  <Nro>${a.nro}</Nro>
                  ${a.cuit ? `<Cuit>${a.cuit}</Cuit>` : ""}
                  ${a.cbteFch ? `<CbteFch>${a.cbteFch}</CbteFch>` : ""}
                </CbteAsoc>`
                  )
                  .join("")}
              </CbtesAsoc>`
              : ""}

            ${(det.ivaAlicuotas && det.ivaAlicuotas.length)
              ? `<Iva>${det.ivaAlicuotas
                  .map(
                    (i) => `
                <AlicIva>
                  <Id>${i.id}</Id>
                  <BaseImp>${i.baseImp}</BaseImp>
                  <Importe>${i.importe}</Importe>
                </AlicIva>`
                  )
                  .join("")}
              </Iva>`
              : ""}

            ${(det.tributos && det.tributos.length)
              ? `<Tributos>${det.tributos
                  .map(
                    (t) => `
                <Tributo>
                  <Id>${t.id}</Id>
                  <Desc>${t.desc}</Desc>
                  <BaseImp>${t.baseImp}</BaseImp>
                  <Alic>${t.alic}</Alic>
                  <Importe>${t.importe}</Importe>
                </Tributo>`
                  )
                  .join("")}
              </Tributos>`
              : ""}
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;

  const resp = await soapRequest("FECAESolicitar", xml, process.env.ARCA_WSFE_URL);
  const resultado = pickTag(resp, "Resultado") || "";
  const err = pickFirstErr(resp);
  const obs = pickFirstObs(resp);
  const evt = pickFirstEvt(resp);

  let obsCode = "";
  let obsMsg = "";

  if (resultado === "R" && err?.code) {
    obsCode = err.code;
    obsMsg = err.msg || "";
  } else if (obs?.code) {
    obsCode = obs.code;
    obsMsg = obs.msg || "";
  } else if (evt?.code) {
    obsCode = evt.code;
    obsMsg = evt.msg || "";
  }

  const next = Number(pickTag(resp, "CbteDesde") || pickTag(resp, "CbteHasta") || 0) || det.cbteNro;
  const parsed = parseWsfeCaeResponse(resp);
  return {
    next,
    resultado,
    cae: pickTag(resp, "CAE") || "",
    caeVto: pickTag(resp, "CAEFchVto") || "",
    obsCode,
    obsMsg,
    parsed, 
    raw: resp,
    // útil para debug sin romper tu DB:
    _errCode: err?.code || "",
    _errMsg: err?.msg || "",
    _evtCode: evt?.code || "",
    _evtMsg: evt?.msg || "",
  };
}

// Helpers (pegarlos cerca de pickTag)
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

