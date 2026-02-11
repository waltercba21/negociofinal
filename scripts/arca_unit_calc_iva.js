// scripts/arca_unit_calc_iva.js
const { calcularDesdeFactura } = require("../services/arca_calc");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(() => {
  console.log("=== UNIT CALC IVA ===");

  const rows = [
    { producto_id: 1, descripcion: "Item 21", cantidad: 1, precio_unitario: 121, subtotal: 121, iva_porcentaje: 21 },
    { producto_id: 2, descripcion: "Item 10.5", cantidad: 1, precio_unitario: 110.5, subtotal: 110.5, iva_porcentaje: 10.5 },
  ];

  const b = calcularDesdeFactura(rows, "B");
  console.log("B:", b);

  assert(b.omitirIva === false, "B no debería omitir IVA");
  assert(b.totales.imp_total === 231.5, "imp_total incorrecto");
  assert(b.totales.imp_neto === 200, "imp_neto incorrecto");
  assert(b.totales.imp_iva === 31.5, "imp_iva incorrecto");
  assert(b.ivaAlicuotas.length === 2, "Debería haber 2 alícuotas");

  const c = calcularDesdeFactura(rows, "C");
  console.log("C:", c);

  assert(c.omitirIva === true, "C debería omitir IVA");
  assert(c.totales.imp_total === 231.5, "C imp_total incorrecto");
  assert(c.totales.imp_neto === 231.5, "C imp_neto debe ser igual a total");
  assert(c.totales.imp_iva === 0, "C imp_iva debe ser 0");
  assert(c.ivaAlicuotas.length === 0, "C no debe enviar alícuotas");

  console.log("✅ UNIT OK");
})();
