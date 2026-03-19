/**
 * estadisticas.js
 * Dashboard ejecutivo de estadísticas — lógica completa
 * Conecta con las APIs existentes de compras, ventas y gastos
 * y arma gráficos + KPIs + balance + diagnóstico.
 */

'use strict';

/* ══════════════════════════════════════
   HELPERS GLOBALES
══════════════════════════════════════ */
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const pad = n => String(n).padStart(2, '0');
const lastDayOfMonth = (y, m) => new Date(y, m, 0).getDate();

const money = n =>
  Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const pct = (num, den) =>
  den === 0 ? '—' : (num / den * 100).toFixed(1) + '%';

const animateNumber = (el, target, formatter = money) => {
  if (!el) return;
  const start = 0;
  const duration = 700;
  const startTime = performance.now();
  const update = now => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatter(Math.round(target * ease));
    if (progress < 1) requestAnimationFrame(update);
    else { el.textContent = formatter(target); el.classList.add('counting'); setTimeout(() => el.classList.remove('counting'), 300); }
  };
  requestAnimationFrame(update);
};

/* ══════════════════════════════════════
   RANGOS DE FECHA
══════════════════════════════════════ */
function weekRange(year, month, week) {
  const startDay = (week - 1) * 7 + 1;
  const endDay   = Math.min(week * 7, lastDayOfMonth(year, month));
  const desde = `${year}-${pad(month)}-${pad(startDay)}`;
  const hasta = `${year}-${pad(month)}-${pad(endDay)}`;
  const label = `Semana ${week} del ${pad(month)}/${year} (${pad(startDay)}/${pad(month)} → ${pad(endDay)}/${pad(month)})`;
  return { desde, hasta, label };
}

function monthRange(year, month) {
  const desde = `${year}-${pad(month)}-01`;
  const hasta = `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`;
  const label = `${MESES[month - 1]} ${year}`;
  return { desde, hasta, label };
}

function yearRange(year) {
  return { desde: `${year}-01-01`, hasta: `${year}-12-31`, label: `Año ${year}` };
}

/* ══════════════════════════════════════
   LLENADO SELECTORES
══════════════════════════════════════ */
(function initSelectors() {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth() + 1;

  const years = [];
  for (let i = y; i >= y - 6; i--) years.push(i);

  const fill = (id, options) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = options.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  };

  const yearOpts  = years.map(yr => [yr, yr]);
  const monthOpts = Array.from({ length: 12 }, (_, i) => [i + 1, `${pad(i + 1)} — ${MESES[i]}`]);

  fill('f-anSem', yearOpts);  fill('f-anMen', yearOpts);  fill('f-anAnu', yearOpts);
  fill('f-mesSem', monthOpts); fill('f-mesMen', monthOpts);

  ['f-anSem','f-anMen','f-anAnu'].forEach(id => { const el = document.getElementById(id); if (el) el.value = y; });
  ['f-mesSem','f-mesMen'].forEach(id => { const el = document.getElementById(id); if (el) el.value = m; });
})();

/* ══════════════════════════════════════
   LÓGICA DE PERÍODO
══════════════════════════════════════ */
let periodoActivo = 'mensual';

const subSemanal = document.getElementById('sub-semanal');
const subMensual = document.getElementById('sub-mensual');
const subAnual   = document.getElementById('sub-anual');

function showSubs(p) {
  subSemanal.style.display = p === 'semanal' ? 'flex' : 'none';
  subMensual.style.display = p === 'mensual' ? 'flex' : 'none';
  subAnual.style.display   = p === 'anual'   ? 'flex' : 'none';
}
showSubs(periodoActivo);

document.querySelectorAll('.est-period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.est-period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    periodoActivo = btn.dataset.periodo;
    showSubs(periodoActivo);
  });
});

function getRango() {
  const p = periodoActivo;
  if (p === 'semanal') {
    return weekRange(
      parseInt(document.getElementById('f-anSem').value, 10),
      parseInt(document.getElementById('f-mesSem').value, 10),
      parseInt(document.getElementById('f-semanaMes').value, 10)
    );
  }
  if (p === 'mensual') {
    return monthRange(
      parseInt(document.getElementById('f-anMen').value, 10),
      parseInt(document.getElementById('f-mesMen').value, 10)
    );
  }
  return yearRange(parseInt(document.getElementById('f-anAnu').value, 10));
}

