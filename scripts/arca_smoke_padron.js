// scripts/arca_smoke_padron.js
require("dotenv").config();

const padron = require("../services/padron");

(async () => {
  console.log("=== ARCA SMOKE PADRON ===");
  console.log({
    env: process.env.ARCA_ENV,
    padronUrl: process.env.ARCA_PADRON_URL,
    padronService: process.env.ARCA_PADRON_SERVICE,
    cuitEmisor: process.env.ARCA_CUIT,
  });

  const d = await padron.dummy();
  console.log("dummy:", d);

  const idPersona = Number(process.argv[2] || process.env.ARCA_CUIT || 0);
  const cuitRepresentada = Number(process.env.ARCA_CUIT || 0);

  const r = await padron.getPersonaV2({
    idPersona,
    cuitRepresentada,
    debug: true,
  });

console.log("getPersonaV2:", {
  ok: r.ok,
  notFound: !!r.notFound,
  upstreamStatus: r.upstreamStatus ?? null,
  service: r.service,
  status: r.status,
  error: r.error || null,
  data: r.data || null,
});

})();
