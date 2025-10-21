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
    function markCover(idx){
      Array.from($preview.children).forEach(function(node,i){
        if(i===idx) node.classList.add('is-cover'); else node.classList.remove('is-cover');
      });
      $portadaHidden.value=String(idx);
    }
    function syncInputFromDT(){ inputImagen.files = dt.files; }
    function syncDTfromDOM(){
      var order = Array.from($preview.children).map(function(node){ return parseInt(node.dataset.idx,10); });
      var ndt = new DataTransfer();
      order.forEach(function(oldIdx){ ndt.items.add(dt.files[oldIdx]); });
      dt=ndt;
      Array.from($preview.children).forEach(function(node,i){ node.dataset.idx=String(i); });
      markCover(0); syncInputFromDT();
    }
    function removeAt(index){
      if(index<0||index>=dt.files.length) return;
      var ndt = new DataTransfer();
      Array.from(dt.files).forEach(function(f,i){ if(i!==index) ndt.items.add(f); });
      dt=ndt; syncInputFromDT(); rebuild();
    }
    function setCover(index){
      index = clampIndex(index);
      if(index===0){ markCover(0); return; }
      var files = Array.from(dt.files);
      var chosen = files[index]; files.splice(index,1); files.unshift(chosen);
      var ndt = new DataTransfer(); files.forEach(function(f){ ndt.items.add(f); });
      dt=ndt; syncInputFromDT(); rebuild(); markCover(0);
    }
    function rebuild(){
      $preview.innerHTML='';
      Array.from(dt.files).forEach(function(file,idx){
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
      clickTimer=setTimeout(function(){ var i=Array.from($preview.children).indexOf(t); if(i>=0) setCover(i); clickTimer=null; },SINGLE);
    });
    $preview.addEventListener('dblclick',function(e){
      var t=e.target.closest('.thumb'); if(!t) return;
      if(clickTimer){ clearTimeout(clickTimer); clickTimer=null; }
      var i=Array.from($preview.children).indexOf(t); if(i>=0) removeAt(i);
    });

    inputImagen.addEventListener('change',function(e){
      var sel=Array.from(e.target.files||[]); if(sel.length===0 && dt.files.length===0) return;
      sel.forEach(function(f){ dt.items.add(f); });
      syncInputFromDT();
      if (dt.files.length>0 && (isNaN(parseInt($portadaHidden.value,10)) || parseInt($portadaHidden.value,10)<0)){
        $portadaHidden.value='0';
      }
      rebuild(); markCover(0);
    });
  })();

  /* ================================
     MARCA → CARGA DE MODELOS (AJAX)
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
    // Evitar submit con Enter
    $(document).off('keypress.preventEnter').on('keypress.preventEnter','form',function(e){
      if (e.keyCode===13) e.preventDefault();
    });

    // Agregar proveedor
    $(document).off('click.addProv','#addProveedor').on('click.addProv','#addProveedor',function(e){
      e.preventDefault(); e.stopImmediatePropagation();
      var $base=$('.proveedor').first(); if(!$base.length) return;
      var $nuevo=$base.clone(false);

      // Limpiar valores
      $nuevo.find('input').val('');
      $nuevo.find('select').prop('selectedIndex',0);
      $nuevo.find('.nombre_proveedor').text('');

      // Evitar ids/for duplicados
      $nuevo.find('[id]').removeAttr('id');
      $nuevo.find('label[for]').removeAttr('for');

      // Insertar antes del botón +
      $nuevo.insertBefore('#addProveedor');

      // Disparar cálculos iniciales
      $nuevo.find('.proveedores').trigger('change');
      $nuevo.find('.precio_lista').trigger('input');
      $nuevo.find('select.IVA').trigger('change');

      actualizarProveedorAsignado();
      actualizarPrecioFinal();
    });

    /* =======================================
       DELEGACIÓN DE EVENTOS
    ======================================== */
    $(document)
      .off('change.provSel', '.proveedores')
      .on('change.provSel', '.proveedores', function () {
        actualizarProveedor($(this));
        var $wrap = $(this).closest('.proveedor');
        $wrap.find('.precio_lista').trigger('input');
      });

    // Precio de lista cambia
    $(document)
      .off('input change.precioLista', '.precio_lista')
      .on('input change.precioLista', '.precio_lista', function () {
        actualizarPrecio($(this));
      });

    // Cambia costo neto o IVA (del SELECT) → recalcular costo con IVA
    $(document)
      .off('input change.costos', '.costo_neto, select.IVA')
      .on('input change.costos', '.costo_neto, select.IVA', function () {
        var $wrap = $(this).closest('.proveedor');
        recalcularConIVA($wrap);
        actualizarProveedorAsignado();
        actualizarPrecioFinal();
      });

    $('#utilidad').off('input change.util').on('input change.util', function () {
      actualizarPrecioFinal();
    });

    /* ================================
       FUNCIONES DE CÁLCULO
    ================================= */
    function toNumber(v){ var n=parseFloat((v||'').toString().replace(',','.')); return isNaN(n)?0:n; }

    function asegurarHidden($wrap, cls, name, defVal) {
      var $el = $wrap.find('.' + cls);
      if ($el.length === 0) {
        $el = $('<input>', { type: 'hidden', class: cls, name: name, value: defVal });
        $wrap.append($el);
      }
      return $el;
    }

    function actualizarProveedor($select){
      var $wrap=$select.closest('.proveedor');
      var $opt=$select.find('option:selected');
      var nombre=($opt.text()||'').trim();
      var desc=toNumber($opt.data('descuento'));

      $wrap.find('.nombre_proveedor').text(nombre);

      var $hiddenDesc = asegurarHidden($wrap,'descuentos_proveedor_id','descuentos_proveedor_id[]',0);
      $hiddenDesc.val(desc);

      // Etiquetas
      var suf = nombre ? ' ('+nombre+')' : '';
      var $lblCodigo=$wrap.find('.label-codigo'), $lblPL=$wrap.find('.label-precio-lista'), $lblDesc=$wrap.find('.label-descuento');
      if ($lblCodigo.length) $lblCodigo.text('Código'+suf);
      if ($lblPL.length)     $lblPL.text('Precio de Lista'+suf);
      if ($lblDesc.length)   $lblDesc.text('Descuento'+suf);

      // cada vez que cambia proveedor, recalculamos
      $wrap.find('.precio_lista').trigger('input');
      $wrap.find('select.IVA').trigger('change');
    }

    function actualizarPrecio($precioLista){
      var $wrap = $precioLista.closest('.proveedor');

      var pl   = toNumber($precioLista.val());
      var desc = toNumber($wrap.find('.descuentos_proveedor_id').val());
      if (!desc) {
        var dOpt = toNumber($wrap.find('.proveedores option:selected').data('descuento'));
        desc = dOpt || 0;
      }

      var $costoNeto = asegurarHidden($wrap,'costo_neto','costo_neto[]',0);
      var costoNeto = pl - (pl * desc / 100);
      $costoNeto.val(Math.ceil(costoNeto));

      console.log('[CREAR] PL=',pl,'desc=',desc,'→ neto=', $costoNeto.val());

      // Con el neto puesto, calcular con IVA
      recalcularConIVA($wrap);
    }

    function recalcularConIVA($wrap){
      var cn  = toNumber($wrap.find('.costo_neto').val()) || toNumber($wrap.find('.costo_neto').prop('value')) || toNumber($wrap.find('.costo_neto').val());
      var iva = toNumber($wrap.find('select.IVA').val()); // ⟵ SIEMPRE del SELECT
      if (!iva) iva = 21;

      var $costoIVAHidden = asegurarHidden($wrap,'costo_iva','costo_iva[]',0);
      var $costoIVAvis    = $wrap.find('.costo_iva_vis');
      if (!$costoIVAvis.length){
        // si no existe el visible, no lo creo aquí; sólo el hidden
        $costoIVAvis = $(); 
      }

      var cIVA = cn + (cn * iva / 100);
      cIVA = Math.ceil(cIVA); // mismo criterio que venías usando

      $costoIVAHidden.val(cIVA);
      if ($costoIVAvis.length) $costoIVAvis.val(cIVA);

      console.log('[CREAR] neto=',cn,'iva=',iva,'→ c/IVA=',cIVA);
    }

    /* =======================================
       SELECCIÓN DEL PROVEEDOR MÁS ECONÓMICO
    ======================================== */
    function getProveedorConCostoIvaMasBajo(){
      var $g=null, min=Infinity;
      $('.proveedor').each(function(){
        var v=toNumber($(this).find('.costo_iva').val()); // hidden enviado
        if(!isNaN(v) && v<min){ min=v; $g=$(this); }
      });
      return $g;
    }

    function actualizarProveedorAsignado(){
      var $p = getProveedorConCostoIvaMasBajo();
      var nombre='';
      if ($p && $p.length){
        nombre = ($p.find('.nombre_proveedor').text()||'').trim();
      }
      var el = document.getElementById('proveedorAsignado');
      if (el) el.textContent = nombre;
    }

    /* ================================
       PRECIO FINAL (UTILIDAD GLOBAL)
    ================================= */
    function actualizarPrecioFinal(){
      var $p = getProveedorConCostoIvaMasBajo(); if(!$p||!$p.length) return;
      var costoConIVA = toNumber($p.find('.costo_iva').val()); if(!costoConIVA) return;
      var utilidad = toNumber($('#utilidad').val());
      var precioFinal = costoConIVA + (costoConIVA * utilidad / 100);
      precioFinal = Math.ceil(precioFinal/10)*10;
      $('#precio_venta').val(precioFinal);
    }

    // Disparos iniciales
    $(function(){
      $('.proveedores').first().trigger('change');
      $('.precio_lista').first().trigger('input');
      $('select.IVA').first().trigger('change');
      actualizarProveedorAsignado();
      actualizarPrecioFinal();
    });
  } // jQuery
}
