/**
 * estadisticas.js
 * Dashboard ejecutivo — extrae proveedores y productos directamente
 * de los datos de presupuestos y facturas (APIs que sí existen).
 * APIs usadas:
 *   GET /administracion/api/objetivos-compras?periodo&tipo&desde&hasta
 *       → { ok, totales:{A,B,TOTAL}, series:{labels,A,B,TOTAL} }
 *   GET /administracion/api/objetivos-ventas?periodo&tipo&desde&hasta
 *       → { ok, totales:{A,B,TOTAL}, series:{labels,A,B,TOTAL} }
 *   GET /administracion/api/objetivos-gastos?periodo&categoria&desde&hasta
 *       → { ok, totales:{TOTAL,...cats}, series:{etiquetas,TOTAL} }
 *   GET /productos/api/presupuestos?fechaInicio&fechaFin
 *       → [ { id, nombre_cliente, fecha, total, items:[{nombre,cantidad,precio_unitario}] } ]
 *   GET /productos/api/facturas?fechaInicio&fechaFin
 *       → [ { id, nombre_cliente, fecha, total, items:[{nombre,cantidad,precio_unitario}] } ]
 */
'use strict';

/* ── CONSTANTES ── */
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const pad = n => String(n).padStart(2, '0');
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const PALETTE = ['#f5c842','#3b82f6','#34d399','#f87171','#a78bfa',
                 '#fb923c','#38bdf8','#4ade80','#e879f9','#facc15'];
const GASTO_META = {
  luz:             { ico:'fa-bolt',              col:'#facc15', bg:'rgba(250,204,21,.12)' },
  agua:            { ico:'fa-droplet',            col:'#38bdf8', bg:'rgba(56,189,248,.12)' },
  gas:             { ico:'fa-fire-flame-curved',  col:'#fb923c', bg:'rgba(251,146,60,.12)' },
  municipalidad:   { ico:'fa-building-columns',   col:'#a78bfa', bg:'rgba(167,139,250,.12)' },
  'rentas provincia':{ ico:'fa-landmark',          col:'#818cf8', bg:'rgba(129,140,248,.12)' },
  contador:        { ico:'fa-calculator',          col:'#34d399', bg:'rgba(52,211,153,.12)' },
  empleados:       { ico:'fa-users',               col:'#60a5fa', bg:'rgba(96,165,250,.12)' },
  alquiler:        { ico:'fa-house',               col:'#f87171', bg:'rgba(248,113,113,.12)' },
  internet:        { ico:'fa-wifi',                col:'#2dd4bf', bg:'rgba(45,212,191,.12)' },
  limpieza:        { ico:'fa-broom',               col:'#86efac', bg:'rgba(134,239,172,.12)' },
  seguro:          { ico:'fa-shield',              col:'#c4b5fd', bg:'rgba(196,181,253,.12)' },
  otros:           { ico:'fa-ellipsis',            col:'#94a3b8', bg:'rgba(148,163,184,.12)' }
};

const money = n =>
  Number(n || 0).toLocaleString('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 });
const pct = (n, d) => d === 0 ? '—' : (n / d * 100).toFixed(1) + '%';

/* ── RANGOS ── */
function weekRange(y, m, w) {
  const s = (w - 1) * 7 + 1;
  const e = Math.min(w * 7, lastDay(y, m));
  return {
    desde: `${y}-${pad(m)}-${pad(s)}`,
    hasta: `${y}-${pad(m)}-${pad(e)}`,
    label: `Semana ${w} — ${MESES[m-1]} ${y}`
  };
}
function monthRange(y, m) {
  return {
    desde: `${y}-${pad(m)}-01`,
    hasta: `${y}-${pad(m)}-${pad(lastDay(y, m))}`,
    label: `${MESES[m-1]} ${y}`
  };
}
function yearRange(y) {
  return { desde: `${y}-01-01`, hasta: `${y}-12-31`, label: `Año ${y}` };
}

/* ── SELECTORES ── */
(function initSels() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth() + 1;
  const years = Array.from({ length: 7 }, (_, i) => y - i);
  const fill = (id, opts) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts.map(([v,t]) => `<option value="${v}">${t}</option>`).join('');
  };
  const yOpts = years.map(yr => [yr, yr]);
  const mOpts = Array.from({ length: 12 }, (_, i) => [i+1, `${pad(i+1)} — ${MESES[i]}`]);
  fill('f-anSem', yOpts); fill('f-anMen', yOpts); fill('f-anAnu', yOpts);
  fill('f-mesSem', mOpts); fill('f-mesMen', mOpts);
  ['f-anSem','f-anMen','f-anAnu'].forEach(id => { const e = document.getElementById(id); if (e) e.value = y; });
  ['f-mesSem','f-mesMen'].forEach(id => { const e = document.getElementById(id); if (e) e.value = m; });
})();

