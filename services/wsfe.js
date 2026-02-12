// services/wsfe.js
require("dotenv").config();

const https = require("https");
const { getTokenSign } = require("./wsaa");

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

async function FECAESolicitar(det) {
  const a = await auth();
  const ptoVta = det.ptoVta ?? PTO_VTA_DEFAULT;

  const cbteFch = det.cbteFch || yyyymmddARFromDate(new Date());

  const f2 = (n) => Number(n || 0).toFixed(2);
  const f3 = (n) => {
    const x = Number(n || 0);
    return (Number.isFinite(x) ? x : 1).toFixed(3);
  };

  const impTotal   = f2(det.impTotal);
  const impTotConc = f2(det.impTotConc || 0);
  const impNeto    = f2(det.impNeto || 0);
  const impOpEx    = f2(det.impOpEx || 0);
  const impIVA     = f2(det.impIVA || 0);
  const impTrib    = f2(det.impTrib || 0);

  const monId    = det.monId || "PES";
  const monCotiz = f3(det.monCotiz || 1);

  // ---- CbtesAsoc (para NC/ND) ----
  let cbtesAsocXml = "";
  if (Array.isArray(det.cbtesAsoc) && det.cbtesAsoc.length) {
    const asocs = det.cbtesAsoc
      .map((x) => ({
        tipo: Number(x.tipo || 0),
        pto_vta: Number(x.pto_vta || 0),
        nro: Number(x.nro || 0),
        cuit: Number(x.cuit || a.cuit || 0),
        cbte_fch: String(x.cbte_fch || "").trim(),
      }))
      .filter((x) => x.tipo > 0 && x.pto_vta > 0 && x.nro > 0 && /^\d{8}$/.test(x.cbte_fch));

    if (asocs.length) {
      cbtesAsocXml =
        `<ar:CbtesAsoc>` +
        asocs
          .map(
            (x) => `
            <ar:CbteAsoc>
              <ar:Tipo>${x.tipo}</ar:Tipo>
              <ar:PtoVta>${x.pto_vta}</ar:PtoVta>
              <ar:Nro>${x.nro}</ar:Nro>
              <ar:Cuit>${x.cuit}</ar:Cuit>
              <ar:CbteFch>${x.cbte_fch}</ar:CbteFch>
            </ar:CbteAsoc>`
          )
          .join("") +
        `</ar:CbtesAsoc>`;
    }
  }

  // ---- IVA ----
  let ivaXml = "";
  if (!det.omitirIva) {
    if (Array.isArray(det.ivaAlicuotas) && det.ivaAlicuotas.length) {
      const alics = det.ivaAlicuotas
        .map((x) => ({
          id: Number(x.id || 0),
          baseImp: f2(x.baseImp),
          importe: f2(x.importe),
        }))
        .filter((x) => x.id > 0);

      if (alics.length) {
        ivaXml =
          `<ar:Iva>` +
          alics
            .map(
              (x) => `
              <ar:AlicIva>
                <ar:Id>${x.id}</ar:Id>
                <ar:BaseImp>${x.baseImp}</ar:BaseImp>
                <ar:Importe>${x.importe}</ar:Importe>
              </ar:AlicIva>`
            )
            .join("") +
          `</ar:Iva>`;
      }
    }

    // Fallback: si ImpIVA=0 pero hay neto, igual enviamos alícuota 0% (Id=3) para evitar 10018
    if (!ivaXml && Number(det.impNeto || 0) > 0) {
      ivaXml = `
        <ar:Iva>
          <ar:AlicIva>
            <ar:Id>3</ar:Id>
            <ar:BaseImp>${impNeto}</ar:BaseImp>
            <ar:Importe>0.00</ar:Importe>
          </ar:AlicIva>
        </ar:Iva>`;
    }
  }

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

            ${cbtesAsocXml}

            <ar:ImpTotal>${impTotal}</ar:ImpTotal>
            <ar:ImpTotConc>${impTotConc}</ar:ImpTotConc>
            <ar:ImpNeto>${impNeto}</ar:ImpNeto>
            <ar:ImpOpEx>${impOpEx}</ar:ImpOpEx>
            <ar:ImpIVA>${impIVA}</ar:ImpIVA>
            <ar:ImpTrib>${impTrib}</ar:ImpTrib>

            <ar:MonId>${monId}</ar:MonId>
            <ar:MonCotiz>${monCotiz}</ar:MonCotiz>

            ${ivaXml}

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

  if (process.env.ARCA_FORCE_WSFE_THROW_AFTER === "1") {
    throw new Error("ARCA_FORCE_WSFE_THROW_AFTER");
  }

  return {
    resultado: pickTag(resp, "Resultado"),
    cae: pickTag(resp, "CAE"),
    caeVto: pickTag(resp, "CAEFchVto"),
    obsCode: pickTag(resp, "Code"),
    obsMsg: pickTag(resp, "Msg"),
    raw: resp,
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