/* ══════════════════════════════════════
   CHART INSTANCES
══════════════════════════════════════ */
const charts = {};

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: 'rgba(240,244,255,0.45)', font: { family: 'DM Mono', size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { color: 'rgba(255,255,255,0.1)' } },
    y: { beginAtZero: true, ticks: { color: 'rgba(240,244,255,0.45)', font: { family: 'DM Mono', size: 10 }, callback: v => money(v) }, grid: { color: 'rgba(255,255,255,0.05)' }, border: { color: 'rgba(255,255,255,0.1)' } }
  }
};

/* ══════════════════════════════════════
   FORMATO ETIQUETAS
══════════════════════════════════════ */
function fmtLabel(lbl, periodo) {
  if (!lbl) return '-';
  if (periodo === 'anual' && /^\d{4}-\d{2}$/.test(lbl)) {
    const [, m] = lbl.split('-');
    return MESES[parseInt(m, 10) - 1]?.slice(0, 3) ?? lbl;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(lbl)) {
    const [y, m, d] = lbl.slice(0, 10).split('-');
    return `${d}/${m}`;
  }
  if (/^\d{4}-\d{2}$/.test(lbl)) {
    const [, m] = lbl.split('-'); return `${m}`;
  }
  return String(lbl);
}

/* ══════════════════════════════════════
   COLORES
══════════════════════════════════════ */
const PALETTE = [
  '#f5c842','#3b82f6','#34d399','#f87171','#a78bfa',
  '#fb923c','#38bdf8','#4ade80','#e879f9','#facc15'
];

