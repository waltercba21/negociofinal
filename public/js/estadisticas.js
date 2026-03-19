/**
 * estadisticas.js — AutoFaros Dashboard Ejecutivo
 * ─────────────────────────────────────────────────
 * TABLA DE VERDAD (confirmada con SQL.txt + modelo):
 *
 *  VENTAS (mostrador):
 *    facturas_mostrador   → factura_items   (producto_id, cantidad)
 *    presupuestos_mostrador → presupuesto_items (producto_id, cantidad)
 *
 *  COMPRAS (proveedor):
 *    facturas    (id_proveedor, fecha, importe_factura)
 *    presupuestos (id_proveedor, fecha, importe)
 *
 *  GASTOS:
 *    gastos (categoria, monto, fecha)
 *
 * ENDPOINTS USADOS:
 *  ✅ /administracion/api/objetivos-ventas?periodo&tipo&desde&hasta
 *  ✅ /administracion/api/objetivos-compras?periodo&tipo&desde&hasta
 *  ✅ /administracion/api/objetivos-gastos?periodo&categoria&desde&hasta
 *  ✅ /administracion/api/resumen-compras?desde&hasta
 *      → agrupa facturas+presupuestos de proveedor → array con nombre proveedor y total
 *  ✅ /administracion/api/top-productos?desde&hasta&limit=15
 *      → NUEVO endpoint (ver instrucciones al pie para agregarlo)
 *  🔄 /administracion/api/documentos?tipo=factura&desde&hasta
 *      → fallback para productos si no existe top-productos
 */
'use strict';

/* ══════ CONSTANTES ══════ */
const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio',
             'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const pad  =n=>String(n).padStart(2,'0');
const lastD=(y,m)=>new Date(y,m,0).getDate();
const PALETTE=['#f5c842','#3b82f6','#34d399','#f87171','#a78bfa','#fb923c','#38bdf8','#4ade80','#e879f9','#facc15'];
const GASTO_META={
  luz:              {ico:'fa-bolt',            col:'#facc15',bg:'rgba(250,204,21,.12)'},
  agua:             {ico:'fa-droplet',          col:'#38bdf8',bg:'rgba(56,189,248,.12)'},
  gas:              {ico:'fa-fire-flame-curved',col:'#fb923c',bg:'rgba(251,146,60,.12)'},
  municipalidad:    {ico:'fa-building-columns', col:'#a78bfa',bg:'rgba(167,139,250,.12)'},
  'rentas provincia':{ico:'fa-landmark',        col:'#818cf8',bg:'rgba(129,140,248,.12)'},
  contador:         {ico:'fa-calculator',       col:'#34d399',bg:'rgba(52,211,153,.12)'},
  empleados:        {ico:'fa-users',            col:'#60a5fa',bg:'rgba(96,165,250,.12)'},
  alquiler:         {ico:'fa-house',            col:'#f87171',bg:'rgba(248,113,113,.12)'},
  internet:         {ico:'fa-wifi',             col:'#2dd4bf',bg:'rgba(45,212,191,.12)'},
  limpieza:         {ico:'fa-broom',            col:'#86efac',bg:'rgba(134,239,172,.12)'},
  seguro:           {ico:'fa-shield',           col:'#c4b5fd',bg:'rgba(196,181,253,.12)'},
  otros:            {ico:'fa-ellipsis',         col:'#94a3b8',bg:'rgba(148,163,184,.12)'}
};
const money=n=>Number(n||0).toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
const pct  =(n,d)=>d===0?'—':(n/d*100).toFixed(1)+'%';
const $    =id=>document.getElementById(id);
const txt  =(id,v)=>{const e=$(id);if(e)e.textContent=v;};

/* ══════ RANGOS ══════ */
const weekRange =(y,m,w)=>({desde:`${y}-${pad(m)}-${pad((w-1)*7+1)}`,hasta:`${y}-${pad(m)}-${pad(Math.min(w*7,lastD(y,m)))}`,label:`Semana ${w} — ${MESES[m-1]} ${y}`});
const monthRange=(y,m)  =>({desde:`${y}-${pad(m)}-01`,hasta:`${y}-${pad(m)}-${pad(lastD(y,m))}`,label:`${MESES[m-1]} ${y}`});
const yearRange =y      =>({desde:`${y}-01-01`,hasta:`${y}-12-31`,label:`Año ${y}`});

