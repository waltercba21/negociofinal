/**
 * estadisticas.js — AutoFaros Dashboard Ejecutivo
 *
 * FLUJO DE DATOS:
 *  1. Totales de ventas/compras/gastos:  /administracion/api/objetivos-*
 *  2. Detalle de ventas (productos):     /productos/api/facturas  +  /productos/api/presupuestos
 *     → cada doc: { id, nombre_cliente, fecha, total }
 *     → cada detalle via /productos/factura/:id  → { factura, items:[{nombre,cantidad,...}] }
 *     → cada detalle via /productos/presupuesto/:id (redirige a HTML, no JSON — skip)
 *  3. Proveedores: extraídos del resumen de compras extendido si disponible,
 *     o bien del listado de administración.
 */
'use strict';

/* ══════ CONSTANTES ══════ */
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const pad   = n => String(n).padStart(2,'0');
const lastD = (y,m) => new Date(y,m,0).getDate();

const PALETTE = [
  '#f5c842','#3b82f6','#34d399','#f87171','#a78bfa',
  '#fb923c','#38bdf8','#4ade80','#e879f9','#facc15'
];

const GASTO_META = {
  luz:               { ico:'fa-bolt',             col:'#facc15', bg:'rgba(250,204,21,.12)' },
  agua:              { ico:'fa-droplet',           col:'#38bdf8', bg:'rgba(56,189,248,.12)' },
  gas:               { ico:'fa-fire-flame-curved', col:'#fb923c', bg:'rgba(251,146,60,.12)' },
  municipalidad:     { ico:'fa-building-columns',  col:'#a78bfa', bg:'rgba(167,139,250,.12)' },
  'rentas provincia':{ ico:'fa-landmark',          col:'#818cf8', bg:'rgba(129,140,248,.12)' },
  contador:          { ico:'fa-calculator',        col:'#34d399', bg:'rgba(52,211,153,.12)' },
  empleados:         { ico:'fa-users',             col:'#60a5fa', bg:'rgba(96,165,250,.12)' },
  alquiler:          { ico:'fa-house',             col:'#f87171', bg:'rgba(248,113,113,.12)' },
  internet:          { ico:'fa-wifi',              col:'#2dd4bf', bg:'rgba(45,212,191,.12)' },
  limpieza:          { ico:'fa-broom',             col:'#86efac', bg:'rgba(134,239,172,.12)' },
  seguro:            { ico:'fa-shield',            col:'#c4b5fd', bg:'rgba(196,181,253,.12)' },
  otros:             { ico:'fa-ellipsis',          col:'#94a3b8', bg:'rgba(148,163,184,.12)' }
};

const money = n =>
  Number(n || 0).toLocaleString('es-AR',{ style:'currency', currency:'ARS', maximumFractionDigits:0 });

const pct = (n,d) => d === 0 ? '—' : (n/d*100).toFixed(1)+'%';

const $ = id => document.getElementById(id);
const setTxt = (id, v) => { const e = $(id); if (e) e.textContent = v; };

/* ══════ RANGOS ══════ */
function weekRange(y,m,w){
  const s = (w-1)*7+1, e = Math.min(w*7, lastD(y,m));
  return { desde:`${y}-${pad(m)}-${pad(s)}`, hasta:`${y}-${pad(m)}-${pad(e)}`,
           label:`Semana ${w} — ${MESES[m-1]} ${y}` };
}
function monthRange(y,m){
  return { desde:`${y}-${pad(m)}-01`, hasta:`${y}-${pad(m)}-${pad(lastD(y,m))}`,
           label:`${MESES[m-1]} ${y}` };
}
function yearRange(y){
  return { desde:`${y}-01-01`, hasta:`${y}-12-31`, label:`Año ${y}` };
}