const GASTOS_ICONS = {
  luz: { icon: 'fa-bolt', color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  agua: { icon: 'fa-droplet', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  gas: { icon: 'fa-fire-flame-curved', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  municipalidad: { icon: 'fa-building-columns', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  'rentas provincia': { icon: 'fa-landmark', color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  contador: { icon: 'fa-calculator', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  empleados: { icon: 'fa-users', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  alquiler: { icon: 'fa-house', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  internet: { icon: 'fa-wifi', color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)' },
  limpieza: { icon: 'fa-broom', color: '#86efac', bg: 'rgba(134,239,172,0.12)' },
  seguro: { icon: 'fa-shield', color: '#c4b5fd', bg: 'rgba(196,181,253,0.12)' },
  otros: { icon: 'fa-ellipsis', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
};

/* ══════════════════════════════════════
   FETCH API HELPERS
══════════════════════════════════════ */
async function fetchAPI(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `Error en ${url}`);
  return data;
}

/* ══════════════════════════════════════
   RENDER FUNCTIONS
══════════════════════════════════════ */

// ── KPIs + Balance
function renderBalance(ventaA, ventaB, compra, gastos) {
  const ingresos = ventaA + ventaB;
  const egresos  = compra + gastos;
  const balance  = ingresos - egresos;
  const margen   = ingresos > 0 ? (ingresos - compra) / ingresos * 100 : 0;

  // KPI valores
  animateNumber(document.getElementById('kpiVentaA'), ventaA);
  animateNumber(document.getElementById('kpiVentaB'), ventaB);
  animateNumber(document.getElementById('kpiCompra'), compra);
  animateNumber(document.getElementById('kpiGastos'), gastos);

  const kpiMargenEl = document.getElementById('kpiMargen');
  if (kpiMargenEl) kpiMargenEl.textContent = margen.toFixed(1) + '%';

  // Balance card
  animateNumber(document.getElementById('balIngreso'), ingresos);
  animateNumber(document.getElementById('balCompra'), compra);
  animateNumber(document.getElementById('balGastos'), gastos);
  const balMargenEl = document.getElementById('balMargen');
  if (balMargenEl) balMargenEl.textContent = margen.toFixed(1) + '%';

  const balValEl = document.getElementById('balanceValue');
  if (balValEl) {
    animateNumber(balValEl, balance);
    balValEl.className = 'est-balance__value ' + (balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral');
  }

  const verdictEl = document.getElementById('balanceVerdict');
  if (verdictEl) {
    if (balance > 0)
      verdictEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--green)"></i> El negocio está <strong style="color:var(--green)">generando ganancias</strong> en este período`;
    else if (balance < 0)
      verdictEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i> Los egresos <strong style="color:var(--red)">superan a los ingresos</strong> en este período`;
    else
      verdictEl.innerHTML = `<i class="fa-solid fa-minus" style="color:var(--gold)"></i> El negocio está en <strong style="color:var(--gold)">punto de equilibrio</strong>`;
  }

  // Barras de balance
  const maxVal = Math.max(ingresos, compra, gastos, 1);
  const setBar = (id, val) => { const el = document.getElementById(id); if (el) el.style.width = Math.min(100, val / maxVal * 100) + '%'; };
  setBar('barIngreso', ingresos);
  setBar('barCompra', compra);
  setBar('barGastos', gastos);
  setBar('barMargen', Math.max(0, margen));

  // Ratios
  const setRatio = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const rentNet = ingresos > 0 ? (balance / ingresos * 100).toFixed(1) + '%' : '—';
  const relCV   = ventaA + ventaB > 0 ? (compra / (ventaA + ventaB) * 100).toFixed(1) + '%' : '—';
  const gv      = ingresos > 0 ? (gastos / ingresos * 100).toFixed(1) + '%' : '—';
  const pesoA   = ingresos > 0 ? (ventaA / ingresos * 100).toFixed(1) + '%' : '—';

  setRatio('ratioRentabilidad', rentNet);
  setRatio('ratioCobro', relCV);
  setRatio('ratioGastoVenta', gv);
  setRatio('ratioPesoA', pesoA);

  // Color condicional en rentabilidad
  const rentEl = document.getElementById('ratioRentabilidad');
  if (rentEl && balance !== 0)
    rentEl.style.color = balance > 0 ? 'var(--green)' : 'var(--red)';
}

// ── Gráfico de evolución temporal (línea / barra)
function renderEvolucion(labelsSerie, serieVentas, serieCompras, serieGastos, tipo = 'linea') {
  destroyChart('evol');
  const canvas = document.getElementById('chartEvolucion');
  if (!canvas) return;

  const esLinea = tipo === 'linea';

  charts.evol = new Chart(canvas.getContext('2d'), {
    type: esLinea ? 'line' : 'bar',
    data: {
      labels: labelsSerie,
      datasets: [
        {
          label: 'Ventas',
          data: serieVentas,
          borderColor: '#3b82f6',
          backgroundColor: esLinea ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.55)',
          borderWidth: esLinea ? 2 : 0,
          fill: esLinea,
          tension: 0.35,
          pointRadius: esLinea ? 3 : 0,
          pointBackgroundColor: '#3b82f6'
        },
        {
          label: 'Compras',
          data: serieCompras,
          borderColor: '#f87171',
          backgroundColor: esLinea ? 'rgba(248,113,113,0.06)' : 'rgba(248,113,113,0.55)',
          borderWidth: esLinea ? 2 : 0,
          fill: esLinea,
          tension: 0.35,
          pointRadius: esLinea ? 3 : 0,
          pointBackgroundColor: '#f87171'
        },
        {
          label: 'Gastos',
          data: serieGastos,
          borderColor: '#f5c842',
          backgroundColor: esLinea ? 'rgba(245,200,66,0.06)' : 'rgba(245,200,66,0.45)',
          borderWidth: esLinea ? 2 : 0,
          fill: esLinea,
          tension: 0.35,
          pointRadius: esLinea ? 3 : 0,
          pointBackgroundColor: '#f5c842'
        }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'rgba(240,244,255,0.6)',
            font: { family: 'DM Sans', size: 11 },
            boxWidth: 10, boxHeight: 10,
            padding: 16,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: { label: c => `${c.dataset.label}: ${money(c.parsed.y)}` }
        }
      }
    }
  });
}

// ── Pie ventas A / B
function renderVentasPie(ventaA, ventaB) {
  destroyChart('ventasPie');
  const canvas = document.getElementById('chartVentasPie');
  const legend = document.getElementById('legendVentas');
  if (!canvas) return;

  const total = ventaA + ventaB;
  if (total === 0) {
    if (legend) legend.innerHTML = '<div class="est-empty"><i class="fa-solid fa-chart-pie"></i><p>Sin ventas</p></div>';
    return;
  }

  const data   = [ventaA, ventaB];
  const labels = ['Factura A', 'Presupuesto B'];
  const colors = ['#3b82f6', '#a78bfa'];

  charts.ventasPie = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `${c.label}: ${money(c.parsed)}` } }
      }
    }
  });

  if (legend) {
    legend.innerHTML = data.map((v, i) => `
      <div class="est-legend-item">
        <div class="est-legend-dot" style="background:${colors[i]}"></div>
        <span class="est-legend-label">${labels[i]}</span>
        <span class="est-legend-val">${pct(v, total)}</span>
      </div>
      <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text-lo);margin-left:16px;margin-bottom:4px;">${money(v)}</div>
    `).join('');
  }
}

// ── Pie gastos
function renderGastosPie(gastosPorCat) {
  destroyChart('gastosPie');
  const canvas = document.getElementById('chartGastosPie');
  const legend = document.getElementById('legendGastos');
  if (!canvas) return;

  const cats   = Object.keys(gastosPorCat).filter(k => gastosPorCat[k] > 0);
  const vals   = cats.map(k => gastosPorCat[k]);
  const total  = vals.reduce((a, b) => a + b, 0);

  if (!cats.length || total === 0) {
    if (legend) legend.innerHTML = '<div class="est-empty"><i class="fa-solid fa-chart-pie"></i><p>Sin gastos</p></div>';
    return;
  }

  const colors = cats.map((_, i) => PALETTE[i % PALETTE.length]);

  charts.gastosPie = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: { labels: cats, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.label}: ${money(c.parsed)}` } } }
    }
  });

  if (legend) {
    const sorted = cats.map((k, i) => ({ k, v: vals[i], color: colors[i] })).sort((a, b) => b.v - a.v).slice(0, 6);
    legend.innerHTML = sorted.map(({ k, v, color }) => `
      <div class="est-legend-item">
        <div class="est-legend-dot" style="background:${color}"></div>
        <span class="est-legend-label">${k}</span>
        <span class="est-legend-val">${pct(v, total)}</span>
      </div>
    `).join('');
  }
}

// ── Compras A / B barras
function renderComprasTipo(compraA, compraB) {
  destroyChart('comprasTipo');
  const canvas = document.getElementById('chartComprasTipo');
  if (!canvas) return;

  charts.comprasTipo = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Facturas A', 'Presupuestos B'],
      datasets: [{
        data: [compraA, compraB],
        backgroundColor: ['rgba(248,113,113,0.65)', 'rgba(251,146,60,0.65)'],
        borderRadius: 6, borderWidth: 0
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: { callbacks: { label: c => money(c.parsed.y) } }
      }
    }
  });
}