/* ══════ INIT SELECTORES ══════ */
(function(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;
  const yrs=Array.from({length:7},(_,i)=>y-i);
  const fill=(id,opts)=>{const e=$(id);if(e)e.innerHTML=opts.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');};
  fill('f-anSem',yrs.map(r=>[r,r]));fill('f-anMen',yrs.map(r=>[r,r]));fill('f-anAnu',yrs.map(r=>[r,r]));
  const mO=Array.from({length:12},(_,i)=>[i+1,`${pad(i+1)} — ${MESES[i]}`]);
  fill('f-mesSem',mO);fill('f-mesMen',mO);
  ['f-anSem','f-anMen','f-anAnu'].forEach(id=>{const e=$(id);if(e)e.value=y;});
  ['f-mesSem','f-mesMen'].forEach(id=>{const e=$(id);if(e)e.value=m;});
})();

/* ══════ PERIODO ══════ */
let periodo='mensual';
const showSubs=p=>{
  $('sub-semanal').style.display=p==='semanal'?'flex':'none';
  $('sub-mensual').style.display=p==='mensual'?'flex':'none';
  $('sub-anual').style.display  =p==='anual'  ?'flex':'none';
};
showSubs(periodo);
document.querySelectorAll('.est-tab-p').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.est-tab-p').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');periodo=btn.dataset.p;showSubs(periodo);
  });
});
function getRango(){
  if(periodo==='semanal')return weekRange(+$('f-anSem').value,+$('f-mesSem').value,+$('f-semanaMes').value);
  if(periodo==='mensual')return monthRange(+$('f-anMen').value,+$('f-mesMen').value);
  return yearRange(+$('f-anAnu').value);
}

/* ══════ LABEL FORMATTER ══════ */
function fmtL(lbl,p){
  if(!lbl)return '-';
  if(p==='anual'&&/^\d{4}-\d{2}$/.test(lbl))return MESES[parseInt(lbl.split('-')[1])-1]?.slice(0,3)??lbl;
  if(/^\d{4}-\d{2}-\d{2}/.test(lbl)){const[,m,d]=lbl.slice(0,10).split('-');return`${d}/${m}`;}
  if(/^\d{4}-\d{2}$/.test(lbl))return lbl.split('-')[1];
  return String(lbl);
}

/* ══════ CHARTS ══════ */
const CH={};
const kill=k=>{if(CH[k]){CH[k].destroy();delete CH[k];}};
const SC={
  x:{ticks:{color:'rgba(240,244,255,.4)',font:{family:'Roboto Mono',size:10}},grid:{color:'rgba(255,255,255,.05)'},border:{color:'rgba(255,255,255,.08)'}},
  y:{beginAtZero:true,ticks:{color:'rgba(240,244,255,.4)',font:{family:'Roboto Mono',size:10},callback:v=>money(v)},grid:{color:'rgba(255,255,255,.05)'},border:{color:'rgba(255,255,255,.08)'}}
};

/* ══════ FETCH ══════ */
async function get(url){
  const r=await fetch(url);
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const d=await r.json();
  if(d&&d.ok===false)throw new Error(d.error||'Error API');
  return d;
}
const soft=async url=>{try{return await get(url);}catch{return null;}};