/* ══════ INIT SELECTORES ══════ */
(function(){
  const now = new Date(), y = now.getFullYear(), m = now.getMonth()+1;
  const yrs = Array.from({length:7},(_,i)=>y-i);
  const fill = (id,opts)=>{ const e=$(id); if(e) e.innerHTML=opts.map(([v,t])=>`<option value="${v}">${t}</option>`).join(''); };
  fill('f-anSem', yrs.map(r=>[r,r])); fill('f-anMen', yrs.map(r=>[r,r])); fill('f-anAnu', yrs.map(r=>[r,r]));
  const mOpts = Array.from({length:12},(_,i)=>[i+1,`${pad(i+1)} — ${MESES[i]}`]);
  fill('f-mesSem',mOpts); fill('f-mesMen',mOpts);
  ['f-anSem','f-anMen','f-anAnu'].forEach(id=>{ const e=$(id); if(e) e.value=y; });
  ['f-mesSem','f-mesMen'].forEach(id=>{ const e=$(id); if(e) e.value=m; });
})();

/* ══════ PERIODO ══════ */
let periodo = 'mensual';
const showSubs = p => {
  $('sub-semanal').style.display = p==='semanal'?'flex':'none';
  $('sub-mensual').style.display = p==='mensual'?'flex':'none';
  $('sub-anual').style.display   = p==='anual'  ?'flex':'none';
};
showSubs(periodo);

document.querySelectorAll('.est-tab-p').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.est-tab-p').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    periodo = btn.dataset.p;
    showSubs(periodo);
  });
});

function getRango(){
  if (periodo==='semanal') return weekRange(+$('f-anSem').value, +$('f-mesSem').value, +$('f-semanaMes').value);
  if (periodo==='mensual') return monthRange(+$('f-anMen').value, +$('f-mesMen').value);
  return yearRange(+$('f-anAnu').value);
}

/* ══════ LABEL FORMATTER ══════ */
function fmtL(lbl,p){
  if (!lbl) return '-';
  if (p==='anual'&&/^\d{4}-\d{2}$/.test(lbl)) return MESES[parseInt(lbl.split('-')[1])-1]?.slice(0,3)??lbl;
  if (/^\d{4}-\d{2}-\d{2}/.test(lbl)){ const[,m,d]=lbl.slice(0,10).split('-'); return `${d}/${m}`; }
  if (/^\d{4}-\d{2}$/.test(lbl)) return lbl.split('-')[1];
  return String(lbl);
}

/* ══════ CHART INSTANCES ══════ */
const CH={};
const killCh = k => { if(CH[k]){ CH[k].destroy(); delete CH[k]; } };

const BASE_SCALES = {
  x:{ ticks:{color:'rgba(240,244,255,.4)',font:{family:'Roboto Mono',size:10}}, grid:{color:'rgba(255,255,255,.05)'}, border:{color:'rgba(255,255,255,.08)'} },
  y:{ beginAtZero:true, ticks:{color:'rgba(240,244,255,.4)',font:{family:'Roboto Mono',size:10},callback:v=>money(v)}, grid:{color:'rgba(255,255,255,.05)'}, border:{color:'rgba(255,255,255,.08)'} }
};

