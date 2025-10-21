/* ================================
   GUARD: evitar doble carga del script en la VISTA CREAR
================================ */
if (!window.__CREAR_INIT__) {
  window.__CREAR_INIT__ = true;

  /* ================================
     PREVIEW DE IMÁGENES + SORTABLE
  ================================= */
  (function initPreview() {
    var inputImagen = document.getElementById('imagen');
    var $portadaHidden = document.getElementById('portada_index');
    var $preview = document.getElementById('preview');
    if (!inputImagen || !$portadaHidden || !$preview) return;

    var dt = new DataTransfer();
    function clampIndex(n){ if(isNaN(n)||n<0)return 0; if(n>=dt.files.length)return dt.files.length-1; return n; }
    function markCover(idx){ Array.from($preview.children).forEach((node,i)=>{ if(i===idx) node.classList.add('is-cover'); else node.classList.remove('is-cover');}); $portadaHidden.value=String(idx); }
    function syncInputFromDT(){ inputImagen.files = dt.files; }
    function syncDTfromDOM(){
      var order = Array.from($preview.children).map(node=>parseInt(node.dataset.idx,10));
      var ndt = new DataTransfer(); order.forEach(oldIdx=>ndt.items.add(dt.files[oldIdx])); dt=ndt;
      Array.from($preview.children).forEach((node,i)=> node.dataset.idx=String(i));
      markCover(0); syncInputFromDT();
    }
    function removeAt(index){
      if(index<0||index>=dt.files.length) return;
      var ndt = new DataTransfer(); Array.from(dt.files).forEach((f,i)=>{ if(i!==index) ndt.items.add(f);});
      dt=ndt; syncInputFromDT(); rebuild();
    }
    function setCover(index){
      index = clampIndex(index);
      if(index===0){ markCover(0); return; }
      var files = Array.from(dt.files); var chosen = files[index]; files.splice(index,1); files.unshift(chosen);
      var ndt = new DataTransfer(); files.forEach(f=>ndt.items.add(f)); dt=ndt;
      syncInputFromDT(); rebuild(); markCover(0);
    }
    function rebuild(){
      $preview.innerHTML='';
      Array.from(dt.files).forEach((file,idx)=>{
        var wrap=document.createElement('div'); wrap.className='thumb'; wrap.dataset.idx=String(idx);
        var img=document.createElement('img'); var url=URL.createObjectURL(file);
        img.src=url; img.alt=file.name; img.onload=function(){ try{URL.revokeObjectURL(url);}catch(e){} };
        var badge=document.createElement('span'); badge.className='badge-portada'; badge.textContent='PORTADA';
        wrap.appendChild(img); wrap.appendChild(badge); $preview.appendChild(wrap);
      });
      var portadaIdx = clampIndex(parseInt($portadaHidden.value,10)); markCover(portadaIdx);
      if (typeof Sortable!=='undefined' && Sortable){
        if ($preview.__sortable){ $preview.__sortable.destroy(); $preview.__sortable=null; }
        $preview.__sortable = new Sortable($preview,{ animation:150, draggable:'.thumb', onEnd:syncDTfromDOM });
      }
    }
    var clickTimer=null, SINGLE=220;
    $preview.addEventListener('click',function(e){
      var t=e.target.closest('.thumb'); if(!t) return;
      if(clickTimer) clearTimeout(clickTimer);
      clickTimer=setTimeout(()=>{ var i=Array.from($preview.children).indexOf(t); if(i>=0) setCover(i); clickTimer=null; },SINGLE);
    });
    $preview.addEventListener('dblclick',function(e){
      var t=e.target.closest('.thumb'); if(!t) return;
      if(clickTimer){ clearTimeout(clickTimer); clickTimer=null; }
      var i=Array.from($preview.children).indexOf(t); if(i>=0) removeAt(i);
    });
    inputImagen.addEventListener('change',function(e){
      var sel=Array.from(e.target.files||[]); if(sel.length===0 && dt.files.length===0) return;
      sel.forEach(f=>dt.items.add(f)); syncInputFromDT();
      if (dt.files.length>0 && (isNaN(parseInt($portadaHidden.value,10)) || parseInt($portadaHidden.value,10)<0)) $portadaHidden.value='0';
      rebuild(); markCover(0);
    });
  })();

  /* ================================
     MARCA → MODELOS (AJAX)
  ================================= */
  if (window.jQuery) {
    $('#marca').off('change.cargarModelos').on('change.cargarModelos', function () {
      var marcaId = $(this).val();
      var $modelo = $('#modelo_id');
      $modelo.empty().append('<option value="">Selecciona un modelo...</option>');
      if (!marcaId) return;
      $.get('/productos/modelos/' + marcaId, function (modelosPorMarca) {
        (modelosPorMarca || []).forEach(function (modelo) {
          $modelo.append('<option value="' + modelo.id + '">' + modelo.nombre + '</option>');
        });
      });
    });

    /* ================================
       UTILIDADES
    ================================= */
    $(document).off('keypress.preventEnter').on('keypress.preventEnter','form',function(e){
      if (e.keyCode===13) e.preventDefault();
    });

    function toNumber(v){ var n=parseFloat((v||'').toString().replace(',','.')); return isNaN(n)?0:n; }

    function asegurarHidden($wrap, cls, name, defVal) {
      var $el = $wrap.find('.' + cls);
      if ($el.length === 0) {
        $el = $('<input>', { type: 'hidden', class: cls, name: name, value: defVal });
        $wrap.append($el);
      }
      return $el;
    }

    // === NUEVO: factor por presentación (unidad/juego) ===
    function getFactor($wrap){
      // Si existe select .presentacion (EJS), lo usamos; si no, por compatibilidad asumimos 1
      var presSel = $wrap.find('.presentacion');
      var pres = presSel.length ? (presSel.val()||'unidad').toLowerCase() : 'unidad';
      if (pres === 'juego') return 0.5; // par → mitad por unidad
      return 1; // unidad (o futuros tipos si los agregás: caja x10 → 0.1, etc.)
    }

    // Agregar proveedor
    $(document).off('click.addProv','#addProveedor').on('click.addProv','#addProveedor',function(e){
      e.preventDefault(); e.stopImmediatePropagation();
      var $base=$('.proveedor').first(); if(!$base.length) return;
      var $nuevo=$base.clone(false);

      // Limpiar valores del clon
      $nuevo.find('input').val('');
      $nuevo.find('select').prop('selectedIndex',0);
      $nuevo.find('.nombre_proveedor').text('');

      // Evitar ids/for duplicados
      $nuevo.find('[id]').removeAttr('id');
      $nuevo.find('label[for]').removeAttr('for');

      // Asegurar hidden de factor_unidad en el clon
      asegurarHidden($nuevo,'factor_unidad','factor_unidad[]',1);

      $nuevo.insertBefore('#addProveedor');

      // Inicializa cálculos del bloque nuevo
      $nuevo.find('.proveedores').trigger('change');
      $nuevo.find('.precio_lista').trigger('input');
      $nuevo.find('select.IVA').trigger('change');

      // Si tiene select .presentacion, forzamos el valor por defecto (Unidad) y sincronizamos factor
      var $pres=$nuevo.find('.presentacion');
      if ($pres.length){
        $pres.val('unidad');
        $nuevo.find('.factor_unidad').val(1);
      }

      actualizarProveedorAsignado();
      actualizarPrecioFinal();
    });

    /* =======================================
       DELEGACIÓN DE EVENTOS
    ======================================== */
    // Proveedor seleccionado
    $(document)
      .off('change.provSel', '.proveedores')
      .on('change.provSel', '.proveedores', function () {
        actualizarProveedor($(this));
        var $wrap = $(this).closest('.proveedor');
        $wrap.find('.precio_lista').trigger('input'); // recalcula neto y luego con IVA
      });

    // Precio de lista cambia → recalcular neto
    $(document)
      .off('input change.precioLista', '.precio_lista')
      .on('input change.precioLista', '.precio_lista', function () {
        actualizarPrecio($(this)); // calcula costo_neto visible
      });

    // Costo neto / IVA cambia → recalcular con IVA, asignar proveedor y PV
    $(document)
      .off('input change.costos', '.costo_neto, select.IVA')
      .on('input change.costos', '.costo_neto, select.IVA', function () {
        var $wrap = $(this).closest('.proveedor');
        recalcularConIVA($wrap);
        actualizarProveedorAsignado();
        actualizarPrecioFinal();
      });

    // === NUEVO: Presentación cambia → sincroniza factor y recálculos
    $(document)
      .off('change.presentacion', '.presentacion')
      .on('change.presentacion', '.presentacion', function () {
        var $wrap = $(this).closest('.proveedor');
        var factor = getFactor($wrap);
        asegurarHidden($wrap,'factor_unidad','factor_unidad[]',factor).val(factor);
        // Recalcular cadena completa
        $wrap.find('.precio_lista').trigger('input'); // recalcula neto
        $wrap.find('select.IVA').trigger('change');   // recalcula con IVA
        actualizarProveedorAsignado();
        actualizarPrecioFinal();
      });

    // Utilidad global
    $('#utilidad').off('input change.util').on('input change.util', function () {
      actualizarPrecioFinal();
    });

    /* ================================
       FUNCIONES DE CÁLCULO
    ================================= */
    function actualizarProveedor($select){
      var $wrap=$select.closest('.proveedor');
      var $opt=$select.find('option:selected');
      var nombre=($opt.text()||'').trim();
      var desc=toNumber($opt.data('descuento'));
      $wrap.find('.nombre_proveedor').text(nombre);

      // hidden descuento (viaja al backend)
      var $hiddenDesc = $wrap.find('.descuentos_proveedor_id');
      if (!$hiddenDesc.length){
        $hiddenDesc = $('<input>',{type:'hidden',class:'descuentos_proveedor_id',name:'descuentos_proveedor_id[]',value:0});
        $wrap.append($hiddenDesc);
      }
      $hiddenDesc.val(desc);

      // etiquetas
      var suf = nombre ? ' ('+nombre+')' : '';
      var $lblCodigo=$wrap.find('.label-codigo'), $lblPL=$wrap.find('.label-precio-lista'), $lblDesc=$wrap.find('.label-descuento');
      if ($lblCodigo.length) $lblCodigo.text('Código'+suf);
      if ($lblPL.length)     $lblPL.text('Precio de Lista'+suf);
      if ($lblDesc.length)   $lblDesc.text('Descuento'+suf);
    }

    // ⟶ COSTO NETO (visible) = PL - (PL * desc/100)
    function actualizarPrecio($precioLista){
      var $wrap = $precioLista.closest('.proveedor');
      var pl   = toNumber($precioLista.val());
      var desc = toNumber($wrap.find('.descuentos_proveedor_id').val());
      if (!desc) { desc = toNumber($wrap.find('.proveedores option:selected').data('descuento')) || 0; }

      var $costoNetoVis = $wrap.find('.costo_neto');        // visible y viaja (name="costo_neto[]")
      var costoNeto = pl - (pl * desc / 100);
      $costoNetoVis.val(Math.ceil(costoNeto));

      console.log('[CREAR][NETO] PL=',pl,'desc=',desc,'→ neto=', $costoNetoVis.val());

      // luego, costo con IVA (aplicará factor_unidad)
      recalcularConIVA($wrap);
    }
function recalcularConIVA($wrap){
  // Neto que sale de PL - %desc (lo interpretamos como precio del PAR/juego)
  var cn_par  = toNumber($wrap.find('.costo_neto').val()); 
  var iva     = toNumber($wrap.find('select.IVA').val());
  if (!iva) iva = 21;

  // Cálculos base (sin redondeos raros intermedios)
  var cIVA_par  = Math.ceil(cn_par * (1 + iva / 100));           // precio del JUEGO con IVA
  var cIVA_unit = Math.ceil((cn_par * 0.5) * (1 + iva / 100));    // precio por UNIDAD con IVA

  // Presentación pedida por el admin para ESTE proveedor
  var pres = ($wrap.find('.presentacion').val() || 'unidad').toLowerCase();

  // 🔒 Hidden normalizado a UNIDAD: siempre lo guardamos por unidad para comparar proveedores
  var $costoIVAHidden = asegurarHidden($wrap,'costo_iva','costo_iva[]',0);
  $costoIVAHidden.val(cIVA_unit);

  // 👀 Visible según lo que seleccionó el admin
  var $costoIVAvis = $wrap.find('.costo_iva_vis');
  var cIVA_visible = (pres === 'juego') ? cIVA_par : cIVA_unit;
  if ($costoIVAvis.length) $costoIVAvis.val(cIVA_visible);

  // Guardamos también el factor_unidad por coherencia backend (unidad=0.5 del par)
  var factor = 0.5; // porque normalizamos SIEMPRE a UNIDAD desde el PAR
  asegurarHidden($wrap,'factor_unidad','factor_unidad[]',factor).val(factor);

  console.log('[CREAR][IVA] cn_par=',cn_par,'iva=',iva,'→ par=',cIVA_par,'unit=',cIVA_unit,'pres=',pres,'visible=',cIVA_visible);
}



    /* =======================================
       PROVEEDOR MÁS ECONÓMICO
    ======================================== */
    function getProveedorConCostoIvaMasBajo(){
      var $g=null, min=Infinity;
      $('.proveedor').each(function(){
        var v=toNumber($(this).find('.costo_iva').val()); // hidden enviado (ya normalizado a unidad)
        if(!isNaN(v) && v<min){ min=v; $g=$(this); }
      });
      return $g;
    }

    function actualizarProveedorAsignado(){
      var $p = getProveedorConCostoIvaMasBajo();
      var nombre='';
      if ($p && $p.length){ nombre = ($p.find('.nombre_proveedor').text()||'').trim(); }
      var el = document.getElementById('proveedorAsignado'); if (el) el.textContent = nombre;
    }

    /* ================================
       PRECIO FINAL (UTILIDAD GLOBAL)
    ================================= */
function actualizarPrecioFinal(){
  var $p = getProveedorConCostoIvaMasBajo();
  if(!$p || !$p.length) return;

  // Hidden normalizado a UNIDAD (siempre por unidad)
  var costoUnit = toNumber($p.find('.costo_iva').val());
  if(!costoUnit) return;

  // Si la presentación del proveedor ganador es "juego",
  // la base para el PV debe ser el PAR (unidad * 2)
  var pres = ($p.find('.presentacion').val() || 'unidad').toLowerCase();
  var base = (pres === 'juego') ? (costoUnit * 2) : costoUnit;

  var utilidad = toNumber($('#utilidad').val());
  // Redondeo como ya venías haciendo (a la decena superior)
  var precioFinal = Math.ceil((base * (1 + utilidad / 100)) / 10) * 10;

  $('#precio_venta').val(precioFinal);
}


    // Disparos iniciales
    $(function(){
      // Asegurar que cada bloque proveedor tenga su hidden de factor_unidad
      $('.proveedor').each(function(){
        var $wrap=$(this);
        var factor = getFactor($wrap); // si no hay select, será 1
        asegurarHidden($wrap,'factor_unidad','factor_unidad[]',factor).val(factor);
      });

      $('.proveedores').first().trigger('change');
      $('.precio_lista').first().trigger('input');
      $('select.IVA').first().trigger('change');
      actualizarProveedorAsignado();
      actualizarPrecioFinal();
    });
  } // jQuery
}