/* ── PERIODO ACTIVO ── */
let periodo = 'mensual';
function showSubs(p) {
  document.getElementById('sub-semanal').style.display = p === 'semanal' ? 'flex' : 'none';
  document.getElementById('sub-mensual').style.display = p === 'mensual' ? 'flex' : 'none';
  document.getElementById('sub-anual').style.display   = p === 'anual'   ? 'flex' : 'none';
}
showSubs(periodo);
document.querySelectorAll('.period-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    periodo = btn.dataset.p;
    showSubs(periodo);
  });
});

function getRango() {
  if (periodo === 'semanal')
    return weekRange(+document.getElementById('f-anSem').value, +document.getElementById('f-mesSem').value, +document.getElementById('f-semanaMes').value);
  if (periodo === 'mensual')
    return monthRange(+document.getElementById('f-anMen').value, +document.getElementById('f-mesMen').value);
  return yearRange(+document.getElementById('f-anAnu').value);
}

/* ── LABEL FORMATTER ── */
function fmtLbl(lbl, p) {
  if (!lbl) return '-';
  if (p === 'anual' && /^\d{4}-\d{2}$/.test(lbl)) return MESES[parseInt(lbl.split('-')[1]) - 1]?.slice(0,3) ?? lbl;
  if (/^\d{4}-\d{2}-\d{2}/.test(lbl)) { const [y,m,d] = lbl.slice(0,10).split('-'); return `${d}/${m}`; }
  if (/^\d{4}-\d{2}$/.test(lbl)) return lbl.split('-')[1];
  return String(lbl);
}

/* ── CHARTS ── */
const _charts = {};
function killChart(k) { if (_charts[k]) { _charts[k].destroy(); delete _charts[k]; } }

const BASE_SCALES = {
  x: { ticks:{ color:'rgba(240,244,255,.4)', font:{ family:'Roboto Mono', size:10 } }, grid:{ color:'rgba(255,255,255,.05)' }, border:{ color:'rgba(255,255,255,.08)' } },
  y: { beginAtZero:true, ticks:{ color:'rgba(240,244,255,.4)', font:{ family:'Roboto Mono', size:10 }, callback: v => money(v) }, grid:{ color:'rgba(255,255,255,.05)' }, border:{ color:'rgba(255,255,255,.08)' } }
};