/* ══════════════════════════════════════
   RENDER: KPIs + BALANCE + INDICADORES
══════════════════════════════════════ */
function renderKPIs(vA,vB,comp,gast){
  const ing=vA+vB,bal=ing-comp-gast,m=ing>0?(ing-comp)/ing*100:0;
  txt('kVA',money(vA));txt('kVB',money(vB));txt('kComp',money(comp));txt('kGast',money(gast));txt('kMarg',m.toFixed(1)+'%');
  txt('bIng',money(ing));txt('bComp',money(comp));txt('bGast',money(gast));txt('bMarg',m.toFixed(1)+'%');txt('bVal',money(bal));
  const bEl=$('bVal');if(bEl)bEl.className='estbal-val '+(bal>0?'pos':bal<0?'neg':'neu');
  const vEl=$('bVerdict');
  if(vEl){
    if(bal>0)      vEl.innerHTML=`<i class="fa-solid fa-circle-check" style="color:var(--green)"></i> El negocio <strong style="color:var(--green)">está generando ganancias</strong> en este período`;
    else if(bal<0) vEl.innerHTML=`<i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i> Los egresos <strong style="color:var(--red)">superan a los ingresos</strong> en este período`;
    else           vEl.innerHTML=`<i class="fa-solid fa-minus" style="color:var(--gold)"></i> El negocio está en <strong style="color:var(--gold)">punto de equilibrio</strong>`;
  }
  const mx=Math.max(ing,comp,gast,1);
  ['bfIng',ing,'bfComp',comp,'bfGast',gast,'bfMarg',Math.max(0,m)].reduce((acc,v,i,a)=>{
    if(i%2===0)return v;
    const e=$(acc);if(e)e.style.width=Math.min(100,v/mx*100)+'%';
  },null);
  txt('rRent',ing>0?(bal/ing*100).toFixed(1)+'%':'—');
  txt('rCV',  ing>0?(comp/ing*100).toFixed(1)+'%':'—');
  txt('rGV',  ing>0?(gast/ing*100).toFixed(1)+'%':'—');
  txt('rPA',  ing>0?(vA/ing*100).toFixed(1)+'%':'—');
  const rEl=$('rRent');if(rEl&&bal!==0)rEl.style.color=bal>0?'var(--green)':'var(--red)';
}

/* ══════════════════════════════════════
   RENDER: EVOLUCIÓN
══════════════════════════════════════ */
let lastEvol=null;
function renderEvol(labels,ventas,compras,gastos,tipo='linea'){
  kill('evol');const c=$('cEvol');if(!c)return;
  const L=tipo==='linea';
  CH.evol=new Chart(c.getContext('2d'),{
    type:L?'line':'bar',
    data:{labels,datasets:[
      {label:'Ventas', data:ventas, borderColor:'#3b82f6',backgroundColor:L?'rgba(59,130,246,.07)':'rgba(59,130,246,.55)',borderWidth:L?2:0,fill:L,tension:.35,pointRadius:L?3:0,pointBackgroundColor:'#3b82f6'},
      {label:'Compras',data:compras,borderColor:'#f87171',backgroundColor:L?'rgba(248,113,113,.07)':'rgba(248,113,113,.55)',borderWidth:L?2:0,fill:L,tension:.35,pointRadius:L?3:0,pointBackgroundColor:'#f87171'},
      {label:'Gastos', data:gastos, borderColor:'#f5c842',backgroundColor:L?'rgba(245,200,66,.07)':'rgba(245,200,66,.45)', borderWidth:L?2:0,fill:L,tension:.35,pointRadius:L?3:0,pointBackgroundColor:'#f5c842'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{display:true,position:'top',labels:{color:'rgba(240,244,255,.55)',font:{family:'Roboto',size:11},boxWidth:10,boxHeight:10,usePointStyle:true,padding:16}},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${money(c.parsed.y)}`}}
      },scales:SC}
  });
}

/* ══════════════════════════════════════
   RENDER: DOUGHNUT
══════════════════════════════════════ */
function renderDoughnut(canvasId,legId,labels,values,colors){
  kill(canvasId);const c=$(canvasId),l=$(legId);if(!c)return;
  const total=values.reduce((a,b)=>a+b,0);
  if(!total){if(l)l.innerHTML='<div class="est-empty"><i class="fa-solid fa-chart-pie"></i><p>Sin datos</p></div>';return;}
  CH[canvasId]=new Chart(c.getContext('2d'),{
    type:'doughnut',data:{labels,datasets:[{data:values,backgroundColor:colors,borderWidth:0,hoverOffset:6}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${money(c.parsed)}`}}}}
  });
  if(l)l.innerHTML=labels.map((lb,i)=>`
    <div class="est-leg-row"><div class="est-leg-dot" style="background:${colors[i]}"></div>
      <span class="est-leg-name">${lb}</span><span class="est-leg-pct">${pct(values[i],total)}</span>
    </div><div class="est-leg-sub">${money(values[i])}</div>
  `).join('');
}