// ── Barras ventas período
function renderVentasBarra(labels, serieA, serieB, periodo) {
  destroyChart('ventasBarra');
  const canvas = document.getElementById('chartVentasBarra');
  if (!canvas) return;

  charts.ventasBarra = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'A (Factura)', data: serieA, backgroundColor: 'rgba(59,130,246,0.6)', borderRadius: 4, borderWidth: 0 },
        { label: 'B (Presupuesto)', data: serieB, backgroundColor: 'rgba(167,139,250,0.6)', borderRadius: 4, borderWidth: 0 }
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        legend: {
          display: true, position: 'top',
          labels: { color: 'rgba(240,244,255,0.5)', font: { family: 'DM Sans', size: 11 }, boxWidth: 10, boxHeight: 10, usePointStyle: true }
        },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${money(c.parsed.y)}` } }
      },
      scales: {
        ...CHART_DEFAULTS.scales,
        x: { ...CHART_DEFAULTS.scales.x, stacked: true },
        y: { ...CHART_DEFAULTS.scales.y, stacked: true }
      }
    }
  });
}

// ── Ranking proveedores
function renderRankingProveedores(proveedores) {
  const el = document.getElementById('rankingProveedores');
  if (!el) return;

  if (!proveedores || !proveedores.length) {
    el.innerHTML = '<div class="est-empty"><i class="fa-solid fa-truck"></i><p>Sin datos de proveedores</p></div>';
    return;
  }

  const max = proveedores[0]?.total || 1;
  el.innerHTML = proveedores.slice(0, 8).map((p, i) => `
    <div class="est-ranking-row">
      <span class="est-ranking__pos">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</span>
      <span class="est-ranking__name">${p.nombre || p.proveedor || 'Desconocido'}</span>
      <div class="est-ranking__bar-wrap">
        <div class="est-ranking__bar-fill" style="width:${(p.total / max * 100).toFixed(1)}%; --ranking-color:${PALETTE[i % PALETTE.length]}; background:${PALETTE[i % PALETTE.length]}"></div>
      </div>
      <span class="est-ranking__val">${money(p.total)}</span>
    </div>
  `).join('');
}

// ── Gastos por categoría (lista)
function renderGastosDetalle(gastosPorCat) {
  const el = document.getElementById('gastosDetalleList');
  if (!el) return;

  const cats   = Object.entries(gastosPorCat).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
  const total  = cats.reduce((s, [, v]) => s + v, 0);

  if (!cats.length) {
    el.innerHTML = '<div class="est-empty"><i class="fa-solid fa-receipt"></i><p>Sin gastos registrados</p></div>';
    return;
  }

  el.innerHTML = cats.map(([cat, val]) => {
    const info = GASTOS_ICONS[cat] || GASTOS_ICONS.otros;
    const pctVal = total > 0 ? (val / total * 100) : 0;
    return `
      <div class="est-gasto-item">
        <div class="est-gasto-icon" style="background:${info.bg}; color:${info.color}">
          <i class="fa-solid ${info.icon}"></i>
        </div>
        <span class="est-gasto-name">${cat}</span>
        <div class="est-gasto-bar-wrap">
          <div class="est-gasto-bar" style="width:${pctVal.toFixed(1)}%;background:${info.color}"></div>
        </div>
        <span class="est-gasto-val">${money(val)}</span>
      </div>
    `;
  }).join('');
}

// ── Diagnóstico
function renderDiagnostico(ventaA, ventaB, compra, gastos) {
  const el = document.getElementById('diagnosticoPanel');
  if (!el) return;

  const ingresos  = ventaA + ventaB;
  const egresos   = compra + gastos;
  const balance   = ingresos - egresos;
  const margen    = ingresos > 0 ? (ingresos - compra) / ingresos * 100 : 0;
  const rentNet   = ingresos > 0 ? balance / ingresos * 100 : 0;
  const relCV     = ingresos > 0 ? compra / ingresos * 100 : 0;
  const pesoGasCom = compra > 0 ? gastos / compra * 100 : 0;

  const alerts = [];

  if (balance < 0)
    alerts.push({ tipo: 'red', icon: 'fa-triangle-exclamation', texto: `<strong>Pérdida neta de ${money(Math.abs(balance))}</strong>. Los egresos superan a los ingresos. Revisá estructura de costos urgente.` });
  else if (balance > 0)
    alerts.push({ tipo: 'green', icon: 'fa-circle-check', texto: `<strong>Ganancia neta de ${money(balance)}</strong>. El negocio es rentable en este período.` });

  if (margen < 15 && ingresos > 0)
    alerts.push({ tipo: 'red', icon: 'fa-arrow-trend-down', texto: `<strong>Margen bruto bajo (${margen.toFixed(1)}%)</strong>. El costo de mercadería consume demasiado de las ventas. Analizar precios de compra o de venta.` });
  else if (margen >= 30 && ingresos > 0)
    alerts.push({ tipo: 'green', icon: 'fa-thumbs-up', texto: `<strong>Margen bruto saludable (${margen.toFixed(1)}%)</strong>. La diferencia entre compra y venta es adecuada.` });
  else if (ingresos > 0)
    alerts.push({ tipo: 'gold', icon: 'fa-circle-info', texto: `<strong>Margen bruto moderado (${margen.toFixed(1)}%)</strong>. Hay espacio para mejorar márgenes ajustando precios de venta.` });

  if (relCV > 80 && ingresos > 0)
    alerts.push({ tipo: 'red', icon: 'fa-boxes-stacked', texto: `<strong>Alto ratio Compra/Venta (${relCV.toFixed(1)}%)</strong>. Estás comprando casi todo lo que vendés. Puede indicar margen muy ajustado o stock excesivo.` });

  if (gastos > 0 && ingresos > 0 && gastos / ingresos > 0.3)
    alerts.push({ tipo: 'gold', icon: 'fa-coins', texto: `<strong>Gastos operativos elevados (${(gastos / ingresos * 100).toFixed(1)}% de ventas)</strong>. Revisá gastos fijos: sueldos, alquiler, servicios.` });

  if (ventaA === 0 && ventaB > 0 && ingresos > 0)
    alerts.push({ tipo: 'gold', icon: 'fa-file-lines', texto: `<strong>Sin ventas facturadas (A)</strong>. Todas las ventas son por presupuesto B. Verificá si corresponde emitir facturas A.` });

  if (compra === 0 && ingresos > 0)
    alerts.push({ tipo: 'gold', icon: 'fa-boxes-stacked', texto: `<strong>Sin compras registradas</strong> en el período. ¿Se cargaron las facturas de proveedores correctamente?` });

  if (!alerts.length)
    alerts.push({ tipo: 'gold', icon: 'fa-circle-info', texto: 'No hay suficientes datos para generar un diagnóstico completo. Asegurate de tener ventas, compras y gastos cargados.' });

  const colorMap = { red: 'var(--red)', green: 'var(--green)', gold: 'var(--gold)', blue: 'var(--blue)' };
  const bgMap    = { red: 'rgba(248,113,113,0.06)', green: 'rgba(52,211,153,0.06)', gold: 'rgba(245,200,66,0.06)', blue: 'rgba(59,130,246,0.06)' };

  el.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${alerts.map(a => `
        <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:${bgMap[a.tipo]};border:1px solid ${colorMap[a.tipo]}33;border-radius:10px;">
          <i class="fa-solid ${a.icon}" style="font-size:16px;color:${colorMap[a.tipo]};margin-top:1px;flex-shrink:0;"></i>
          <p style="font-size:13px;color:rgba(240,244,255,0.8);line-height:1.55;">${a.texto}</p>
        </div>
      `).join('')}
    </div>
  `;
}

