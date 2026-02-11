// services/arca_calc.js

function round2(n) {
  const x = Number(n);
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

// Mapeo AFIP/ARCA WSFE (Id de alícuota IVA)
const ALIC_BY_ID = [
  { id: 3, porc: 0 },
  { id: 4, porc: 10.5 },
  { id: 5, porc: 21 },
  { id: 6, porc: 27 },
  { id: 8, porc: 5 },
  { id: 9, porc: 2.5 },
];

function normalizePorc(raw, defaultPorc = 21) {
  let x = Number(raw);
  if (!Number.isFinite(x)) return defaultPorc;

  // Si está como 0.21 => 21
  if (x > 0 && x <= 1) x = x * 100;

  // Si está como 2100 => 21
  if (x > 100) x = x / 100;

  x = round2(x);

  // tolerancias comunes
  if (Math.abs(x - 10.5) < 0.02) x = 10.5;
  if (Math.abs(x - 21) < 0.02) x = 21;
  if (Math.abs(x - 0) < 0.02) x = 0;

  return x;
}

function porcToWsfeId(porc) {
  const p = Number(porc);
  const hit = ALIC_BY_ID.find((a) => Math.abs(a.porc - p) < 0.02);
  return hit ? hit.id : null;
}

/**
 * rows: [{ producto_id, descripcion, cantidad, precio_unitario, subtotal, iva_porcentaje }]
 * clase: "A" | "B" | "C"
 */
function calcularDesdeFactura(rows, clase, opts = {}) {
  const defaultPorc = Number.isFinite(Number(opts.defaultPorc)) ? Number(opts.defaultPorc) : 21;

  const omitirIva = String(clase).toUpperCase() === "C";

  const itemsCalc = rows.map((r) => {
    const imp_total = round2(r.subtotal);

    if (omitirIva) {
      return {
        producto_id: r.producto_id,
        descripcion: r.descripcion,
        cantidad: round2(r.cantidad),
        precio_unitario: round2(r.precio_unitario),
        bonif: 0,
        iva_alicuota: 0,
        imp_neto: imp_total,
        imp_iva: 0,
        imp_total,
      };
    }

    const porc = normalizePorc(r.iva_porcentaje, defaultPorc);
    const wsfeId = porcToWsfeId(porc);
    if (!wsfeId) {
      const msg = `IVA del producto no soportado: ${r.iva_porcentaje} (normalizado=${porc}). producto_id=${r.producto_id}`;
      const err = new Error(msg);
      err.code = "IVA_UNSUPPORTED";
      throw err;
    }

    // asumimos precios con IVA incluido (como venías haciendo)
    const imp_neto = porc === 0 ? imp_total : round2(imp_total / (1 + porc / 100));
    const imp_iva = round2(imp_total - imp_neto);

    return {
      producto_id: r.producto_id,
      descripcion: r.descripcion,
      cantidad: round2(r.cantidad),
      precio_unitario: round2(r.precio_unitario),
      bonif: 0,
      iva_alicuota: round2(porc),
      iva_wsfe_id: wsfeId, // útil para request (no se guarda en DB, pero sirve para agrupar)
      imp_neto,
      imp_iva,
      imp_total,
    };
  });

  const imp_total = round2(itemsCalc.reduce((a, i) => a + i.imp_total, 0));
  const imp_neto = round2(itemsCalc.reduce((a, i) => a + i.imp_neto, 0));
  const imp_iva = round2(itemsCalc.reduce((a, i) => a + i.imp_iva, 0));

  // Totalización por alícuota (WSFE)
  let ivaAlicuotas = [];
  if (!omitirIva) {
    const map = new Map(); // wsfeId -> {baseImp, importe}
    for (const it of itemsCalc) {
      const id = it.iva_wsfe_id;
      if (!id) continue;
      const prev = map.get(id) || { id, baseImp: 0, importe: 0 };
      prev.baseImp = round2(prev.baseImp + Number(it.imp_neto || 0));
      prev.importe = round2(prev.importe + Number(it.imp_iva || 0));
      map.set(id, prev);
    }
    ivaAlicuotas = [...map.values()].sort((a, b) => a.id - b.id);
  }

  // Limpieza: sacar iva_wsfe_id del item antes de guardar en DB
  const itemsForDb = itemsCalc.map(({ iva_wsfe_id, ...rest }) => rest);

  return {
    omitirIva,
    itemsCalc: itemsForDb,
    totales: { imp_total, imp_neto, imp_iva, imp_exento: 0 },
    ivaAlicuotas,
  };
}

module.exports = { calcularDesdeFactura };