/* ══════════════════════════════════════
   RENDER: RANKING
══════════════════════════════════════ */
function renderRanking(elId, items, valFmt, showSub = false) {
  const el = $(elId); if (!el) return;
  if (!items?.length) {
    el.innerHTML = '<div class="est-empty"><i class="fa-solid fa-inbox"></i><p>Sin datos para el período</p></div>';
    return;
  }
  const max = items[0].val || 1;
  el.innerHTML = items.slice(0, 8).map((item, i) => {
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`;
    const color = PALETTE[i % PALETTE.length];
    const subLine = (showSub && (item.val_a || item.val_b)) ? `
      <div style="font-family:'Roboto Mono',monospace;font-size:9px;color:rgba(240,244,255,.32);margin-top:2px;display:flex;gap:10px;flex-wrap:wrap">
        ${item.val_a > 0 ? `<span style="color:rgba(59,130,246,.75)">A: ${money(item.val_a)}</span>` : ''}
        ${item.val_b > 0 ? `<span style="color:rgba(251,146,60,.75)">B: ${money(item.val_b)}</span>` : ''}
        ${item.docs  > 0 ? `<span>${item.docs} doc${item.docs > 1 ? 's' : ''}</span>` : ''}
      </div>` : '';
    return `<div class="est-rk-row ${i === 0 ? 'top' : ''}">
      <span class="est-rk-pos">${medal}</span>
      <div style="flex:1;min-width:0;overflow:hidden">
        <div class="est-rk-name" title="${item.name}">${item.name}</div>
        ${subLine}
      </div>
      <div class="est-rk-bar-w"><div class="est-rk-bar-f" style="width:${(item.val/max*100).toFixed(1)}%;background:${color}"></div></div>
      <span class="est-rk-val">${valFmt(item.val)}</span>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   RENDER: GASTOS
══════════════════════════════════════ */
function renderGastosLista(catMap){
  const el=$('gastosLista');if(!el)return;
  const cats=Object.entries(catMap).filter(([,v])=>v>0).sort(([,a],[,b])=>b-a);
  const tot=cats.reduce((s,[,v])=>s+v,0);
  if(!cats.length){el.innerHTML='<div class="est-empty"><i class="fa-solid fa-receipt"></i><p>Sin gastos registrados</p></div>';return;}
  el.innerHTML=cats.map(([cat,val])=>{
    const m=GASTO_META[cat]||GASTO_META.otros;
    return`<div class="est-gasto-row">
      <div class="est-gasto-ico" style="background:${m.bg};color:${m.col}"><i class="fa-solid ${m.ico}"></i></div>
      <span class="est-gasto-name">${cat}</span>
      <div class="est-gasto-bw"><div class="est-gasto-bf" style="width:${tot>0?(val/tot*100).toFixed(1):0}%;background:${m.col}"></div></div>
      <span class="est-gasto-val">${money(val)}</span>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   RENDER: DIAGNÓSTICO
══════════════════════════════════════ */
function renderDiag(vA,vB,comp,gast){
  const el=$('diagPanel');if(!el)return;
  const ing=vA+vB,bal=ing-comp-gast,m=ing>0?(ing-comp)/ing*100:0;
  const alerts=[];
  if(bal<0)        alerts.push({t:'red',  i:'fa-triangle-exclamation',msg:`<strong>Pérdida neta de ${money(Math.abs(bal))}</strong>. Los egresos superan a los ingresos. Revisá tu estructura de costos.`});
  else if(bal>0)   alerts.push({t:'green',i:'fa-circle-check',         msg:`<strong>Ganancia neta de ${money(bal)}</strong>. El negocio es rentable en este período.`});
  if(m<15&&ing>0)        alerts.push({t:'red',  i:'fa-arrow-trend-down',  msg:`<strong>Margen bruto bajo (${m.toFixed(1)}%)</strong>. El costo de mercadería consume demasiado de las ventas.`});
  else if(m>=30&&ing>0)  alerts.push({t:'green',i:'fa-thumbs-up',         msg:`<strong>Margen bruto saludable (${m.toFixed(1)}%)</strong>. La diferencia entre compra y venta es adecuada.`});
  else if(ing>0)         alerts.push({t:'gold', i:'fa-circle-info',       msg:`<strong>Margen moderado (${m.toFixed(1)}%)</strong>. Podés mejorar ajustando precios de venta o negociando con proveedores.`});
  if(ing>0&&comp/ing>0.8)alerts.push({t:'red', i:'fa-boxes-stacked', msg:`<strong>Alto ratio Compra/Venta (${(comp/ing*100).toFixed(1)}%)</strong>. Comprás casi todo lo que vendés. Revisá stock ocioso.`});
  if(ing>0&&gast/ing>0.3)alerts.push({t:'gold',i:'fa-coins',         msg:`<strong>Gastos operativos elevados (${(gast/ing*100).toFixed(1)}%)</strong>. Revisá gastos fijos: sueldos, alquiler, servicios.`});
  if(vA===0&&vB>0)       alerts.push({t:'gold',i:'fa-file-lines',    msg:`<strong>Sin ventas facturadas (A)</strong>. Todas las ventas son por presupuesto. Verificá si corresponde emitir facturas.`});
  if(comp===0&&ing>0)    alerts.push({t:'gold',i:'fa-boxes-stacked', msg:`<strong>Sin compras registradas</strong> en el período. ¿Están cargadas todas las facturas de proveedor?`});
  if(!alerts.length)     alerts.push({t:'gold',i:'fa-circle-info',   msg:'Datos insuficientes para diagnóstico. Cargá ventas, compras y gastos del período.'});
  const BG={red:'rgba(248,113,113,.07)',green:'rgba(52,211,153,.07)',gold:'rgba(245,200,66,.07)'};
  const CLR={red:'var(--red)',green:'var(--green)',gold:'var(--gold)'};
  el.innerHTML=alerts.map(a=>`<div class="est-diag-item" style="background:${BG[a.t]};border:1px solid ${CLR[a.t]}33"><i class="fa-solid ${a.i}" style="color:${CLR[a.t]}"></i><p>${a.msg}</p></div>`).join('');
}

/* ══════════════════════════════════════
   TOP PROVEEDORES
   GET /administracion/api/top-proveedores?desde&hasta&limit=10
   Devuelve: [{ id, nombre, total, total_a, total_b, cant_docs }]
   total_a = facturas de proveedor | total_b = presupuestos de proveedor
══════════════════════════════════════ */
async function getProveedores(desde, hasta) {
  const data = await soft(`/administracion/api/top-proveedores?desde=${desde}&hasta=${hasta}&limit=10`);
  if (!data || !Array.isArray(data) || !data.length) return [];
  return data
    .map(d => ({
      name:  String(d.nombre  || '?'),
      val:   Number(d.total   || 0),
      val_a: Number(d.total_a || 0),
      val_b: Number(d.total_b || 0),
      docs:  Number(d.cant_docs || 0)
    }))
    .filter(d => d.val > 0);
}

/* ══════════════════════════════════════
   TOP PRODUCTOS VENDIDOS
   Estrategia 1: /administracion/api/top-productos?desde&hasta&limit=15
   Estrategia 2: /administracion/api/documentos?tipo=factura&desde&hasta
                 + /administracion/api/factura/:id para items
   (las tablas son factura_items → facturas_mostrador y presupuesto_items → presupuestos_mostrador)
══════════════════════════════════════ */
async function getProductos(desde,hasta){
  // Estrategia 1: endpoint dedicado (agregar al sistema)
  const tp=await soft(`/administracion/api/top-productos?desde=${desde}&hasta=${hasta}&limit=15`);
  if(tp){
    const a=Array.isArray(tp)?tp:(tp.productos||tp.data||[]);
    if(a.length) return a.map(p=>({name:p.nombre||p.name||'?',val:Number(p.total_vendido||p.cantidad||0)})).filter(p=>p.val>0).sort((a,b)=>b.val-a.val);
  }

  // Estrategia 2: listar facturas de mostrador y cargar sus ítems
  const docs=await soft(`/administracion/api/documentos?desde=${desde}&hasta=${hasta}&tipo=factura`);
  if(docs){
    const facturas=Array.isArray(docs)?docs:(docs.facturas||docs.data||[]);
    if(facturas.length){
      const ids=facturas.slice(0,30).map(f=>f.id).filter(Boolean);
      const detalles=await Promise.all(ids.map(id=>soft(`/administracion/api/factura/${id}`)));
      const map={};
      detalles.forEach(d=>{
        if(!d)return;
        (d.items||d.detalles||[]).forEach(it=>{
          // En facturas_mostrador el producto tiene nombre en productos.nombre (join)
          const n=it.producto_nombre||it.nombre||it.descripcion||null;
          if(!n)return;
          map[n]=(map[n]||0)+Number(it.cantidad||1);
        });
      });
      const arr=Object.entries(map).map(([name,val])=>({name,val})).sort((a,b)=>b.val-a.val);
      if(arr.length)return arr;
    }
  }

  // Estrategia 3: facturas mostrador via productos router
  const fv=await soft(`/productos/api/facturas?fechaInicio=${desde}&fechaFin=${hasta}`);
  if(Array.isArray(fv)&&fv.length){
    const ids=fv.slice(0,30).map(f=>f.id).filter(Boolean);
    const det=await Promise.all(ids.map(id=>soft(`/productos/factura/${id}`)));
    const map={};
    det.forEach(d=>{if(!d)return;(d.items||[]).forEach(it=>{const n=it.nombre||it.descripcion||null;if(!n)return;map[n]=(map[n]||0)+Number(it.cantidad||1);});});
    return Object.entries(map).map(([name,val])=>({name,val})).sort((a,b)=>b.val-a.val);
  }
  return [];
}

/* ══════════════════════════════════════
   MAIN
══════════════════════════════════════ */
async function cargar(){
  const loading=$('estLoading'),errEl=$('estErr'),dash=$('estDash'),inicial=$('estInicial'),rangoEl=$('estRango'),rangoTxt=$('estRangoTxt');
  if(loading)loading.classList.add('on');
  if(errEl){errEl.classList.remove('on');errEl.textContent='';}
  const {desde,hasta,label}=getRango(),p=periodo;
  try{
    const qs=e=>new URLSearchParams({periodo:p,desde,hasta,...e}).toString();
    const [dVA,dVB,dVT,dCA,dCB,dGast]=await Promise.all([
      get(`/administracion/api/objetivos-ventas?${qs({tipo:'A'})}`),
      get(`/administracion/api/objetivos-ventas?${qs({tipo:'B'})}`),
      get(`/administracion/api/objetivos-ventas?${qs({tipo:'TOTAL'})}`),
      get(`/administracion/api/objetivos-compras?${qs({tipo:'A'})}`),
      get(`/administracion/api/objetivos-compras?${qs({tipo:'B'})}`),
      get(`/administracion/api/objetivos-gastos?${qs({categoria:''})}`)
    ]);
    const vA=dVA.totales?.A||dVA.totales?.TOTAL||0,vB=dVB.totales?.B||dVB.totales?.TOTAL||0;
    const cA=dCA.totales?.A||dCA.totales?.TOTAL||0,cB=dCB.totales?.B||dCB.totales?.TOTAL||0;
    const comp=cA+cB,gast=dGast.totales?.TOTAL||0;
    const rawL=dVT.series?.labels||dVT.series?.etiquetas||[];
    const evolL=rawL.map(l=>fmtL(l,p));
    const evolV=dVT.series?.TOTAL||[];
    const sCA=dCA.series?.TOTAL||dCA.series?.A||[],sCB=dCB.series?.TOTAL||dCB.series?.B||[];
    const evolC=sCA.map((v,i)=>(Number(v)||0)+(Number(sCB[i])||0));
    const evolG=dGast.series?.TOTAL||[];
    const CATS=['luz','agua','gas','municipalidad','rentas provincia','contador','empleados','alquiler','internet','limpieza','seguro','otros'];
    const gastosCat={};CATS.forEach(cat=>{gastosCat[cat]=Number(dGast.totales?.[cat]||0);});
    const [proveedores,productos]=await Promise.all([getProveedores(desde,hasta),getProductos(desde,hasta)]);

    renderKPIs(vA,vB,comp,gast);
    renderEvol(evolL,evolV,evolC,evolG,'linea');lastEvol={labels:evolL,ventas:evolV,compras:evolC,gastos:evolG};
    renderDoughnut('cVentasPie','legVentas',['Factura A','Presupuesto B'],[vA,vB],['#3b82f6','#a78bfa']);
    renderDoughnut('cComprasPie','legCompras',['Facturas A','Presupuestos B'],[cA,cB],['#f87171','#fb923c']);
    const gC=CATS.filter(k=>gastosCat[k]>0);
    renderDoughnut('cGastosPie','legGastos',gC,gC.map(k=>gastosCat[k]),gC.map((_,i)=>PALETTE[i%PALETTE.length]));
    renderGastosLista(gastosCat);
    renderRanking('rkProv', proveedores, money, true);
    renderRanking('rkProd',productos,n=>`${n} uds.`);
    renderDiag(vA,vB,comp,gast);

    if(inicial)inicial.style.display='none';
    if(dash)dash.style.display='block';
    if(rangoEl)rangoEl.classList.add('on');
    if(rangoTxt)rangoTxt.textContent=label;
  }catch(err){
    console.error('[Estadísticas]',err);
    if(errEl){errEl.textContent=`❌ ${err.message}`;errEl.classList.add('on');}
  }finally{if(loading)loading.classList.remove('on');}
}

document.querySelectorAll('#evolTabs .est-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('#evolTabs .est-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    if(lastEvol)renderEvol(lastEvol.labels,lastEvol.ventas,lastEvol.compras,lastEvol.gastos,btn.dataset.t);
  });
});
$('btnActualizar')?.addEventListener('click',cargar);

/* ═══════════════════════════════════════════════════════════════
   ENDPOINT NUEVO REQUERIDO — agregar al sistema:

   1. En administracion.js (router), agregar esta línea:
      router.get('/api/top-productos', administracionController.topProductos);

   2. En administracionController.js, agregar la función:
      topProductos: async (req, res) => {
        try {
          const conexion = require('../config/conexion');
          const { desde, hasta } = req.query;
          const limit = Math.min(parseInt(req.query.limit)||15, 50);
          const params = [];
          const fechaFiltroFac  = desde&&hasta ? 'WHERE fm.fecha BETWEEN ? AND ?' : '';
          const fechaFiltroPres = desde&&hasta ? 'WHERE pm.fecha BETWEEN ? AND ?' : '';
          if(desde&&hasta){ params.push(desde,hasta,desde,hasta); }
          const sql = `
            SELECT p.id, p.nombre, SUM(v.cantidad) AS total_vendido
            FROM (
              SELECT fi.producto_id, fi.cantidad
              FROM factura_items fi
              INNER JOIN facturas_mostrador fm ON fm.id = fi.factura_id
              ${fechaFiltroFac}
              UNION ALL
              SELECT pi.producto_id, pi.cantidad
              FROM presupuesto_items pi
              INNER JOIN presupuestos_mostrador pm ON pm.id = pi.presupuesto_id
              ${fechaFiltroPres}
            ) v
            INNER JOIN productos p ON p.id = v.producto_id
            GROUP BY p.id, p.nombre
            ORDER BY total_vendido DESC
            LIMIT ${limit}
          `;
          conexion.query(sql, params, (err, rows) => {
            if(err) return res.status(500).json({error: err.message});
            res.json(rows); // [{ id, nombre, total_vendido }]
          });
        } catch(e) { res.status(500).json({error: e.message}); }
      }
   ═══════════════════════════════════════════════════════════════ */