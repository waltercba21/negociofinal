  // ==== Constantes para formateo ====
  const NOMBRES_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // === Formateo de etiquetas (fechas) ===
  function formatearEtiqueta(lbl, periodo){
    if (!lbl) return '-';

    // Anual con buckets YYYY-MM => nombre de mes
    if (periodo === 'anual' && /^\d{4}-\d{2}$/.test(lbl)) {
      const [,m] = lbl.split('-');
      const idx = Math.max(1, Math.min(12, parseInt(m,10))) - 1;
      return NOMBRES_MESES[idx];
    }

    // ISO 'YYYY-MM-DD' o con 'T...Z'
    const isoDateMatch = /^\d{4}-\d{2}-\d{2}/.test(lbl) || /T\d{2}:\d{2}:\d{2}/.test(lbl);
    if (isoDateMatch) {
      const d = new Date(lbl);
      if (!isNaN(d)) {
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
        const yy = d.getFullYear();
        return `${dd}/${mm}/${yy}`;
      }
    }

    // 'YYYY-MM' => 'MM/YYYY'
    if (/^\d{4}-\d{2}$/.test(lbl)) {
      const [y,m] = lbl.split('-');
      return `${m}/${y}`;
    }

    if (/^\d{4}$/.test(lbl)) return lbl;                     // 'YYYY'
    if (/^\d{4}-W\d{2}$/.test(lbl)) {                        // 'YYYY-Wxx'
      const [y,w] = lbl.split('-W'); return `Sem ${w} / ${y}`;
    }
    return lbl;
  }

  // ==== Helpers de fecha y dinero ====
  function pad(n){ return String(n).padStart(2,'0'); }
  function lastDayOfMonth(year, month1to12){ return new Date(year, month1to12, 0).getDate(); }
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
  function yearRange(year){ return { desde: `${year}-01-01`, hasta: `${year}-12-31`, label: `${year}` }; }
  function money(n){ return Number(n || 0).toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}); }

  // =====================================================================
  // ============================ COMPRAS ================================
  // =====================================================================
  let chartSerie = null;
  const defaultBar = 'rgba(99, 132, 255, 0.6)';
  const maxBar     = 'rgba(52, 211, 153, 0.85)';
  const minBar     = 'rgba(248, 113, 113, 0.85)';

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

  const $estado     = document.getElementById('estado');
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

  // Relleno años/meses COMPRAS
  (function fillYearMonthCompras(){
    const now = new Date();
    const thisYear = now.getFullYear();
    const years = [];
    for(let y=thisYear; y>=thisYear-6; y--) years.push(y);

    [$anSem,$anMen,$anAnu].forEach(sel=>{
      sel.innerHTML = years.map(y=>`<option value="${y}">${y}</option>`).join('');
    });
    const meses = Array.from({length:12}, (_,i)=>i+1);
    [$mesSem,$mesMen].forEach(sel=>{
      sel.innerHTML = meses.map(m=>`<option value="${m}">${pad(m)}</option>`).join('');
    });

    $anSem.value = thisYear; $anMen.value = thisYear; $anAnu.value = thisYear;
    $mesSem.value = now.getMonth()+1; $mesMen.value = now.getMonth()+1;
  })();

  function onPeriodoChangeCompras(){
    const p = $periodo.value;
    $subfiltros.style.display = 'none';
    $boxSem.style.display = 'none';
    $boxMen.style.display = 'none';
    $boxAnu.style.display = 'none';
    if(!p){ $estado.textContent=''; return; }
    $subfiltros.style.display = '';
    if (p === 'semanal') $boxSem.style.display = '';
    if (p === 'mensual') $boxMen.style.display = '';
    if (p === 'anual')   $boxAnu.style.display = '';
    $estado.textContent = '';
  }
  $periodo.addEventListener('change', onPeriodoChangeCompras);

  async function buscarCompras(){
    $error.style.display='none'; $error.textContent='';
    $resultados.style.display='none'; $tablaWrap.style.display='none';
    $estado.textContent = '';

    const periodo = $periodo.value;
    if(!periodo){ $estado.textContent=''; return; }

    let desde='', hasta='', labelRango='';
    if (periodo === 'semanal') {
      const r = weekRangeOfMonth(parseInt($anSem.value,10), parseInt($mesSem.value,10), parseInt($semanaMes.value,10));
      desde = r.desde; hasta = r.hasta; labelRango = r.label;
    } else if (periodo === 'mensual') {
      const r = monthRange(parseInt($anMen.value,10), parseInt($mesMen.value,10));
      desde = r.desde; hasta = r.hasta; labelRango = r.label;
    } else if (periodo === 'anual') {
      const r = yearRange(parseInt($anAnu.value,10));
      desde = r.desde; hasta = r.hasta; labelRango = r.label;
    }
    const tipo = $tipo.value;

    try{
      const qs = new URLSearchParams({ periodo, tipo, desde, hasta }).toString();
      const res = await fetch(`/administracion/api/objetivos-compras?${qs}`);
      const data = await res.json();
      if(!res.ok || !data.ok) throw new Error(data.error || 'Error al calcular series.');

      // KPIs
      $lblRango.textContent = labelRango;
      $lblTipo.textContent  = (tipo === 'TOTAL' ? 'AMBOS' : tipo);
      $wrapA.style.display=''; $wrapB.style.display=''; $wrapTOTAL.style.display='';
      if (tipo === 'A') {
        $kpiTotal.textContent = money(data.totales.A);
        $totA.textContent     = money(data.totales.A);
        $wrapB.style.display  = 'none';
        $wrapTOTAL.style.display = 'none';
      } else if (tipo === 'B') {
        $kpiTotal.textContent = money(data.totales.B);
        $totB.textContent     = money(data.totales.B);
        $wrapA.style.display  = 'none';
        $wrapTOTAL.style.display = 'none';
      } else {
        $kpiTotal.textContent = money(data.totales.TOTAL);
        $totA.textContent     = money(data.totales.A);
        $totB.textContent     = money(data.totales.B);
        $totTotal.textContent = money(data.totales.TOTAL);
      }

      // Serie
      let labels = data.series.labels || [];
      let serie  = (tipo === 'A') ? (data.series.A||[])
                : (tipo === 'B') ? (data.series.B||[])
                : (data.series.TOTAL||[]);

      // Anual: 12 meses exactos y ordenados
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
      $tablaWrap.style.display  = '';
      if (!labels.length) {
        if (chartSerie) { chartSerie.destroy(); chartSerie = null; }
        $resumenSerie.textContent = 'Sin datos para los filtros seleccionados.';
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
        $resumenSerie.textContent = `Máximo: ${maxLabel} (${money(maxVal)}) · Mínimo: ${minLabel} (${money(minVal)})`;

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
  x: {
    ticks: { color: '#e7eefc' },                      // etiquetas bajo el gráfico (BLANCO)
    grid:  { color: 'rgba(255,255,255,0.08)' },       // líneas verticales suaves
    border:{ color: 'rgba(255,255,255,0.20)' }        // eje X
  },
  y: {
    beginAtZero: true,
    ticks: { color: '#e7eefc', callback: v => money(v) }, // valores del eje Y (BLANCO)
    grid:  { color: 'rgba(255,255,255,0.08)' },           // líneas horizontales suaves
    border:{ color: 'rgba(255,255,255,0.20)' }            // eje Y
  }
},
            datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.9, maxBarThickness: 32 } }
          }
        });
      }

      $resultados.style.display = '';
      $estado.textContent = ''; // (antes mostraba "Listo (...) barra(s)")
    }catch(e){
      console.error(e);
      $estado.textContent='';   // sin mensaje en estado
      $error.textContent = `❌ ${e.message}`;
      $error.style.display='block';
    }
  }
  document.getElementById('btnBuscar').addEventListener('click', buscarCompras);
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

  const $vEstado     = document.getElementById('v-estado');
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

  // Relleno años/meses VENTAS
  (function vFillYearMonth(){
    const now = new Date();
       const thisYear = now.getFullYear();
    const years = [];
    for(let y=thisYear; y>=thisYear-6; y--) years.push(y);

    [$vAnSem,$vAnMen,$vAnAnu].forEach(sel=>{
      sel.innerHTML = years.map(y=>`<option value="${y}">${y}</option>`).join('');
    });
    const meses = Array.from({length:12}, (_,i)=>i+1);
    [$vMesSem,$vMesMen].forEach(sel=>{
      sel.innerHTML = meses.map(m=>`<option value="${m}">${pad(m)}</option>`).join('');
    });

    $vAnSem.value = thisYear; $vAnMen.value = thisYear; $vAnAnu.value = thisYear;
    $vMesSem.value = now.getMonth()+1; $vMesMen.value = now.getMonth()+1;
  })();

  function onPeriodoChangeVentas(){
    const p = $vPeriodo.value;
    $vSubfiltros.style.display = 'none';
    $vBoxSem.style.display = 'none';
    $vBoxMen.style.display = 'none';
    $vBoxAnu.style.display = 'none';
    if(!p){ $vEstado.textContent = ''; return; }
    $vSubfiltros.style.display = '';
    if (p === 'semanal') $vBoxSem.style.display = '';
    if (p === 'mensual') $vBoxMen.style.display = '';
    if (p === 'anual')   $vBoxAnu.style.display = '';
    $vEstado.textContent = '';
  }
  $vPeriodo.addEventListener('change', onPeriodoChangeVentas);

  async function buscarVentas(){
    $vError.style.display='none'; $vError.textContent='';
    $vResultados.style.display='none'; $vTablaWrap.style.display='none';
    $vEstado.textContent = '';

    const periodo = $vPeriodo.value;
    if(!periodo){ $vEstado.textContent = ''; return; }

    let desde='', hasta='', labelRango='';
    if (periodo === 'semanal') {
      const r = weekRangeOfMonth(parseInt($vAnSem.value,10), parseInt($vMesSem.value,10), parseInt($vSemanaMes.value,10));
      desde = r.desde; hasta = r.hasta; labelRango = r.label;
    } else if (periodo === 'mensual') {
      const r = monthRange(parseInt($vAnMen.value,10), parseInt($vMesMen.value,10));
      desde = r.desde; hasta = r.hasta; labelRango = r.label;
    } else if (periodo === 'anual') {
      const r = yearRange(parseInt($vAnAnu.value,10));
      desde = r.desde; hasta = r.hasta; labelRango = r.label;
    }
    const tipo = $vTipo.value;

    try{
      const qs = new URLSearchParams({ periodo, tipo, desde, hasta }).toString();
      const res = await fetch(`/administracion/api/objetivos-ventas?${qs}`);
      const data = await res.json();
      if(!res.ok || !data.ok) throw new Error(data.error || 'Error al calcular series.');

      // KPIs
      $vLblRango.textContent = labelRango;
      $vLblTipo.textContent  = (tipo === 'TOTAL' ? 'AMBOS' : tipo);
      $vWrapA.style.display=''; $vWrapB.style.display=''; $vWrapTOTAL.style.display='';
      if (tipo === 'A') {
        $vKpiTotal.textContent = money(data.totales.A);
        $vTotA.textContent     = money(data.totales.A);
        $vWrapB.style.display  = 'none';
        $vWrapTOTAL.style.display = 'none';
      } else if (tipo === 'B') {
        $vKpiTotal.textContent = money(data.totales.B);
        $vTotB.textContent     = money(data.totales.B);
        $vWrapA.style.display  = 'none';
        $vWrapTOTAL.style.display = 'none';
      } else {
        $vKpiTotal.textContent = money(data.totales.TOTAL);
        $vTotA.textContent     = money(data.totales.A);
        $vTotB.textContent     = money(data.totales.B);
        $vTotTotal.textContent = money(data.totales.TOTAL);
      }

      // Serie
      let labels = data.series.labels || [];
      let serie  = (tipo === 'A') ? (data.series.A||[])
                : (tipo === 'B') ? (data.series.B||[])
                : (data.series.TOTAL||[]);

      // Anual: 12 meses exactos y ordenados
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
      $vTablaWrap.style.display  = '';
      if (!labels.length) {
        if (vChart) { vChart.destroy(); vChart = null; }
        $vResumenSerie.textContent = 'Sin datos para los filtros seleccionados.';
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
        $vResumenSerie.textContent = `Máximo: ${maxLabel} (${money(maxVal)}) · Mínimo: ${minLabel} (${money(minVal)})`;

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
  x: {
    ticks: { color: '#e7eefc' },                      // etiquetas bajo el gráfico (BLANCO)
    grid:  { color: 'rgba(255,255,255,0.08)' },       // líneas verticales suaves
    border:{ color: 'rgba(255,255,255,0.20)' }        // eje X
  },
  y: {
    beginAtZero: true,
    ticks: { color: '#e7eefc', callback: v => money(v) }, // valores del eje Y (BLANCO)
    grid:  { color: 'rgba(255,255,255,0.08)' },           // líneas horizontales suaves
    border:{ color: 'rgba(255,255,255,0.20)' }            // eje Y
  }
},
            datasets: { bar: { categoryPercentage: 0.7, barPercentage: 0.9, maxBarThickness: 32 } }
          }
        });
      }

      $vResultados.style.display = '';
      $vEstado.textContent = ''; // (antes podía mostrar "Listo (...) barra(s)")
    }catch(e){
      console.error(e);
      $vEstado.textContent = '';
      $vError.textContent = `❌ ${e.message}`;
      $vError.style.display='block';
    }
  }
  document.getElementById('v-btnBuscar').addEventListener('click', buscarVentas);
  onPeriodoChangeVentas();