/* ══════ FETCH HELPERS ══════ */
async function apiFetch(url){
  const r = await fetch(url);
  const d = await r.json();
  if (!r.ok||(d.ok===false)) throw new Error(d.error||`HTTP ${r.status} — ${url}`);
  return d;
}
async function apiSoft(url){
  try{ return await apiFetch(url); } catch{ return null; }
}
/* Fetch que acepta arrays (la api de presupuestos devuelve array directo) */
async function apiFetchRaw(url){
  try{
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/* ══════════════════════════════════════
   RENDER: BALANCE + KPIs + INDICADORES
══════════════════════════════════════ */
function renderKPIs(vA, vB, comp, gast){
  const ing = vA+vB;
  const bal = ing - comp - gast;
  const margen = ing>0 ? (ing-comp)/ing*100 : 0;

  /* KPI cards */
  setTxt('kVA',  money(vA));
  setTxt('kVB',  money(vB));
  setTxt('kComp',money(comp));
  setTxt('kGast',money(gast));
  setTxt('kMarg',margen.toFixed(1)+'%');

  /* Balance columnas */
  setTxt('bIng', money(ing));
  setTxt('bComp',money(comp));
  setTxt('bGast',money(gast));
  setTxt('bMarg',margen.toFixed(1)+'%');
  setTxt('bVal', money(bal));

  const bEl = $('bVal');
  if(bEl) bEl.className = 'estbal-val '+(bal>0?'pos':bal<0?'neg':'neu');

  const vEl = $('bVerdict');
  if(vEl){
    if(bal>0)      vEl.innerHTML=`<i class="fa-solid fa-circle-check" style="color:var(--green)"></i> El negocio <strong style="color:var(--green)">está generando ganancias</strong> en este período`;
    else if(bal<0) vEl.innerHTML=`<i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i> Los egresos <strong style="color:var(--red)">superan a los ingresos</strong> en este período`;
    else           vEl.innerHTML=`<i class="fa-solid fa-minus" style="color:var(--gold)"></i> El negocio está en <strong style="color:var(--gold)">punto de equilibrio</strong>`;
  }

  /* Barras balance */
  const maxV = Math.max(ing,comp,gast,1);
  const bar = (id,v) => { const e=$(id); if(e) e.style.width=Math.min(100,v/maxV*100)+'%'; };
  bar('bfIng',ing); bar('bfComp',comp); bar('bfGast',gast); bar('bfMarg',Math.max(0,margen));

  /* Indicadores */
  const rentN = ing>0?(bal/ing*100).toFixed(1)+'%':'—';
  const relCV = ing>0?(comp/ing*100).toFixed(1)+'%':'—';
  const gv    = ing>0?(gast/ing*100).toFixed(1)+'%':'—';
  const pa    = ing>0?(vA/ing*100).toFixed(1)+'%':'—';
  setTxt('rRent',rentN); setTxt('rCV',relCV); setTxt('rGV',gv); setTxt('rPA',pa);
  const rEl=$('rRent');
  if(rEl&&bal!==0) rEl.style.color=bal>0?'var(--green)':'var(--red)';
}

/* ══════════════════════════════════════
   RENDER: EVOLUCIÓN
══════════════════════════════════════ */
let lastEvol=null;
function renderEvol(labels,ventas,compras,gastos,tipo='linea'){
  killCh('evol');
  const canvas=$('cEvol'); if(!canvas) return;
  const esL = tipo==='linea';
  CH.evol = new Chart(canvas.getContext('2d'),{
    type: esL?'line':'bar',
    data:{
      labels,
      datasets:[
        {label:'Ventas', data:ventas, borderColor:'#3b82f6', backgroundColor:esL?'rgba(59,130,246,.07)':'rgba(59,130,246,.55)', borderWidth:esL?2:0, fill:esL, tension:.35, pointRadius:esL?3:0, pointBackgroundColor:'#3b82f6'},
        {label:'Compras',data:compras,borderColor:'#f87171', backgroundColor:esL?'rgba(248,113,113,.07)':'rgba(248,113,113,.55)',borderWidth:esL?2:0, fill:esL, tension:.35, pointRadius:esL?3:0, pointBackgroundColor:'#f87171'},
        {label:'Gastos', data:gastos, borderColor:'#f5c842', backgroundColor:esL?'rgba(245,200,66,.07)':'rgba(245,200,66,.45)', borderWidth:esL?2:0, fill:esL, tension:.35, pointRadius:esL?3:0, pointBackgroundColor:'#f5c842'}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:true,position:'top',labels:{color:'rgba(240,244,255,.55)',font:{family:'Roboto',size:11},boxWidth:10,boxHeight:10,usePointStyle:true,padding:16}},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${money(c.parsed.y)}`}}
      },
      scales: BASE_SCALES
    }
  });
}

/* ══════════════════════════════════════
   RENDER: DOUGHNUT
══════════════════════════════════════ */
function renderDoughnut(canvasId,legId,labels,values,colors){
  killCh(canvasId);
  const canvas=$(canvasId), legEl=$(legId); if(!canvas) return;
  const total = values.reduce((a,b)=>a+b,0);
  if(!total||!labels.length){
    if(legEl) legEl.innerHTML='<div class="est-empty"><i class="fa-solid fa-chart-pie"></i><p>Sin datos</p></div>';
    return;
  }
  CH[canvasId]=new Chart(canvas.getContext('2d'),{
    type:'doughnut',
    data:{labels,datasets:[{data:values,backgroundColor:colors,borderWidth:0,hoverOffset:6}]},
    options:{
      responsive:true,maintainAspectRatio:false,cutout:'62%',
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${money(c.parsed)}`}}}
    }
  });
  if(legEl){
    legEl.innerHTML = labels.map((l,i)=>`
      <div class="est-leg-row">
        <div class="est-leg-dot" style="background:${colors[i]}"></div>
        <span class="est-leg-name">${l}</span>
        <span class="est-leg-pct">${pct(values[i],total)}</span>
      </div>
      <div class="est-leg-sub">${money(values[i])}</div>
    `).join('');
  }
}

