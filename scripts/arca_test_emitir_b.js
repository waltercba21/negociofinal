// scripts/arca_test_emitir_b.js
require("dotenv").config();

const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const { execFile } = require("child_process");

const ENV = process.env.ARCA_ENV || "homo";
const CUIT = String(process.env.ARCA_CUIT || "").trim();
const PTO_VTA = Number(process.env.ARCA_PTO_VTA || 0);

const CERT = process.env.ARCA_CERT_PATH;
const KEY = process.env.ARCA_KEY_PATH;

const TA_CACHE = path.join(__dirname, "ta_wsfe.json");
const TOKEN_PATH = process.env.ARCA_TOKEN_PATH || "";
const SIGN_PATH  = process.env.ARCA_SIGN_PATH  || "";

function tokenExpEpoch(tokenB64) {
  try {
    const xml = Buffer.from(tokenB64, "base64").toString("utf8");
    const m = xml.match(/exp_time="(\d+)"/);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}

function tokenIsValid(tokenB64, skewSec = 60) {
  const exp = tokenExpEpoch(tokenB64);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp - skewSec > now;
}

function loadTaFromCache(service) {
  if (!fs.existsSync(TA_CACHE)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(TA_CACHE, "utf8"));
    if (j.service !== service) return null;
    if (!j.token || !j.sign) return null;
    if (!tokenIsValid(j.token)) return null;
    return { token: j.token, sign: j.sign };
  } catch {
    return null;
  }
}

function saveTaToCache(service, token, sign) {
  fs.writeFileSync(
    TA_CACHE,
    JSON.stringify(
      { service, token, sign, exp: tokenExpEpoch(token), savedAt: new Date().toISOString() },
      null,
      2
    )
  );
}