/* ══════════════════════════════════════
   TABS EVOLUCIÓN
══════════════════════════════════════ */
let lastEvolData = null;

document.querySelectorAll('[data-chart]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-chart]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (lastEvolData) {
      const tipo = btn.dataset.chart === 'evol-linea' ? 'linea' : 'barra';
      renderEvolucion(lastEvolData.labels, lastEvolData.ventas, lastEvolData.compras, lastEvolData.gastos, tipo);
    }
  });
});

/* ══════════════════════════════════════
   MAIN: CARGAR TODO
══════════════════════════════════════ */
async function cargarDashboard() {
  const loadEl  = document.getElementById('loadingIndicator');
  const errEl   = document.getElementById('errorGlobal');
  const content = document.getElementById('dashContent');
  const inicial = document.getElementById('estadoInicial');
  const rangoLbl = document.getElementById('rangoLabel');
  const rangoTxt = document.getElementById('rangoTexto');

  if (loadEl) loadEl.classList.add('visible');
  if (errEl) { errEl.classList.remove('visible'); errEl.textContent = ''; }

  const { desde, hasta, label } = getRango();
  const periodo = periodoActivo;

  try {
    // ── 1. Ventas
    const qsVentaA = new URLSearchParams({ periodo, tipo: 'A', desde, hasta });
    const qsVentaB = new URLSearchParams({ periodo, tipo: 'B', desde, hasta });
    const qsVentaT = new URLSearchParams({ periodo, tipo: 'TOTAL', desde, hasta });

    // ── 2. Compras
    const qsCompraA = new URLSearchParams({ periodo, tipo: 'A', desde, hasta });
    const qsCompraB = new URLSearchParams({ periodo, tipo: 'B', desde, hasta });

    // ── 3. Gastos
    const qsGastos = new URLSearchParams({ periodo, categoria: '', desde, hasta });

    // Peticiones paralelas: 3 ventas + 2 compras + 1 gasto + (opcional: proveedores)
    const [dataVentaA, dataVentaB, dataVentaT, dataCompraA, dataCompraB, dataGastos] = await Promise.all([
      fetchAPI(`/administracion/api/objetivos-ventas?${qsVentaA}`),
      fetchAPI(`/administracion/api/objetivos-ventas?${qsVentaB}`),
      fetchAPI(`/administracion/api/objetivos-ventas?${qsVentaT}`),
      fetchAPI(`/administracion/api/objetivos-compras?${qsCompraA}`),
      fetchAPI(`/administracion/api/objetivos-compras?${qsCompraB}`),
      fetchAPI(`/administracion/api/objetivos-gastos?${qsGastos}`)
    ]);

    // ── Totales
    const ventaA  = dataVentaA.totales?.A  || dataVentaA.totales?.TOTAL || 0;
    const ventaB  = dataVentaB.totales?.B  || dataVentaB.totales?.TOTAL || 0;
    const compraA = dataCompraA.totales?.A || dataCompraA.totales?.TOTAL || 0;
    const compraB = dataCompraB.totales?.B || dataCompraB.totales?.TOTAL || 0;
    const gastos  = dataGastos.totales?.TOTAL || 0;

    // ── Series para evolución temporal (usamos ventas total)
    const evolLabels  = (dataVentaT.series?.etiquetas || []).map(l => fmtLabel(l, periodo));
    const evolVentas  = dataVentaT.series?.TOTAL || dataVentaT.series?.A || [];
    const evolCompras = dataCompraA.series?.TOTAL || dataCompraA.series?.A || [];
    const evolGastos  = dataGastos.series?.TOTAL || [];

    // ── Series para barras de ventas por período
    const ventaSerieA = dataVentaA.series?.A || dataVentaA.series?.TOTAL || [];
    const ventaSerieB = dataVentaB.series?.B || dataVentaB.series?.TOTAL || [];

    // ── Gastos por categoría (del endpoint genérico pedimos cada categoría)
    // Usamos el listado de categorías conocidas y el breakdown si está en la respuesta,
    // o hacemos peticiones individuales:
    const CATS = ['luz','agua','gas','municipalidad','rentas provincia','contador','empleados','alquiler','internet','limpieza','seguro','otros'];
    let gastosPorCat = {};

    // Si la API devuelve breakdown por categoría en totales, usarlo directo
    if (dataGastos.totales && typeof dataGastos.totales === 'object') {
      CATS.forEach(cat => { gastosPorCat[cat] = dataGastos.totales[cat] || 0; });
    }

    // Proveedores: intentar endpoint si existe, si no, skip silencioso
    let proveedores = [];
    try {
      const qsProv = new URLSearchParams({ desde, hasta });
      const dataProv = await fetchAPI(`/administracion/api/objetivos-proveedores?${qsProv}`);
      proveedores = dataProv.proveedores || dataProv.data || [];
    } catch (_) { /* endpoint opcional */ }

    /* ── RENDER ── */
    renderBalance(ventaA, ventaB, compraA + compraB, gastos);
    renderEvolucion(evolLabels, evolVentas, evolCompras, evolGastos, 'linea');
    lastEvolData = { labels: evolLabels, ventas: evolVentas, compras: evolCompras, gastos: evolGastos };
    renderVentasPie(ventaA, ventaB);
    renderGastosPie(gastosPorCat);
    renderComprasTipo(compraA, compraB);
    renderVentasBarra(evolLabels, ventaSerieA, ventaSerieB, periodo);
    renderGastosDetalle(gastosPorCat);
    renderRankingProveedores(proveedores);
    renderDiagnostico(ventaA, ventaB, compraA + compraB, gastos);

    // Mostrar contenido
    if (inicial) inicial.style.display = 'none';
    if (content) content.style.display = 'block';
    if (rangoLbl) rangoLbl.style.display = 'inline-block';
    if (rangoTxt) rangoTxt.textContent = label;

  } catch (err) {
    console.error('[Dashboard]', err);
    if (errEl) {
      errEl.textContent = `❌ Error al cargar datos: ${err.message}`;
      errEl.classList.add('visible');
    }
  } finally {
    if (loadEl) loadEl.classList.remove('visible');
  }
}

/* ══════════════════════════════════════
   BOTÓN ACTUALIZAR
══════════════════════════════════════ */
document.getElementById('btnActualizar')?.addEventListener('click', cargarDashboard);
