function prettifyRangeText(s) {
  return String(s || '')
    .replace(/\d{4}-\d{2}-\d{2}/g, (m) => { const [y,mm,dd] = m.split('-'); return `${dd}/${mm}/${y}`; });
}

// ==== Constantes y helpers ====
  const NOMBRES_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const pad = n => String(n).padStart(2,'0');
  const lastDayOfMonth = (year, month1to12) => new Date(year, month1to12, 0).getDate();
  const money = n => Number(n || 0).toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});

  // Helpers seguros contra null
  const show    = (el, visible=true) => { if (el) el.style.display = visible ? '' : 'none'; };
  const hide    = el => show(el, false);
  const setText = (el, txt='') => { if (el) el.textContent = txt; };

  // Rango de fechas
  function weekRangeOfMonth(year, month1to12, weekIndex1to5){
    const startDay = (weekIndex1to5 - 1) * 7 + 1;
    const endDay   = Math.min(weekIndex1to5 * 7, lastDayOfMonth(year, month1to12));
    const desde = `${year}-${pad(month1to12)}-${pad(startDay)}`;
    const hasta = `${year}-${pad(month1to12)}-${pad(endDay)}`;
    return { desde, hasta, label: `Semana ${weekIndex1to5} (${desde} → ${hasta})` };
  }
  function monthRange(year, month1to12){
    const desde = `${year}-${pad(month1to12)}-01`;
    const hasta = `${year}-${pad(month1to12)}-${pad(lastDayOfMonth(year, month1to12))}`;
    return { desde, hasta, label: `${year}-${pad(month1to12)}` };
  }
  const yearRange = year => ({ desde: `${year}-01-01`, hasta: `${year}-12-31`, label: `${year}` });

function toDMY(d) {
  const date = (d instanceof Date) ? d : new Date(d);
  if (isNaN(date)) return String(d);
  return `${pad(date.getDate())}/${pad(date.getMonth()+1)}/${date.getFullYear()}`;
}

