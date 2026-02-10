// services/wsfe.js
require("dotenv").config();

const https = require("https");
const { getTokenSign } = require("./wsaa");

const ENV = (process.env.ARCA_ENV || "homo").toLowerCase();
const CUIT = String(process.env.ARCA_CUIT || "").trim();
const PTO_VTA_DEFAULT = Number(process.env.ARCA_PTO_VTA || 0);

const WSFE_URL =
  ENV === "prod"
    ? "https://servicios1.afip.gov.ar/wsfev1/service.asmx"
    : "https://wswhomo.afip.gov.ar/wsfev1/service.asmx";

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
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.write(xml);
    req.end();
  });
}

function pickTag(xml, tag) {
  const r = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m = xml.match(r);
  return m ? m[1].trim() : "";
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

/**
 * MVP: 1 registro, IVA 21% (Id=5)
 * det = {
 *  ptoVta, cbteTipo, docTipo, docNro, condicionIVAReceptorId,
 *  cbteFch, cbteDesde, cbteHasta,
 *  impTotal, impNeto, impIVA
 * }
 */
async function FECAESolicitar(det) {
  const a = await auth();
  const ptoVta = det.ptoVta ?? PTO_VTA_DEFAULT;

  const cbteFch = det.cbteFch || yyyymmddARFromDate(new Date());
  const ivaBase = Number(det.impNeto).toFixed(2);
  const ivaImp  = Number(det.impIVA).toFixed(2);

  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
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
          <ar:CbteTipo>${det.cbteTipo}</ar:CbteTipo>
        </ar:FeCabReq>

        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>1</ar:Concepto>
            <ar:DocTipo>${det.docTipo}</ar:DocTipo>
            <ar:DocNro>${det.docNro}</ar:DocNro>
            <ar:CondicionIVAReceptorId>${det.condicionIVAReceptorId}</ar:CondicionIVAReceptorId>

            <ar:CbteDesde>${det.cbteDesde}</ar:CbteDesde>
            <ar:CbteHasta>${det.cbteHasta}</ar:CbteHasta>
            <ar:CbteFch>${cbteFch}</ar:CbteFch>

            <ar:ImpTotal>${Number(det.impTotal).toFixed(2)}</ar:ImpTotal>
            <ar:ImpTotConc>0.00</ar:ImpTotConc>
            <ar:ImpNeto>${Number(det.impNeto).toFixed(2)}</ar:ImpNeto>
            <ar:ImpOpEx>0.00</ar:ImpOpEx>
            <ar:ImpIVA>${Number(det.impIVA).toFixed(2)}</ar:ImpIVA>
            <ar:ImpTrib>0.00</ar:ImpTrib>

            <ar:MonId>${det.monId || "PES"}</ar:MonId>
            <ar:MonCotiz>${det.monCotiz || "1.000"}</ar:MonCotiz>

            <ar:Iva>
              <ar:AlicIva>
                <ar:Id>5</ar:Id>
                <ar:BaseImp>${ivaBase}</ar:BaseImp>
                <ar:Importe>${ivaImp}</ar:Importe>
              </ar:AlicIva>
            </ar:Iva>

          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;

  const resp = await postXml(
    WSFE_URL,
    soap,
    "http://ar.gov.afip.dif.FEV1/FECAESolicitar"
  );

  return {
    resultado: pickTag(resp, "Resultado"),
    cae: pickTag(resp, "CAE"),
    caeVto: pickTag(resp, "CAEFchVto"),
    obsCode: pickTag(resp, "Code"),
    obsMsg: pickTag(resp, "Msg"),
    raw: resp
  };
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

module.exports = {
  WSFE_URL,
  yyyymmddARFromDate,
  FEDummy,
  FECompUltimoAutorizado,
  FECAESolicitar,
  FECompConsultar
};