/* ══════════════════════════════════════
   RENDER: RANKING
══════════════════════════════════════ */
function renderRanking(elId, items, valFmt){
  const el=$(elId); if(!el) return;
  if(!items||!items.length){
    el.innerHTML='<div class="est-empty"><i class="fa-solid fa-inbox"></i><p>Sin datos para el período</p></div>';
    return;
  }
  const max = items[0].val||1;
  el.innerHTML = items.slice(0,8).map((item,i)=>{
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`;
    const color = PALETTE[i%PALETTE.length];
    return `<div class="est-rk-row ${i===0?'top':''}">
      <span class="est-rk-pos">${medal}</span>
      <span class="est-rk-name" title="${item.name}">${item.name}</span>
      <div class="est-rk-bar-w"><div class="est-rk-bar-f" style="width:${(item.val/max*100).toFixed(1)}%;background:${color}"></div></div>
      <span class="est-rk-val">${valFmt(item.val)}</span>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   RENDER: GASTOS LISTA
══════════════════════════════════════ */
function renderGastosLista(catMap){
  const el=$('gastosLista'); if(!el) return;
  const cats = Object.entries(catMap).filter(([,v])=>v>0).sort(([,a],[,b])=>b-a);
  const tot  = cats.reduce((s,[,v])=>s+v,0);
  if(!cats.length){ el.innerHTML='<div class="est-empty"><i class="fa-solid fa-receipt"></i><p>Sin gastos registrados</p></div>'; return; }
  el.innerHTML = cats.map(([cat,val])=>{
    const m = GASTO_META[cat]||GASTO_META.otros;
    const w = tot>0?(val/tot*100).toFixed(1):0;
    return `<div class="est-gasto-row">
      <div class="est-gasto-ico" style="background:${m.bg};color:${m.col}"><i class="fa-solid ${m.ico}"></i></div>
      <span class="est-gasto-name">${cat}</span>
      <div class="est-gasto-bw"><div class="est-gasto-bf" style="width:${w}%;background:${m.col}"></div></div>
      <span class="est-gasto-val">${money(val)}</span>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   RENDER: DIAGNÓSTICO
══════════════════════════════════════ */
function renderDiag(vA,vB,comp,gast){
  const el=$('diagPanel'); if(!el) return;
  const ing=vA+vB, bal=ing-comp-gast;
  const margen=ing>0?(ing-comp)/ing*100:0;
  const alerts=[];

  if(bal<0)
    alerts.push({t:'red',i:'fa-triangle-exclamation',msg:`<strong>Pérdida neta de ${money(Math.abs(bal))}</strong>. Los egresos superan los ingresos. Revisá estructura de costos urgente.`});
  else if(bal>0)
    alerts.push({t:'green',i:'fa-circle-check',msg:`<strong>Ganancia neta de ${money(bal)}</strong>. El negocio es rentable en este período.`});

  if(margen<15&&ing>0)
    alerts.push({t:'red',i:'fa-arrow-trend-down',msg:`<strong>Margen bruto bajo (${margen.toFixed(1)}%)</strong>. El costo de mercadería consume demasiado de las ventas.`});
  else if(margen>=30&&ing>0)
    alerts.push({t:'green',i:'fa-thumbs-up',msg:`<strong>Margen bruto saludable (${margen.toFixed(1)}%)</strong>. La diferencia entre compra y venta es adecuada.`});
  else if(ing>0)
    alerts.push({t:'gold',i:'fa-circle-info',msg:`<strong>Margen moderado (${margen.toFixed(1)}%)</strong>. Hay espacio para mejorar ajustando precios de venta o de compra.`});

  if(ing>0&&comp/ing>0.8)
    alerts.push({t:'red',i:'fa-boxes-stacked',msg:`<strong>Alto ratio Compra/Venta (${(comp/ing*100).toFixed(1)}%)</strong>. Estás comprando casi todo lo que vendés. Margen muy ajustado.`});

  if(ing>0&&gast/ing>0.3)
    alerts.push({t:'gold',i:'fa-coins',msg:`<strong>Gastos operativos elevados (${(gast/ing*100).toFixed(1)}% de ventas)</strong>. Revisá gastos fijos: sueldos, alquiler, servicios.`});

  if(!alerts.length)
    alerts.push({t:'gold',i:'fa-circle-info',msg:'Datos insuficientes para un diagnóstico completo. Asegurate de tener ventas, compras y gastos cargados en el período.'});

  const BG ={red:'rgba(248,113,113,.07)',green:'rgba(52,211,153,.07)',gold:'rgba(245,200,66,.07)'};
  const CLR={red:'var(--red)',green:'var(--green)',gold:'var(--gold)'};
  el.innerHTML = alerts.map(a=>
    `<div class="est-diag-item" style="background:${BG[a.t]};border:1px solid ${CLR[a.t]}33">
      <i class="fa-solid ${a.i}" style="color:${CLR[a.t]}"></i>
      <p>${a.msg}</p>
    </div>`).join('');
}

/* ══════════════════════════════════════
   OBTENER ITEMS DE VENTAS
   Llama a /productos/api/facturas y /productos/api/presupuestos
   que devuelven arrays de { id, nombre_cliente, fecha, total }
   Luego carga los detalles de cada factura (que sí devuelve JSON)
   con límite de 30 llamadas para no saturar.
══════════════════════════════════════ */
async function obtenerItemsVentas(desde, hasta){
  const qs = `fechaInicio=${desde}&fechaFin=${hasta}`;
  // Ambos endpoints devuelven arrays directamente (sin wrapper .ok)
  const [facturas, presupuestos] = await Promise.all([
    apiFetchRaw(`/productos/api/facturas?${qs}`),
    apiFetchRaw(`/productos/api/presupuestos?${qs}`)
  ]);

  const allDocs = [
    ...(Array.isArray(facturas)     ? facturas     : []),
    ...(Array.isArray(presupuestos) ? presupuestos : [])
  ];

  if(!allDocs.length) return [];

  // Cargar detalles de facturas (que devuelven JSON) — hasta 30
  // Presupuesto devuelve HTML en /productos/presupuesto/:id, pero
  // /productos/factura/:id devuelve JSON: { factura, items }
  const facIds  = (Array.isArray(facturas)?facturas:[]).slice(0,30).map(f=>f.id);
  const presIds = (Array.isArray(presupuestos)?presupuestos:[]).slice(0,20).map(p=>p.id);

  const detallesFac = await Promise.all(
    facIds.map(id => apiFetchRaw(`/productos/factura/${id}`))
  );
  // presupuesto/:id devuelve HTML (render), no JSON → usamos la ruta API si existe
  // Intentamos /productos/api/presupuesto/:id por si hay
  const detallesPres = await Promise.all(
    presIds.map(id => apiFetchRaw(`/productos/api/presupuesto/${id}`))
  );

  const allItems = [];

  detallesFac.forEach(d=>{
    if(d&&Array.isArray(d.items)) d.items.forEach(it=>allItems.push(it));
  });
  detallesPres.forEach(d=>{
    if(d&&Array.isArray(d.items)) d.items.forEach(it=>allItems.push(it));
    // también puede venir como { detalles: [] }
    if(d&&Array.isArray(d.detalles)) d.detalles.forEach(it=>allItems.push(it));
  });

  return allItems;
}

/* ══════════════════════════════════════
   CALCULAR RANKING PRODUCTOS
══════════════════════════════════════ */
function calcProductos(items){
  const map={};
  items.forEach(it=>{
    // El campo nombre puede venir como: nombre, descripcion, producto, nombre_producto
    const nombre = it.nombre||it.descripcion||it.producto||it.nombre_producto||null;
    if(!nombre) return;
    const qty = Number(it.cantidad||1);
    map[nombre]=(map[nombre]||0)+qty;
  });
  return Object.entries(map)
    .map(([name,val])=>({name,val}))
    .sort((a,b)=>b.val-a.val);
}

/* ══════════════════════════════════════
   OBTENER TOP PROVEEDORES
   Estrategia 1: endpoint de compras con parámetro detalle=proveedores
   Estrategia 2: endpoint de administración de compras que pueda traer lista
   Estrategia 3: extraer de las facturas del administrador si existen
══════════════════════════════════════ */
async function obtenerProveedores(desde, hasta, periodo){
  // 1. Intentar con detalle=proveedores en el endpoint estándar
  const qs = new URLSearchParams({periodo,tipo:'TOTAL',desde,hasta,detalle:'proveedores'}).toString();
  let data = await apiSoft(`/administracion/api/objetivos-compras?${qs}`);
  if(data?.proveedores?.length){
    return data.proveedores.map(x=>({
      name: x.nombre||x.proveedor||x.proveedor_nombre||'Desconocido',
      val: Number(x.total||0)
    })).sort((a,b)=>b.val-a.val);
  }

  // 2. Intentar endpoint específico de top proveedores del admin
  data = await apiSoft(`/administracion/api/top-proveedores?desde=${desde}&hasta=${hasta}`);
  if(data?.proveedores?.length||data?.data?.length){
    const arr = data.proveedores||data.data||[];
    return arr.map(x=>({
      name: x.nombre||x.proveedor||x.proveedor_nombre||'Desconocido',
      val: Number(x.total||x.monto||0)
    })).sort((a,b)=>b.val-a.val);
  }

  // 3. Intentar listado general de facturas de compra del admin
  const docsComp = await apiFetchRaw(`/administracion/api/facturas-compra?fechaInicio=${desde}&fechaFin=${hasta}`);
  if(Array.isArray(docsComp)&&docsComp.length){
    const map={};
    docsComp.forEach(doc=>{
      const n=doc.proveedor_nombre||doc.proveedor||doc.nombre_proveedor||null;
      if(!n) return;
      map[n]=(map[n]||0)+Number(doc.total||0);
    });
    return Object.entries(map).map(([name,val])=>({name,val})).sort((a,b)=>b.val-a.val);
  }

  return []; // No hay datos de proveedores disponibles
}

/* ══════════════════════════════════════
   MAIN
══════════════════════════════════════ */
async function cargar(){
  const loading  = $('estLoading');
  const errEl    = $('estErr');
  const dash     = $('estDash');
  const inicial  = $('estInicial');
  const rangoEl  = $('estRango');
  const rangoTxt = $('estRangoTxt');

  if(loading)  loading.classList.add('on');
  if(errEl)   { errEl.classList.remove('on'); errEl.textContent=''; }

  const {desde, hasta, label} = getRango();
  const p = periodo;

  try{
    /* ── PETICIONES PARALELAS PRINCIPALES ── */
    const qs = extra => new URLSearchParams({periodo:p,desde,hasta,...extra}).toString();

    const [dVA, dVB, dVT, dCA, dCB, dGast] = await Promise.all([
      apiFetch(`/administracion/api/objetivos-ventas?${qs({tipo:'A'})}`),
      apiFetch(`/administracion/api/objetivos-ventas?${qs({tipo:'B'})}`),
      apiFetch(`/administracion/api/objetivos-ventas?${qs({tipo:'TOTAL'})}`),
      apiFetch(`/administracion/api/objetivos-compras?${qs({tipo:'A'})}`),
      apiFetch(`/administracion/api/objetivos-compras?${qs({tipo:'B'})}`),
      apiFetch(`/administracion/api/objetivos-gastos?${qs({categoria:''})}`)
    ]);

    /* ── TOTALES ── */
    const vA   = dVA.totales?.A  || dVA.totales?.TOTAL  || 0;
    const vB   = dVB.totales?.B  || dVB.totales?.TOTAL  || 0;
    const cA   = dCA.totales?.A  || dCA.totales?.TOTAL  || 0;
    const cB   = dCB.totales?.B  || dCB.totales?.TOTAL  || 0;
    const comp = cA + cB;
    const gast = dGast.totales?.TOTAL || 0;

    /* ── SERIES EVOLUCIÓN ── */
    const rawLabels   = dVT.series?.labels || dVT.series?.etiquetas || [];
    const evolLabels  = rawLabels.map(l=>fmtL(l,p));
    const evolVentas  = dVT.series?.TOTAL || [];
    const sCA = dCA.series?.TOTAL||dCA.series?.A||[];
    const sCB = dCB.series?.TOTAL||dCB.series?.B||[];
    const evolCompras = sCA.map((v,i)=>(Number(v)||0)+(Number(sCB[i])||0));
    const evolGastos  = dGast.series?.TOTAL || [];

    /* ── GASTOS POR CATEGORÍA ── */
    const CATS=['luz','agua','gas','municipalidad','rentas provincia','contador','empleados','alquiler','internet','limpieza','seguro','otros'];
    const gastosCat={};
    CATS.forEach(cat=>{ gastosCat[cat]=Number(dGast.totales?.[cat]||0); });

    /* ── PROVEEDORES Y PRODUCTOS (en paralelo) ── */
    const [proveedores, itemsVentas] = await Promise.all([
      obtenerProveedores(desde, hasta, p),
      obtenerItemsVentas(desde, hasta)
    ]);

    const productos = calcProductos(itemsVentas);

    /* ══════ RENDER TODO ══════ */
    renderKPIs(vA, vB, comp, gast);

    renderEvol(evolLabels, evolVentas, evolCompras, evolGastos, 'linea');
    lastEvol = {labels:evolLabels, ventas:evolVentas, compras:evolCompras, gastos:evolGastos};

    renderDoughnut('cVentasPie','legVentas',
      ['Factura A','Presupuesto B'], [vA,vB], ['#3b82f6','#a78bfa']);

    renderDoughnut('cComprasPie','legCompras',
      ['Facturas A','Presupuestos B'], [cA,cB], ['#f87171','#fb923c']);

    const gCats  = CATS.filter(k=>gastosCat[k]>0);
    const gVals  = gCats.map(k=>gastosCat[k]);
    const gClrs  = gCats.map((_,i)=>PALETTE[i%PALETTE.length]);
    renderDoughnut('cGastosPie','legGastos', gCats, gVals, gClrs);

    renderGastosLista(gastosCat);

    renderRanking('rkProv', proveedores, money);
    renderRanking('rkProd', productos, n=>`${n} uds.`);

    renderDiag(vA, vB, comp, gast);

    /* ── MOSTRAR ── */
    if(inicial) inicial.style.display='none';
    if(dash)    dash.style.display='block';
    if(rangoEl) rangoEl.classList.add('on');
    if(rangoTxt) rangoTxt.textContent=label;

  } catch(err){
    console.error('[Estadísticas]', err);
    if(errEl){ errEl.textContent=`❌ Error: ${err.message}`; errEl.classList.add('on'); }
  } finally{
    if(loading) loading.classList.remove('on');
  }
}

/* ── TABS EVOLUCIÓN ── */
document.querySelectorAll('#evolTabs .est-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('#evolTabs .est-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    if(lastEvol) renderEvol(lastEvol.labels,lastEvol.ventas,lastEvol.compras,lastEvol.gastos,btn.dataset.t);
  });
});

/* ── BOTÓN ── */
$('btnActualizar')?.addEventListener('click', cargar);