/* ── FETCH ── */
async function api(url) {
  const r = await fetch(url);
  const d = await r.json();
  if (!r.ok || (d.ok === false)) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

/* Fetch silencioso: no lanza, devuelve null si falla */
async function apiSilent(url) {
  try { return await api(url); } catch { return null; }
}

/* ══════════════════════════════════════════════════════
   RENDER: BALANCE + KPIs
══════════════════════════════════════════════════════ */
function renderBalance(vA, vB, comp, gast) {
  const ing  = vA + vB;
  const egr  = comp + gast;
  const bal  = ing - egr;
  const margen = ing > 0 ? (ing - comp) / ing * 100 : 0;

  const set = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };

  set('kVentaA', money(vA));
  set('kVentaB', money(vB));
  set('kCompra', money(comp));
  set('kGastos', money(gast));
  set('kMargen', margen.toFixed(1) + '%');

  set('balIng',  money(ing));
  set('balComp', money(comp));
  set('balGast', money(gast));
  set('balMarg', margen.toFixed(1) + '%');
  set('balVal',  money(bal));

  const balEl = document.getElementById('balVal');
  if (balEl) balEl.className = 'bal-val ' + (bal > 0 ? 'pos' : bal < 0 ? 'neg' : 'neu');

  const verd = document.getElementById('balVerdict');
  if (verd) {
    if (bal > 0) verd.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--green)"></i> El negocio <strong style="color:var(--green)">está generando ganancias</strong> en este período`;
    else if (bal < 0) verd.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i> Los egresos <strong style="color:var(--red)">superan a los ingresos</strong> en este período`;
    else verd.innerHTML = `<i class="fa-solid fa-minus" style="color:var(--gold)"></i> El negocio está en <strong style="color:var(--gold)">punto de equilibrio</strong>`;
  }

  const max = Math.max(ing, comp, gast, 1);
  const setBar = (id, v) => { const e = document.getElementById(id); if (e) e.style.width = Math.min(100, v / max * 100) + '%'; };
  setBar('bIng', ing); setBar('bComp', comp); setBar('bGast', gast); setBar('bMarg', Math.max(0, margen));

  /* INDICADORES */
  const rentNet = ing > 0 ? (bal / ing * 100).toFixed(1) + '%' : '—';
  const relCV   = ing > 0 ? (comp / ing * 100).toFixed(1) + '%' : '—';
  const gv      = ing > 0 ? (gast / ing * 100).toFixed(1) + '%' : '—';
  const pesoA   = ing > 0 ? (vA / ing * 100).toFixed(1) + '%' : '—';
  set('rRentab', rentNet); set('rCV', relCV); set('rGV', gv); set('rPesoA', pesoA);

  const rentEl = document.getElementById('rRentab');
  if (rentEl && bal !== 0) rentEl.style.color = bal > 0 ? 'var(--green)' : 'var(--red)';
}

/* ══════════════════════════════════════════════════════
   RENDER: EVOLUCIÓN
══════════════════════════════════════════════════════ */
let lastEvol = null;
function renderEvol(labels, ventas, compras, gastos, tipo = 'linea') {
  killChart('evol');
  const canvas = document.getElementById('cEvol');
  if (!canvas) return;
  const esL = tipo === 'linea';
  _charts.evol = new Chart(canvas.getContext('2d'), {
    type: esL ? 'line' : 'bar',
    data: {
      labels,
      datasets: [
        { label:'Ventas',  data:ventas,  borderColor:'#3b82f6', backgroundColor: esL ? 'rgba(59,130,246,.07)'  : 'rgba(59,130,246,.55)',  borderWidth: esL?2:0, fill:esL, tension:.35, pointRadius: esL?3:0, pointBackgroundColor:'#3b82f6' },
        { label:'Compras', data:compras, borderColor:'#f87171', backgroundColor: esL ? 'rgba(248,113,113,.07)' : 'rgba(248,113,113,.55)', borderWidth: esL?2:0, fill:esL, tension:.35, pointRadius: esL?3:0, pointBackgroundColor:'#f87171' },
        { label:'Gastos',  data:gastos,  borderColor:'#f5c842', backgroundColor: esL ? 'rgba(245,200,66,.07)'  : 'rgba(245,200,66,.45)',  borderWidth: esL?2:0, fill:esL, tension:.35, pointRadius: esL?3:0, pointBackgroundColor:'#f5c842' }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend: { display:true, position:'top', labels:{ color:'rgba(240,244,255,.55)', font:{ family:'Roboto', size:11 }, boxWidth:10, boxHeight:10, usePointStyle:true, padding:16 } },
        tooltip: { callbacks:{ label: c => `${c.dataset.label}: ${money(c.parsed.y)}` } }
      },
      scales: BASE_SCALES
    }
  });
}

/* ══════════════════════════════════════════════════════
   RENDER: DOUGHNUT GENÉRICO
══════════════════════════════════════════════════════ */
function renderDoughnut(canvasId, legendId, labels, values, colors) {
  killChart(canvasId);
  const canvas = document.getElementById(canvasId);
  const legEl  = document.getElementById(legendId);
  if (!canvas) return;
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) {
    if (legEl) legEl.innerHTML = '<div class="empty"><i class="fa-solid fa-chart-pie"></i><p>Sin datos</p></div>';
    return;
  }
  _charts[canvasId] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels, datasets:[{ data:values, backgroundColor:colors, borderWidth:0, hoverOffset:6 }] },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins: { legend:{ display:false }, tooltip:{ callbacks:{ label: c => `${c.label}: ${money(c.parsed)}` } } }
    }
  });
  if (legEl) {
    legEl.innerHTML = labels.map((l, i) => `
      <div class="leg-row"><div class="leg-dot" style="background:${colors[i]}"></div>
        <span class="leg-name">${l}</span>
        <span class="leg-pct">${pct(values[i], total)}</span>
      </div>
      <div class="leg-val">${money(values[i])}</div>
    `).join('');
  }
}

/* ══════════════════════════════════════════════════════
   RENDER: RANKING GENÉRICO
══════════════════════════════════════════════════════ */
function renderRanking(elId, items, colorFn, valFmt) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-inbox"></i><p>Sin datos para el período</p></div>';
    return;
  }
  const max = items[0].val || 1;
  el.innerHTML = items.slice(0, 8).map((item, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
    const color = colorFn(i);
    return `
      <div class="rk-row ${i === 0 ? 'top' : ''}">
        <span class="rk-pos">${medal}</span>
        <span class="rk-name" title="${item.name}">${item.name}</span>
        <div class="rk-bar-w"><div class="rk-bar-f" style="width:${(item.val / max * 100).toFixed(1)}%;background:${color}"></div></div>
        <span class="rk-val">${valFmt(item.val)}</span>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════
   RENDER: GASTOS LISTA
══════════════════════════════════════════════════════ */
function renderGastosLista(gastosCat) {
  const el = document.getElementById('gastosLista');
  if (!el) return;
  const cats = Object.entries(gastosCat).filter(([,v]) => v > 0).sort(([,a],[,b]) => b - a);
  const tot  = cats.reduce((s,[,v]) => s + v, 0);
  if (!cats.length) { el.innerHTML = '<div class="empty"><i class="fa-solid fa-receipt"></i><p>Sin gastos</p></div>'; return; }
  el.innerHTML = cats.map(([cat, val]) => {
    const m = GASTO_META[cat] || GASTO_META.otros;
    const w = tot > 0 ? (val / tot * 100).toFixed(1) : 0;
    return `<div class="gasto-row">
      <div class="gasto-ico" style="background:${m.bg};color:${m.col}"><i class="fa-solid ${m.ico}"></i></div>
      <span class="gasto-name">${cat}</span>
      <div class="gasto-bw"><div class="gasto-bf" style="width:${w}%;background:${m.col}"></div></div>
      <span class="gasto-val">${money(val)}</span>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════
   RENDER: DIAGNÓSTICO
══════════════════════════════════════════════════════ */
function renderDiag(vA, vB, comp, gast) {
  const el = document.getElementById('diagPanel');
  if (!el) return;
  const ing = vA + vB, bal = ing - comp - gast;
  const margen = ing > 0 ? (ing - comp) / ing * 100 : 0;
  const alerts = [];

  if (bal < 0)
    alerts.push({ t:'red', i:'fa-triangle-exclamation', msg:`<strong>Pérdida neta de ${money(Math.abs(bal))}</strong>. Los egresos superan a los ingresos. Revisá estructura de costos.` });
  else if (bal > 0)
    alerts.push({ t:'green', i:'fa-circle-check', msg:`<strong>Ganancia neta de ${money(bal)}</strong>. El negocio es rentable en este período.` });

  if (margen < 15 && ing > 0)
    alerts.push({ t:'red', i:'fa-arrow-trend-down', msg:`<strong>Margen bruto bajo (${margen.toFixed(1)}%)</strong>. El costo de mercadería consume demasiado de las ventas.` });
  else if (margen >= 30 && ing > 0)
    alerts.push({ t:'green', i:'fa-thumbs-up', msg:`<strong>Margen bruto saludable (${margen.toFixed(1)}%)</strong>. La diferencia entre compra y venta es adecuada.` });
  else if (ing > 0)
    alerts.push({ t:'gold', i:'fa-circle-info', msg:`<strong>Margen moderado (${margen.toFixed(1)}%)</strong>. Hay margen para mejorar ajustando precios de venta o de compra.` });

  if (ing > 0 && comp / ing > 0.8)
    alerts.push({ t:'red', i:'fa-boxes-stacked', msg:`<strong>Alto ratio Compra/Venta (${(comp/ing*100).toFixed(1)}%)</strong>. Estás comprando casi todo lo que vendés. Margen muy ajustado.` });

  if (ing > 0 && gast / ing > 0.3)
    alerts.push({ t:'gold', i:'fa-coins', msg:`<strong>Gastos operativos elevados (${(gast/ing*100).toFixed(1)}% de ventas)</strong>. Revisá sueldos, alquiler y servicios fijos.` });

  if (vA === 0 && vB > 0)
    alerts.push({ t:'gold', i:'fa-file-lines', msg:`<strong>Sin ventas facturadas (A)</strong>. Todas las ventas son por presupuesto B. Verificá emisión de facturas.` });

  if (!alerts.length)
    alerts.push({ t:'gold', i:'fa-circle-info', msg:'Datos insuficientes para un diagnóstico completo. Asegurate de tener ventas, compras y gastos cargados.' });

  const BG  = { red:'rgba(248,113,113,.07)', green:'rgba(52,211,153,.07)', gold:'rgba(245,200,66,.07)' };
  const CLR = { red:'var(--red)', green:'var(--green)', gold:'var(--gold)' };
  el.innerHTML = alerts.map(a =>
    `<div class="diag-item" style="background:${BG[a.t]};border:1px solid ${CLR[a.t]}33">
      <i class="fa-solid ${a.i}" style="color:${CLR[a.t]}"></i>
      <p>${a.msg}</p>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════════
   EXTRAE PROVEEDORES y PRODUCTOS de docs (presupuestos/facturas)
   Cada doc puede tener:
     - doc.proveedor / doc.proveedor_nombre  (en compras)
     - doc.items[].nombre, cantidad, precio_unitario  (en ventas)
══════════════════════════════════════════════════════ */
function extractProveedores(docs) {
  /* docs son las compras (presupuestos de proveedor)
     esperamos que cada doc tenga proveedor_nombre o proveedor */
  const map = {};
  (docs || []).forEach(doc => {
    const nombre = doc.proveedor_nombre || doc.proveedor || doc.nombre_proveedor || null;
    if (!nombre) return;
    const total = Number(doc.total || 0);
    map[nombre] = (map[nombre] || 0) + total;
  });
  return Object.entries(map)
    .map(([name, val]) => ({ name, val }))
    .sort((a, b) => b.val - a.val);
}

function extractProductos(docs) {
  /* docs son facturas o presupuestos de ventas.
     Cada doc.items[] tiene: nombre, cantidad, precio_unitario */
  const map = {};
  (docs || []).forEach(doc => {
    (doc.items || []).forEach(item => {
      const nombre = item.nombre || item.producto || item.descripcion || null;
      if (!nombre) return;
      const qty = Number(item.cantidad || 1);
      map[nombre] = (map[nombre] || 0) + qty;
    });
  });
  return Object.entries(map)
    .map(([name, val]) => ({ name, val }))
    .sort((a, b) => b.val - a.val);
}

/* ══════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════ */
async function cargar() {
  const loadEl   = document.getElementById('loadingEl');
  const errEl    = document.getElementById('errBox');
  const dash     = document.getElementById('dash');
  const inicial  = document.getElementById('estadoInicial');
  const rangoLbl = document.getElementById('rangoLbl');
  const rangoTxt = document.getElementById('rangoTxt');

  if (loadEl) loadEl.classList.add('on');
  if (errEl)  { errEl.classList.remove('on'); errEl.textContent = ''; }

  const { desde, hasta, label } = getRango();
  const p = periodo;

  try {
    /* ── PETICIONES PARALELAS ── */
    const qs = (extra = {}) => new URLSearchParams({ periodo:p, desde, hasta, ...extra }).toString();

    const [
      dVentaA, dVentaB, dVentaT,
      dCompraA, dCompraB,
      dGastos
    ] = await Promise.all([
      api(`/administracion/api/objetivos-ventas?${qs({ tipo:'A' })}`),
      api(`/administracion/api/objetivos-ventas?${qs({ tipo:'B' })}`),
      api(`/administracion/api/objetivos-ventas?${qs({ tipo:'TOTAL' })}`),
      api(`/administracion/api/objetivos-compras?${qs({ tipo:'A' })}`),
      api(`/administracion/api/objetivos-compras?${qs({ tipo:'B' })}`),
      api(`/administracion/api/objetivos-gastos?${qs({ categoria:'' })}`)
    ]);

    /* Intentar obtener docs de ventas y compras para proveedores y productos */
    const qsDocs = new URLSearchParams({ fechaInicio: desde, fechaFin: hasta }).toString();
    const [docsVentaFact, docsVentaPres, docsCompraFact, docsCompraPres] = await Promise.all([
      apiSilent(`/productos/api/facturas?${qsDocs}`),
      apiSilent(`/productos/api/presupuestos?${qsDocs}`),
      /* Facturas de compra: si hay endpoint específico, sino null */
      apiSilent(`/administracion/api/facturas-compra?${qsDocs}`),
      apiSilent(`/administracion/api/presupuestos-compra?${qsDocs}`)
    ]);

    /* ── TOTALES ── */
    const vA   = dVentaA.totales?.A  || dVentaA.totales?.TOTAL  || 0;
    const vB   = dVentaB.totales?.B  || dVentaB.totales?.TOTAL  || 0;
    const cA   = dCompraA.totales?.A || dCompraA.totales?.TOTAL || 0;
    const cB   = dCompraB.totales?.B || dCompraB.totales?.TOTAL || 0;
    const comp = cA + cB;
    const gast = dGastos.totales?.TOTAL || 0;

    /* ── SERIES EVOLUCIÓN ── */
    const evolLabels  = (dVentaT.series?.labels || dVentaT.series?.etiquetas || []).map(l => fmtLbl(l, p));
    const evolVentas  = dVentaT.series?.TOTAL || [];
    const evolCompras = (function() {
      // Sumamos serie A + serie B de compras (ambas con mismos labels)
      const sA = dCompraA.series?.TOTAL || dCompraA.series?.A || [];
      const sB = dCompraB.series?.TOTAL || dCompraB.series?.B || [];
      return sA.map((v, i) => (Number(v) || 0) + (Number(sB[i]) || 0));
    })();
    const evolGastos = dGastos.series?.TOTAL || [];

    /* ── GASTOS POR CATEGORÍA ── */
    const CATS = ['luz','agua','gas','municipalidad','rentas provincia','contador','empleados','alquiler','internet','limpieza','seguro','otros'];
    const gastosCat = {};
    CATS.forEach(cat => { gastosCat[cat] = Number(dGastos.totales?.[cat] || 0); });

    /* ── PROVEEDORES: intentar varias fuentes ── */
    let provs = [];
    const compDocs = [...(docsCompraFact || []), ...(docsCompraPres || [])];
    if (compDocs.length) {
      provs = extractProveedores(compDocs);
    } else {
      // Fallback: si los endpoints no existen intentamos con el endpoint de compras
      // que a veces devuelve top_proveedores en data extendida
      const ext = await apiSilent(`/administracion/api/objetivos-compras?${qs({ tipo:'TOTAL', detalle:'proveedores' })}`);
      if (ext?.proveedores?.length) {
        provs = ext.proveedores.map(x => ({ name: x.nombre || x.proveedor, val: Number(x.total || 0) })).sort((a,b) => b.val - a.val);
      }
    }

    /* ── PRODUCTOS MÁS VENDIDOS ── */
    let prods = [];
    const ventaDocs = [...(docsVentaFact || []), ...(docsVentaPres || [])];
    if (ventaDocs.length) {
      prods = extractProductos(ventaDocs);
    } else {
      // Fallback: endpoint masVendidos (no usa desde/hasta, es general)
      const mv = await apiSilent(`/productos/masVendidos?desde=${desde}&hasta=${hasta}`);
      // masVendidos devuelve un HTML (render), no JSON → skip silencioso
      // intentamos endpoint alternativo si existe
      const mvApi = await apiSilent(`/administracion/api/mas-vendidos?desde=${desde}&hasta=${hasta}`);
      if (mvApi?.productos?.length) {
        prods = mvApi.productos.map(x => ({ name: x.nombre, val: Number(x.total_vendido || 0) })).sort((a,b) => b.val - a.val);
      }
    }

    /* ── RENDER ── */
    renderBalance(vA, vB, comp, gast);

    renderEvol(evolLabels, evolVentas, evolCompras, evolGastos, 'linea');
    lastEvol = { labels: evolLabels, ventas: evolVentas, compras: evolCompras, gastos: evolGastos };

    renderDoughnut('cVentasPie', 'legVentas', ['Factura A', 'Presupuesto B'], [vA, vB], ['#3b82f6','#a78bfa']);
    renderDoughnut('cComprasPie', 'legCompras', ['Facturas A', 'Presupuestos B'], [cA, cB], ['#f87171','#fb923c']);

    const gCats = Object.keys(gastosCat).filter(k => gastosCat[k] > 0);
    renderDoughnut('cGastosPie', 'legGastos', gCats, gCats.map(k => gastosCat[k]), gCats.map((_,i) => PALETTE[i % PALETTE.length]));

    renderGastosLista(gastosCat);

    renderRanking('rkProv', provs, i => PALETTE[i % PALETTE.length], money);
    renderRanking('rkProd', prods.map(x => ({ ...x, val: x.val })), i => PALETTE[i % PALETTE.length], n => `${n} uds.`);

    renderDiag(vA, vB, comp, gast);

    /* mostrar dashboard */
    if (inicial) inicial.style.display = 'none';
    if (dash) dash.style.display = 'block';
    if (rangoLbl) rangoLbl.style.display = 'block';
    if (rangoTxt) rangoTxt.textContent = label;

  } catch (err) {
    console.error('[Estadísticas]', err);
    if (errEl) { errEl.textContent = `❌ Error al cargar datos: ${err.message}`; errEl.classList.add('on'); }
  } finally {
    if (loadEl) loadEl.classList.remove('on');
  }
}

/* ── TABS EVOLUCIÓN ── */
document.querySelectorAll('#evolTabs .tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#evolTabs .tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (lastEvol) renderEvol(lastEvol.labels, lastEvol.ventas, lastEvol.compras, lastEvol.gastos, btn.dataset.t);
  });
});

/* ── BOTÓN ── */
document.getElementById('btnActualizar')?.addEventListener('click', cargar);