function loadTaFromFiles() {
  if (!TOKEN_PATH || !SIGN_PATH) return null;
  if (!fs.existsSync(TOKEN_PATH) || !fs.existsSync(SIGN_PATH)) return null;
  const token = fs.readFileSync(TOKEN_PATH, "utf8").trim();
  const sign  = fs.readFileSync(SIGN_PATH, "utf8").trim();
  if (!token || !sign) return null;
  if (!tokenIsValid(token)) return null;
  return { token, sign };
}
function yyyymmddAR(d = new Date()) {
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

if (!CUIT || !PTO_VTA || !CERT || !KEY) {
  console.error("Faltan variables ARCA_* en .env");
  process.exit(1);
}
if (!fs.existsSync(CERT)) {
  console.error("No existe ARCA_CERT_PATH:", CERT);
  process.exit(1);
}
if (!fs.existsSync(KEY)) {
  console.error("No existe ARCA_KEY_PATH:", KEY);
  process.exit(1);
}

const WSAA_URL =
  ENV === "prod"
    ? "https://wsaa.afip.gov.ar/ws/services/LoginCms"
    : "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";

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

    // ASMX necesita SOAPAction válido (no vacío)
    if (soapAction) headers["SOAPAction"] = `"${soapAction}"`;

    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers,
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

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { ...opts }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

// ISO con -03:00 (Argentina)
function isoAR(d = new Date()) {
  const s = d
    .toLocaleString("sv-SE", { timeZone: "America/Argentina/Cordoba" }) // "YYYY-MM-DD HH:mm:ss"
    .replace(" ", "T");
  return `${s}-03:00`;
}

// Soporta tags normales y escapados (&lt;token&gt;)
function pickTag(xml, tag) {
  const r1 = new RegExp(
    `<(?:(?:\\w+):)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${tag}>`,
    "i"
  );
  const m1 = xml.match(r1);
  if (m1) return m1[1].trim();

  const r2 = new RegExp(
    `&lt;(?:(?:\\w+):)?${tag}[^&]*&gt;([\\s\\S]*?)&lt;\\/(?:(?:\\w+):)?${tag}&gt;`,
    "i"
  );
  const m2 = xml.match(r2);
  if (m2) return m2[1].trim();

  return "";
}
function pickEscaped(xml, tag) {
  const open = `&lt;${tag}&gt;`;
  const close = `&lt;/${tag}&gt;`;
  const i = xml.indexOf(open);
  if (i < 0) return "";
  const j = xml.indexOf(close, i + open.length);
  if (j < 0) return "";
  return xml.slice(i + open.length, j).trim();
}

async function getTokenSign(service = "wsfe") {
  const cached = loadTaFromCache(service) || loadTaFromFiles();
if (cached) return cached;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "arca-"));
  const traPath = path.join(tmp, "tra.xml");
  const cmsPath = path.join(tmp, "tra.cms");
  const b64Path = path.join(tmp, "tra.cms.b64");

  const gen = new Date(Date.now() - 5 * 60 * 1000);
  const exp = new Date(Date.now() + 10 * 60 * 1000);

  const tra = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${isoAR(gen)}</generationTime>
    <expirationTime>${isoAR(exp)}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`;

  fs.writeFileSync(traPath, tra);

  await run("openssl", [
    "smime",
    "-sign",
    "-signer",
    CERT,
    "-inkey",
    KEY,
    "-in",
    traPath,
    "-out",
    cmsPath,
    "-outform",
    "DER",
    "-nodetach",
  ]);

  await run("openssl", ["base64", "-in", cmsPath, "-out", b64Path, "-A"]);
  const cmsB64 = fs.readFileSync(b64Path, "utf8").trim();

  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:loginCms>
      <ws:in0>${cmsB64}</ws:in0>
    </ws:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const resp = await postXml(WSAA_URL, soap, "urn:LoginCms");
  fs.writeFileSync(path.join(__dirname, "wsaa_loginCms.response.xml"), resp);

  const token = pickTag(resp, "token") || pickEscaped(resp, "token");
const sign  = pickTag(resp, "sign")  || pickEscaped(resp, "sign");


  if (token && sign) {
  saveTaToCache(service, token, sign);
  return { token, sign };
}

// si WSAA responde alreadyAuthenticated, reutilizamos TA guardado
if (/alreadyAuthenticated/i.test(resp)) {
  const reuse = loadTaFromCache(service) || loadTaFromFiles();
  if (reuse) return reuse;
}

throw new Error("WSAA no devolvió token/sign");

}

async function emitirFacturaBMinima() {
  const { token, sign } = await getTokenSign("wsfe");

  // 1) Último comprobante autorizado (Factura B = 6)
  const ultimoReq = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${CUIT}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${PTO_VTA}</ar:PtoVta>
      <ar:CbteTipo>6</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;

  const ultimoResp = await postXml(
    WSFE_URL,
    ultimoReq,
    "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado"
  );
  fs.writeFileSync(path.join(__dirname, "wsfe_ultimo_from_node.xml"), ultimoResp);

  const ultStr = pickTag(ultimoResp, "CbteNro");
  if (ultStr === "") throw new Error("No pude leer CbteNro (ver wsfe_ultimo_from_node.xml)");
  const next = Number(ultStr || 0) + 1;

  const fch = yyyymmddAR();


  // 2) Solicitar CAE (Factura B mínima). CondicionIVAReceptorId=5 (Consumidor Final)
  const caeReq = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${CUIT}</ar:Cuit>
      </ar:Auth>

      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${PTO_VTA}</ar:PtoVta>
          <ar:CbteTipo>6</ar:CbteTipo>
        </ar:FeCabReq>

        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>1</ar:Concepto>
            <ar:DocTipo>99</ar:DocTipo>
            <ar:DocNro>0</ar:DocNro>
            <ar:CondicionIVAReceptorId>5</ar:CondicionIVAReceptorId>

            <ar:CbteDesde>${next}</ar:CbteDesde>
            <ar:CbteHasta>${next}</ar:CbteHasta>
            <ar:CbteFch>${fch}</ar:CbteFch>

            <ar:ImpTotal>121.00</ar:ImpTotal>
            <ar:ImpTotConc>0.00</ar:ImpTotConc>
            <ar:ImpNeto>100.00</ar:ImpNeto>
            <ar:ImpOpEx>0.00</ar:ImpOpEx>
            <ar:ImpIVA>21.00</ar:ImpIVA>
            <ar:ImpTrib>0.00</ar:ImpTrib>

            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1.000</ar:MonCotiz>

            <ar:Iva>
              <ar:AlicIva>
                <ar:Id>5</ar:Id>
                <ar:BaseImp>100.00</ar:BaseImp>
                <ar:Importe>21.00</ar:Importe>
              </ar:AlicIva>
            </ar:Iva>
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;

  const caeResp = await postXml(
    WSFE_URL,
    caeReq,
    "http://ar.gov.afip.dif.FEV1/FECAESolicitar"
  );
  fs.writeFileSync(path.join(__dirname, "wsfe_cae_from_node.xml"), caeResp);

  const resultado = pickTag(caeResp, "Resultado");
  const cae = pickTag(caeResp, "CAE");
  const caeVto = pickTag(caeResp, "CAEFchVto");
  const obsCode = pickTag(caeResp, "Code");
  const obsMsg = pickTag(caeResp, "Msg");

  return { next, resultado, cae, caeVto, obsCode, obsMsg };
}

(async () => {
  try {
    const r = await emitirFacturaBMinima();
    console.log(r);
  } catch (e) {
    console.error(e.stack || e.message || e);
    process.exit(1);
  }
})();