function formatearEtiqueta(lbl, periodo){
  if (lbl == null) return '-';

  // Si ya es Date o timestamp → DD/MM/YYYY
  if (lbl instanceof Date) return toDMY(lbl);
  if (typeof lbl === 'number') return toDMY(new Date(lbl));

  // 'YYYY-MM' (anual) → nombre de mes
  if (periodo === 'anual' && /^\d{4}-\d{2}$/.test(lbl)) {
    const [,m] = String(lbl).split('-');
    const idx = Math.max(1, Math.min(12, parseInt(m,10))) - 1;
    return NOMBRES_MESES[idx];
  }

  // ISO 'YYYY-MM-DD...' → DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}/.test(lbl)) {
    return toDMY(String(lbl).slice(0,10));
  }

  // 'YYYY-MM' → 'MM/YYYY'
  if (/^\d{4}-\d{2}$/.test(lbl)) {
    const [y,m] = String(lbl).split('-');
    return `${m}/${y}`;
  }

  if (/^\d{4}$/.test(lbl)) return String(lbl);
  if (/^\d{4}-W\d{2}$/.test(lbl)) {
    const [y,w] = String(lbl).split('-W'); return `Sem ${w} / ${y}`;
  }

  // Fallback: si se puede parsear como fecha → DD/MM/YYYY
  const maybe = new Date(lbl);
  if (!isNaN(maybe)) return toDMY(maybe);

  return String(lbl);
}


  // Colores de barras
  const defaultBar = 'rgba(99, 132, 255, 0.6)';
  const maxBar     = 'rgba(52, 211, 153, 0.85)';
  const minBar     = 'rgba(248, 113, 113, 0.85)';

  // =====================================================================
  // ============================ COMPRAS ================================
  // =====================================================================
  let chartSerie = null;

  // DOM COMPRAS
  const $tipo       = document.getElementById('tipo');
  const $periodo    = document.getElementById('periodo');
  const $subfiltros = document.getElementById('subfiltros');
  const $boxSem     = document.getElementById('boxSemanal');
  const $anSem      = document.getElementById('anSem');
  const $mesSem     = document.getElementById('mesSem');
  const $semanaMes  = document.getElementById('semanaMes');
  const $boxMen     = document.getElementById('boxMensual');
  const $anMen      = document.getElementById('anMen');
  const $mesMen     = document.getElementById('mesMen');
  const $boxAnu     = document.getElementById('boxAnual');
  const $anAnu      = document.getElementById('anAnu');
  const $btnBuscar  = document.getElementById('btnBuscar');

  const $estado     = document.getElementById('estado'); // puede no existir
  const $error      = document.getElementById('error');

  const $resultados = document.getElementById('resultados');
  const $lblRango   = document.getElementById('lblRango');
  const $lblTipo    = document.getElementById('lblTipo');
  const $kpiTotal   = document.getElementById('kpiTotal');

  const $wrapA      = document.getElementById('wrapA');
  const $wrapB      = document.getElementById('wrapB');
  const $wrapTOTAL  = document.getElementById('wrapTOTAL');
  const $totA       = document.getElementById('totA');
  const $totB       = document.getElementById('totB');
  const $totTotal   = document.getElementById('totTotal');

  const $tablaWrap    = document.getElementById('tablaWrap');
  const $resumenSerie = document.getElementById('resumenSerie');
  const $chartCanvas  = document.getElementById('chartSerie');

  // Años/meses COMPRAS
  (function fillYearMonthCompras(){
    const now = new Date();
    const thisYear = now.getFullYear();
    const years = []; for(let y=thisYear; y>=thisYear-6; y--) years.push(y);

    [$anSem,$anMen,$anAnu].forEach(sel=>{
      if (sel) sel.innerHTML = years.map(y=>`<option value="${y}">${y}</option>`).join('');
    });
    const meses = Array.from({length:12}, (_,i)=>i+1);
    [$mesSem,$mesMen].forEach(sel=>{
      if (sel) sel.innerHTML = meses.map(m=>`<option value="${m}">${pad(m)}</option>`).join('');
    });

    if ($anSem) $anSem.value = thisYear; if ($anMen) $anMen.value = thisYear; if ($anAnu) $anAnu.value = thisYear;
    if ($mesSem) $mesSem.value = now.getMonth()+1; if ($mesMen) $mesMen.value = now.getMonth()+1;
  })();

  function onPeriodoChangeCompras(){
    const p = $periodo ? $periodo.value : '';
    hide($subfiltros); hide($boxSem); hide($boxMen); hide($boxAnu);
    if(!p){ setText($estado, ''); return; }
    show($subfiltros);
    if (p === 'semanal') show($boxSem);
    if (p === 'mensual') show($boxMen);
    if (p === 'anual')   show($boxAnu);
    setText($estado, '');
  }
  if ($periodo) $periodo.addEventListener('change', onPeriodoChangeCompras);

  async function buscarCompras(){
    hide($error); setText($error,'');
    hide($resultados); hide($tablaWrap);
    setText($estado, '');

    const periodo = $periodo ? $periodo.value : '';
    if(!periodo){ setText($estado,''); return; }

    let desde='', hasta='', labelRango='';
    if (periodo === 'semanal') {
      const r = weekRangeOfMonth(parseInt($anSem.value,10), parseInt($mesSem.value,10), parseInt($semanaMes.value,10));
      ({desde, hasta, labelRango} = r);
    } else if (periodo === 'mensual') {
      const r = monthRange(parseInt($anMen.value,10), parseInt($mesMen.value,10));
      ({desde, hasta, labelRango} = r);
    } else if (periodo === 'anual') {
      const r = yearRange(parseInt($anAnu.value,10));
      ({desde, hasta, labelRango} = r);
    }
    const tipo = $tipo ? $tipo.value : 'TOTAL';

    try{
      const qs = new URLSearchParams({ periodo, tipo, desde, hasta }).toString();
      const res = await fetch(`/administracion/api/objetivos-compras?${qs}`);
      const data = await res.json();
      if(!res.ok || !data.ok) throw new Error(data.error || 'Error al calcular series.');

      // KPIs
      setText($lblRango, labelRango);
      setText($lblTipo,  (tipo === 'TOTAL' ? 'AMBOS' : tipo));
      show($wrapA); show($wrapB); show($wrapTOTAL);
      if (tipo === 'A') {
        setText($kpiTotal, money(data.totales.A));
        setText($totA,     money(data.totales.A));
        hide($wrapB); hide($wrapTOTAL);
      } else if (tipo === 'B') {
        setText($kpiTotal, money(data.totales.B));
        setText($totB,     money(data.totales.B));
        hide($wrapA); hide($wrapTOTAL);
      } else {
        setText($kpiTotal, money(data.totales.TOTAL));
        setText($totA,     money(data.totales.A));
        setText($totB,     money(data.totales.B));
        setText($totTotal, money(data.totales.TOTAL));
      }

      // Serie
      let labels = data.series.labels || [];
      let serie  = (tipo === 'A') ? (data.series.A||[])
                : (tipo === 'B') ? (data.series.B||[])
                : (data.series.TOTAL||[]);

      // Anual normalizado a 12 meses
      if (periodo === 'anual') {
        const year = parseInt($anAnu.value, 10);
        const monthKeys = Array.from({length:12}, (_,i)=> `${year}-${String(i+1).padStart(2,'0')}`);
        const acc = new Map(monthKeys.map(k => [k, 0]));
        for (let i = 0; i < labels.length; i++) {
          const key = String(labels[i] || '').slice(0,7);
          if (acc.has(key)) acc.set(key, acc.get(key) + Number(serie[i] || 0));
        }
        labels = monthKeys;
        serie  = monthKeys.map(k => acc.get(k) || 0);
      }

      const labelsFmt = labels.map(l => formatearEtiqueta(l, periodo));
      show($tablaWrap);
      if (!labels.length) {
        if (chartSerie) { chartSerie.destroy(); chartSerie = null; }
        setText($resumenSerie, 'Sin datos para los filtros seleccionados.');
      } else {
        let maxVal=-Infinity, minVal=Infinity, iMax=-1, iMin=-1;
        for (let i=0;i<serie.length;i++){
          const v = Number(serie[i]||0);
          if (v>maxVal){maxVal=v;iMax=i;}
          if (v<minVal){minVal=v;iMin=i;}
        }
        const bgColors = serie.map((_, i) => i===iMax? maxBar : (i===iMin? minBar : defaultBar));
        const maxLabel = labelsFmt[iMax] ?? '-';
        const minLabel = labelsFmt[iMin] ?? '-';
        setText($resumenSerie, `Máximo: ${maxLabel} (${money(maxVal)}) · Mínimo: ${minLabel} (${money(minVal)})`);

        if (chartSerie) chartSerie.destroy();
        const ctx = $chartCanvas.getContext('2d');
        chartSerie = new Chart(ctx, {
          type: 'bar',
          data: { labels: labelsFmt, datasets: [{ label: `Compras (${tipo==='TOTAL'?'AMBOS':tipo})`, data: serie, backgroundColor: bgColors, borderWidth: 1 }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c) => money(c.parsed.y) } }
            },
            scales: {
              x: { ticks: { color: '#e7eefc' }, grid: { color: 'rgba(255,255,255,0.08)' }, border:{ color:'rgba(255,255,255,0.20)' } },
              y: { beginAtZero: true, ticks: { color: '#e7eefc', callback: v => money(v) }, grid:{ color:'rgba(255,255,255,0.08)' }, border:{ color:'rgba(255,255,255,0.20)' } }
            },
            datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.9, maxBarThickness: 32 } }
          }
        });
      }

      show($resultados);
      setText($estado, '');
    }catch(e){
      console.error(e);
      setText($estado,'');
      setText($error, `❌ ${e.message}`); show($error);
    }
  }
  if ($btnBuscar) $btnBuscar.addEventListener('click', buscarCompras);
  onPeriodoChangeCompras();

  // =====================================================================
  // ============================== VENTAS ================================
  // =====================================================================
  let vChart = null;

  // DOM VENTAS
  const $vTipo       = document.getElementById('v-tipo');
  const $vPeriodo    = document.getElementById('v-periodo');
  const $vSubfiltros = document.getElementById('v-subfiltros');
  const $vBoxSem     = document.getElementById('v-boxSemanal');
  const $vAnSem      = document.getElementById('v-anSem');
  const $vMesSem     = document.getElementById('v-mesSem');
  const $vSemanaMes  = document.getElementById('v-semanaMes');
  const $vBoxMen     = document.getElementById('v-boxMensual');
  const $vAnMen      = document.getElementById('v-anMen');
  const $vMesMen     = document.getElementById('v-mesMen');
  const $vBoxAnu     = document.getElementById('v-boxAnual');
  const $vAnAnu      = document.getElementById('v-anAnu');
  const $vBtnBuscar  = document.getElementById('v-btnBuscar');

  const $vEstado     = document.getElementById('v-estado'); // puede no existir
  const $vError      = document.getElementById('v-error');

  const $vResultados = document.getElementById('v-resultados');
  const $vLblRango   = document.getElementById('v-lblRango');
  const $vLblTipo    = document.getElementById('v-lblTipo');
  const $vKpiTotal   = document.getElementById('v-kpiTotal');

  const $vWrapA      = document.getElementById('v-wrapA');
  const $vWrapB      = document.getElementById('v-wrapB');
  const $vWrapTOTAL  = document.getElementById('v-wrapTOTAL');
  const $vTotA       = document.getElementById('v-totA');
  const $vTotB       = document.getElementById('v-totB');
  const $vTotTotal   = document.getElementById('v-totTotal');

  const $vTablaWrap    = document.getElementById('v-tablaWrap');
  const $vResumenSerie = document.getElementById('v-resumenSerie');
  const $vChartCanvas  = document.getElementById('v-chartSerie');

  // Años/meses VENTAS
  (function vFillYearMonth(){
    const now = new Date();
    const thisYear = now.getFullYear();
    const years = []; for(let y=thisYear; y>=thisYear-6; y--) years.push(y);

    [$vAnSem,$vAnMen,$vAnAnu].forEach(sel=>{
      if (sel) sel.innerHTML = years.map(y=>`<option value="${y}">${y}</option>`).join('');
    });
    const meses = Array.from({length:12}, (_,i)=>i+1);
    [$vMesSem,$vMesMen].forEach(sel=>{
      if (sel) sel.innerHTML = meses.map(m=>`<option value="${m}">${pad(m)}</option>`).join('');
    });

    if ($vAnSem) $vAnSem.value = thisYear; if ($vAnMen) $vAnMen.value = thisYear; if ($vAnAnu) $vAnAnu.value = thisYear;
    if ($vMesSem) $vMesSem.value = now.getMonth()+1; if ($vMesMen) $vMesMen.value = now.getMonth()+1;
  })();

  function onPeriodoChangeVentas(){
    const p = $vPeriodo ? $vPeriodo.value : '';
    hide($vSubfiltros); hide($vBoxSem); hide($vBoxMen); hide($vBoxAnu);
    if(!p){ setText($vEstado, ''); return; }
    show($vSubfiltros);
    if (p === 'semanal') show($vBoxSem);
    if (p === 'mensual') show($vBoxMen);
    if (p === 'anual')   show($vBoxAnu);
    setText($vEstado, '');
  }
  if ($vPeriodo) $vPeriodo.addEventListener('change', onPeriodoChangeVentas);

  async function buscarVentas(){
    hide($vError); setText($vError,'');
    hide($vResultados); hide($vTablaWrap);
    setText($vEstado, '');

    const periodo = $vPeriodo ? $vPeriodo.value : '';
    if(!periodo){ setText($vEstado, ''); return; }

    let desde='', hasta='', labelRango='';
    if (periodo === 'semanal') {
      const r = weekRangeOfMonth(parseInt($vAnSem.value,10), parseInt($vMesSem.value,10), parseInt($vSemanaMes.value,10));
      ({desde, hasta, labelRango} = r);
    } else if (periodo === 'mensual') {
      const r = monthRange(parseInt($vAnMen.value,10), parseInt($vMesMen.value,10));
      ({desde, hasta, labelRango} = r);
    } else if (periodo === 'anual') {
      const r = yearRange(parseInt($vAnAnu.value,10));
      ({desde, hasta, labelRango} = r);
    }
    const tipo = $vTipo ? $vTipo.value : 'TOTAL';

    try{
      const qs = new URLSearchParams({ periodo, tipo, desde, hasta }).toString();
      const res = await fetch(`/administracion/api/objetivos-ventas?${qs}`);
      const data = await res.json();
      if(!res.ok || !data.ok) throw new Error(data.error || 'Error al calcular series.');

      // KPIs
      setText($vLblRango, labelRango);
      setText($vLblTipo,  (tipo === 'TOTAL' ? 'AMBOS' : tipo));
      show($vWrapA); show($vWrapB); show($vWrapTOTAL);
      if (tipo === 'A') {
        setText($vKpiTotal, money(data.totales.A));
        setText($vTotA,     money(data.totales.A));
        hide($vWrapB); hide($vWrapTOTAL);
      } else if (tipo === 'B') {
        setText($vKpiTotal, money(data.totales.B));
        setText($vTotB,     money(data.totales.B));
        hide($vWrapA); hide($vWrapTOTAL);
      } else {
        setText($vKpiTotal, money(data.totales.TOTAL));
        setText($vTotA,     money(data.totales.A));
        setText($vTotB,     money(data.totales.B));
        setText($vTotTotal, money(data.totales.TOTAL));
      }

      // Serie
      let labels = data.series.labels || [];
      let serie  = (tipo === 'A') ? (data.series.A||[])
                : (tipo === 'B') ? (data.series.B||[])
                : (data.series.TOTAL||[]);

      if (periodo === 'anual') {
        const year = parseInt($vAnAnu.value, 10);
        const monthKeys = Array.from({length:12}, (_,i)=> `${year}-${String(i+1).padStart(2,'0')}`);
        const acc = new Map(monthKeys.map(k => [k, 0]));
        for (let i = 0; i < labels.length; i++) {
          const key = String(labels[i] || '').slice(0,7);
          if (acc.has(key)) acc.set(key, acc.get(key) + Number(serie[i] || 0));
        }
        labels = monthKeys;
        serie  = monthKeys.map(k => acc.get(k) || 0);
      }

      const labelsFmt = labels.map(l => formatearEtiqueta(l, periodo));
      show($vTablaWrap);
      if (!labels.length) {
        if (vChart) { vChart.destroy(); vChart = null; }
        setText($vResumenSerie, 'Sin datos para los filtros seleccionados.');
      } else {
        let maxVal=-Infinity, minVal=Infinity, iMax=-1, iMin=-1;
        for (let i=0;i<serie.length;i++){
          const v = Number(serie[i]||0);
          if (v>maxVal){maxVal=v;iMax=i;}
          if (v<minVal){minVal=v;iMin=i;}
        }
        const bgColors = serie.map((_, i) => i===iMax? maxBar : (i===iMin? minBar : defaultBar));
        const maxLabel = labelsFmt[iMax] ?? '-';
        const minLabel = labelsFmt[iMin] ?? '-';
        setText($vResumenSerie, `Máximo: ${maxLabel} (${money(maxVal)}) · Mínimo: ${minLabel} (${money(minVal)})`);

        if (vChart) vChart.destroy();
        const ctx = $vChartCanvas.getContext('2d');
        vChart = new Chart(ctx, {
          type: 'bar',
          data: { labels: labelsFmt, datasets: [{ label: `Ventas (${tipo==='TOTAL'?'AMBOS':tipo})`, data: serie, backgroundColor: bgColors, borderWidth: 1 }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c) => money(c.parsed.y) } }
            },
            scales: {
              x: { ticks: { color: '#e7eefc' }, grid: { color: 'rgba(255,255,255,0.08)' }, border:{ color:'rgba(255,255,255,0.20)' } },
              y: { beginAtZero: true, ticks: { color: '#e7eefc', callback: v => money(v) }, grid:{ color:'rgba(255,255,255,0.08)' }, border:{ color:'rgba(255,255,255,0.20)' } }
            },
            datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.9, maxBarThickness: 32 } }
          }
        });
      }

      show($vResultados);
      setText($vEstado, '');
    }catch(e){
      console.error(e);
      setText($vEstado, '');
      setText($vError, `❌ ${e.message}`); show($vError);
    }
  }
  if ($vBtnBuscar) $vBtnBuscar.addEventListener('click', buscarVentas);
  onPeriodoChangeVentas();

  // ============================== GASTOS ================================
  let gChart = null;

  // DOM GASTOS
  const $gCategoria = document.getElementById('g-categoria');
  const $gPeriodo   = document.getElementById('g-periodo');
  const $gSub       = document.getElementById('g-subfiltros');
  const $gBoxSem    = document.getElementById('g-boxSemanal');
  const $gAnSem     = document.getElementById('g-anSem');
  const $gMesSem    = document.getElementById('g-mesSem');
  const $gSemanaMes = document.getElementById('g-semanaMes');
  const $gBoxMen    = document.getElementById('g-boxMensual');
  const $gAnMen     = document.getElementById('g-anMen');
  const $gMesMen    = document.getElementById('g-mesMen');
  const $gBoxAnu    = document.getElementById('g-boxAnual');
  const $gAnAnu     = document.getElementById('g-anAnu');
  const $gBtn       = document.getElementById('g-btnBuscar');

  const $gError     = document.getElementById('g-error');
  const $gRes       = document.getElementById('g-resultados');
  const $gLblRango  = document.getElementById('g-lblRango');
  const $gLblCat    = document.getElementById('g-lblCat');
  const $gKpi       = document.getElementById('g-kpiTotal');

  const $gWrap      = document.getElementById('g-tablaWrap');
  const $gResumen   = document.getElementById('g-resumenSerie');
  const $gCanvas    = document.getElementById('g-chartSerie');

  // Relleno años/meses GASTOS
  (function gFillYM(){
    const now = new Date();
    const thisYear = now.getFullYear();
    const years = []; for (let y=thisYear; y>=thisYear-6; y--) years.push(y);

    [$gAnSem, $gAnMen, $gAnAnu].forEach(sel => { if (sel) sel.innerHTML = years.map(y=>`<option value="${y}">${y}</option>`).join(''); });
    const meses = Array.from({length:12}, (_,i)=>i+1);
    [$gMesSem, $gMesMen].forEach(sel => { if (sel) sel.innerHTML = meses.map(m=>`<option value="${m}">${(m+'').padStart(2,'0')}</option>`).join(''); });

    if ($gAnSem) $gAnSem.value=thisYear; if ($gAnMen) $gAnMen.value=thisYear; if ($gAnAnu) $gAnAnu.value=thisYear;
    if ($gMesSem) $gMesSem.value = now.getMonth()+1; if ($gMesMen) $gMesMen.value = now.getMonth()+1;
  })();

  function onPeriodoChangeGastos(){
    const p = $gPeriodo ? $gPeriodo.value : '';
    hide($gSub); hide($gBoxSem); hide($gBoxMen); hide($gBoxAnu);
    if (!p) return;
    show($gSub);
    if (p==='semanal') show($gBoxSem);
    if (p==='mensual') show($gBoxMen);
    if (p==='anual')   show($gBoxAnu);
  }
  if ($gPeriodo) $gPeriodo.addEventListener('change', onPeriodoChangeGastos);

  async function buscarGastos(){
    hide($gError); setText($gError,'');
    hide($gRes); hide($gWrap);

    const periodo = $gPeriodo ? $gPeriodo.value : '';
    if (!periodo) return;

    const categoria = $gCategoria ? $gCategoria.value : '';

    let desde='', hasta='', labelRango='';
    if (periodo === 'semanal') {
      const r = weekRangeOfMonth(parseInt($gAnSem.value,10), parseInt($gMesSem.value,10), parseInt($gSemanaMes.value,10));
      ({desde, hasta, labelRango} = r);
    } else if (periodo === 'mensual') {
      const r = monthRange(parseInt($gAnMen.value,10), parseInt($gMesMen.value,10));
      ({desde, hasta, labelRango} = r);
    } else if (periodo === 'anual') {
      const r = yearRange(parseInt($gAnAnu.value,10));
      ({desde, hasta, labelRango} = r);
    }

    try{
      const qs = new URLSearchParams({ periodo, categoria, desde, hasta }).toString();
      const res = await fetch(`/administracion/api/objetivos-gastos?${qs}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al calcular series.');

      // KPIs
      const firstLabelFmt = (data.series?.etiquetas?.[0] != null) ? formatearEtiqueta(data.series.etiquetas[0], periodo) : '-';
setText($gLblRango, prettifyRangeText(labelRango || firstLabelFmt));

      setText($gLblCat, categoria || 'TODAS');
      setText($gKpi, money(data.totales?.TOTAL || 0));

      // Serie
      const labels = data.series?.etiquetas || [];
      const serie  = data.series?.TOTAL || [];

      show($gWrap);
      if (!labels.length) {
        if (gChart) { gChart.destroy(); gChart = null; }
        setText($gResumen, 'Sin datos para los filtros seleccionados.');
      } else {
        let maxVal=-Infinity, minVal=Infinity, iMax=-1, iMin=-1;
        for (let i=0;i<serie.length;i++){
          const v = Number(serie[i]||0);
          if (v>maxVal){maxVal=v;iMax=i;}
          if (v<minVal){minVal=v;iMin=i;}
        }
        const labelsFmt = (labels || []).map(l => formatearEtiqueta(l, periodo));

        const bgColors = serie.map((_, i) => i===iMax? 'rgba(52, 211, 153, 0.85)' : (i===iMin? 'rgba(248, 113, 113, 0.85)' : 'rgba(99, 132, 255, 0.6)'));
        setText($gResumen, `Máximo: ${labelsFmt[iMax] ?? '-'} (${money(maxVal)}) · Mínimo: ${labelsFmt[iMin] ?? '-'} (${money(minVal)})`);

        if (gChart) gChart.destroy();
        const ctx = $gCanvas.getContext('2d');
        gChart = new Chart(ctx, {
          type: 'bar',
          data: { labels: labelsFmt, datasets: [{ label: `Gastos ${categoria || 'TODAS'}`, data: serie, backgroundColor: bgColors, borderWidth: 1 }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c) => money(c.parsed.y) } }
            },
            scales: {
              x: { ticks: { color: '#e7eefc' }, grid: { color: 'rgba(255,255,255,0.08)' }, border:{ color:'rgba(255,255,255,0.20)' } },
              y: { beginAtZero: true, ticks: { color: '#e7eefc', callback: v => money(v) }, grid:{ color:'rgba(255,255,255,0.08)' }, border:{ color:'rgba(255,255,255,0.20)' } }
            },
            datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.9, maxBarThickness: 32 } }
          }
        });
      }

      show($gRes);
    } catch(e){
      console.error(e);
      setText($gError, `❌ ${e.message}`); show($gError);
    }
  }
  if ($gBtn) $gBtn.addEventListener('click', buscarGastos);
  onPeriodoChangeGastos();