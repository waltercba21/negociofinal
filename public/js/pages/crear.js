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

    function clampIndex(n) {
      if (isNaN(n) || n < 0) return 0;
      if (n >= dt.files.length) return dt.files.length - 1;
      return n;
    }
    function markCover(idx) {
      Array.from($preview.children).forEach((node, i) => {
        if (i === idx) node.classList.add('is-cover');
        else node.classList.remove('is-cover');
      });
      $portadaHidden.value = String(idx);
    }
    function syncInputFromDT() { inputImagen.files = dt.files; }
    function syncDTfromDOM() {
      var order = Array.from($preview.children).map(node => parseInt(node.dataset.idx, 10));
      var ndt = new DataTransfer();
      order.forEach(oldIdx => ndt.items.add(dt.files[oldIdx]));
      dt = ndt;
      Array.from($preview.children).forEach((node, i) => node.dataset.idx = String(i));
      markCover(0);
      syncInputFromDT();
    }
    function removeAt(index) {
      if (index < 0 || index >= dt.files.length) return;
      var ndt = new DataTransfer();
      Array.from(dt.files).forEach((f, i) => { if (i !== index) ndt.items.add(f); });
      dt = ndt;
      syncInputFromDT();
      rebuild();
    }
    function setCover(index) {
      index = clampIndex(index);
      if (index === 0) { markCover(0); return; }
      var files = Array.from(dt.files);
      var chosen = files[index];
      files.splice(index, 1);
      files.unshift(chosen);
      var ndt = new DataTransfer();
      files.forEach(f => ndt.items.add(f));
      dt = ndt;
      syncInputFromDT();
      rebuild();
      markCover(0);
    }
    function rebuild() {
      $preview.innerHTML = '';
      Array.from(dt.files).forEach((file, idx) => {
        var wrap = document.createElement('div');
        wrap.className = 'thumb';
        wrap.dataset.idx = String(idx);
        var img = document.createElement('img');
        var url = URL.createObjectURL(file);
        img.src = url;
        img.alt = file.name;
        img.onload = function () { try { URL.revokeObjectURL(url); } catch (e) {} };
        var badge = document.createElement('span');
        badge.className = 'badge-portada';
        badge.textContent = 'PORTADA';
        wrap.appendChild(img);
        wrap.appendChild(badge);
        $preview.appendChild(wrap);
      });
      var portadaIdx = clampIndex(parseInt($portadaHidden.value, 10));
      markCover(portadaIdx);
      if (typeof Sortable !== 'undefined' && Sortable) {
        if ($preview.__sortable) { $preview.__sortable.destroy(); $preview.__sortable = null; }
        $preview.__sortable = new Sortable($preview, { animation: 150, draggable: '.thumb', onEnd: syncDTfromDOM });
      }
    }

    var clickTimer = null, SINGLE = 220;
    $preview.addEventListener('click', function (e) {
      var t = e.target.closest('.thumb'); if (!t) return;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        var i = Array.from($preview.children).indexOf(t);
        if (i >= 0) setCover(i);
        clickTimer = null;
      }, SINGLE);
    });
    $preview.addEventListener('dblclick', function (e) {
      var t = e.target.closest('.thumb'); if (!t) return;
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      var i = Array.from($preview.children).indexOf(t);
      if (i >= 0) removeAt(i);
    });
    inputImagen.addEventListener('change', function (e) {
      var sel = Array.from(e.target.files || []);
      if (sel.length === 0 && dt.files.length === 0) return;
      sel.forEach(f => dt.items.add(f));
      syncInputFromDT();
      if (dt.files.length > 0 && (isNaN(parseInt($portadaHidden.value, 10)) || parseInt($portadaHidden.value, 10) < 0)) {
        $portadaHidden.value = '0';
      }
      rebuild();
      markCover(0);
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
       UTILIDADES / HELPERS
    ================================= */
    $(document).off('keypress.preventEnter').on('keypress.preventEnter', 'form', function (e) {
      if (e.keyCode === 13) e.preventDefault();
    });

    function toNumber(v) {
      var n = parseFloat((v || '').toString().replace(',', '.'));
      return isNaN(n) ? 0 : n;
    }

    function asegurarHidden($wrap, cls, name, defVal) {
      var $el = $wrap.find('.' + cls);
      if ($el.length === 0) {
        $el = $('<input>', { type: 'hidden', class: cls, name: name, value: defVal });
        $wrap.append($el);
      }
      return $el;
    }

    function asegurarVisibleCostoIVA($wrap) {
      var $vis = $wrap.find('.costo_iva_vis');
      if (!$vis.length) {
        // Ubicación preferida: contenedor de costo con IVA
        var $contenedor = $wrap.find('.campo-costo-iva');
        if (!$contenedor.length) $contenedor = $wrap.find('select.IVA').closest('.form-group-crear');
        if (!$contenedor.length) $contenedor = $wrap; // último recurso
        $vis = $('<input>', {
          type: 'number',
          step: '0.01',
          class: 'costo_iva_vis form-control',
          readonly: true
        });
        $contenedor.append($vis);
      }
      return $vis;
    }

    function getFactor($wrap) {
      var presSel = $wrap.find('.presentacion');
      var pres = presSel.length ? (presSel.val() || 'unidad').toLowerCase() : 'unidad';
      if (pres === 'juego') return 0.5; // par → mitad por unidad
      return 1;
    }

    /* =======================================
       AGREGAR PROVEEDOR
    ======================================== */
    $(document).off('click.addProv', '#addProveedor').on('click.addProv', '#addProveedor', function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      var $base = $('.proveedor').first(); if (!$base.length) return;
      var $nuevo = $base.clone(false);

      // Limpiar valores del clon
      $nuevo.find('input').val('');
      $nuevo.find('select').prop('selectedIndex', 0);
      $nuevo.find('.nombre_proveedor').text('');

      // Evitar ids/for duplicados
      $nuevo.find('[id]').removeAttr('id');
      $nuevo.find('label[for]').removeAttr('for');

      // Asegurar hidden de factor_unidad en el clon
      asegurarHidden($nuevo, 'factor_unidad', 'factor_unidad[]', 1);

      $nuevo.insertBefore('#addProveedor');

      // Inicializa cálculos del bloque nuevo
      asegurarVisibleCostoIVA($nuevo);
      $nuevo.find('.proveedores').trigger('change');
      $nuevo.find('.precio_lista').trigger('input');
      $nuevo.find('select.IVA').trigger('change');

      var $pres = $nuevo.find('.presentacion');
      if ($pres.length) {
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
        actualizarPrecio($(this)); // calcula costo_neto visible y recalcula con IVA
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

    // Presentación cambia → sincroniza factor, recálculo inmediato y PV
    $(document)
      .off('change.presentacion', '.presentacion')
      .on('change.presentacion', '.presentacion', function () {
        var $wrap = $(this).closest('.proveedor');
        var factor = getFactor($wrap);
        asegurarHidden($wrap, 'factor_unidad', 'factor_unidad[]', factor).val(factor);
        asegurarVisibleCostoIVA($wrap);
        recalcularConIVA($wrap);
        actualizarProveedorAsignado();
        actualizarPrecioFinal();
      });

    // Escuchar SIEMPRE cambios de utilidad (robusto)
    $(document)
      .off('input change keyup blur', '#utilidad')
      .on('input change keyup blur', '#utilidad', function () {
        console.log('[CREAR][UTILIDAD] cambio →', $(this).val());
        actualizarPrecioFinal();
      });

    /* ================================
       FUNCIONES DE CÁLCULO
    ================================= */

    function actualizarProveedor($select) {
      var $wrap = $select.closest('.proveedor');
      var $opt = $select.find('option:selected');
      var nombre = ($opt.text() || '').trim();
      var desc = toNumber($opt.data('descuento'));
      $wrap.find('.nombre_proveedor').text(nombre);

      // hidden descuento (viaja al backend)
      var $hiddenDesc = $wrap.find('.descuentos_proveedor_id');
      if (!$hiddenDesc.length) {
        $hiddenDesc = $('<input>', { type: 'hidden', class: 'descuentos_proveedor_id', name: 'descuentos_proveedor_id[]', value: 0 });
        $wrap.append($hiddenDesc);
      }
      $hiddenDesc.val(desc);

      // etiquetas
      var suf = nombre ? ' (' + nombre + ')' : '';
      var $lblCodigo = $wrap.find('.label-codigo'),
          $lblPL = $wrap.find('.label-precio-lista'),
          $lblDesc = $wrap.find('.label-descuento');
      if ($lblCodigo.length) $lblCodigo.text('Código' + suf);
      if ($lblPL.length)     $lblPL.text('Precio de Lista' + suf);
      if ($lblDesc.length)   $lblDesc.text('Descuento' + suf);
    }

    // ⟶ COSTO NETO (visible) = PL - (PL * desc/100)
    function actualizarPrecio($precioLista) {
      var $wrap = $precioLista.closest('.proveedor');
      var pl = toNumber($precioLista.val());
      var desc = toNumber($wrap.find('.descuentos_proveedor_id').val());
      if (!desc) { desc = toNumber($wrap.find('.proveedores option:selected').data('descuento')) || 0; }

      var $costoNetoVis = $wrap.find('.costo_neto'); // visible y viaja (name="costo_neto[]")
      var costoNeto = pl - (pl * desc / 100);
      $costoNetoVis.val(Math.ceil(costoNeto)); // mismo criterio que venías usando

      console.log('[CREAR][NETO] PL=', pl, 'desc=', desc, '→ neto=', $costoNetoVis.val());

      // Luego, costo con IVA (aplicará presentación)
      recalcularConIVA($wrap);
    }

    // ⟶ COSTO con IVA (visible + hidden), normalizado a UNIDAD SIEMPRE en hidden
    //    y visible según presentación: UNIDAD muestra unidad; JUEGO divide a la mitad (muestra unidad)
    function recalcularConIVA($wrap) {
      var cn = toNumber($wrap.find('.costo_neto').val()); // neto SIN IVA (tal como ingresó proveedor)
      var iva = toNumber($wrap.find('select.IVA').val());
      if (!iva) iva = 21;

      var pres = ($wrap.find('.presentacion').val() || 'unidad').toLowerCase();

      // costo con IVA por UNIDAD (esta es la referencia única)
      var cIVA_unit;

      if (pres === 'juego') {
        // neto viene como PAR → dividir a la mitad
        var cnUnidad = cn * 0.5;
        cIVA_unit = Math.ceil(cnUnidad * (1 + iva / 100));
      } else {
        // neto viene como UNIDAD
        var cnUnidad2 = cn;
        cIVA_unit = Math.ceil(cnUnidad2 * (1 + iva / 100));
      }

      // Hidden normalizado a UNIDAD (para comparación y backend)
      asegurarHidden($wrap, 'costo_iva', 'costo_iva[]', 0).val(cIVA_unit);

      // Visible para el admin:
      //  - si es "unidad": mostrar unidad
      //  - si es "juego": también mostrar unidad (dividir a la mitad → lo que pediste)
      asegurarVisibleCostoIVA($wrap).val(cIVA_unit);

      // Factor para backend (unidad=1, juego=0.5)
      var factor = (pres === 'juego') ? 0.5 : 1;
      asegurarHidden($wrap, 'factor_unidad', 'factor_unidad[]', factor).val(factor);

      // Guardamos data para PV (aunque PV ya usa siempre unidad)
      $wrap.data('presentacion', pres);
      $wrap.data('civa_unit', cIVA_unit);

      console.log('[CREAR][IVA] pres=', pres, 'cn=', cn, 'iva=', iva, '→ unit=', cIVA_unit, 'visible=', cIVA_unit, 'factor=', factor);
    }

    /* =======================================
       PROVEEDOR MÁS ECONÓMICO
    ======================================== */
    function getProveedorConCostoIvaMasBajo() {
      var $g = null, min = Infinity;
      $('.proveedor').each(function () {
        var v = toNumber($(this).find('.costo_iva').val()); // hidden enviado (ya normalizado a unidad)
        if (!isNaN(v) && v < min) { min = v; $g = $(this); }
      });
      return $g;
    }

    function actualizarProveedorAsignado() {
      var $p = getProveedorConCostoIvaMasBajo();
      var nombre = '';
      if ($p && $p.length) { nombre = ($p.find('.nombre_proveedor').text() || '').trim(); }
      var el = document.getElementById('proveedorAsignado');
      if (el) el.textContent = nombre;
    }

    /* ================================
       PRECIO FINAL (UTILIDAD GLOBAL)
    ================================= */
    function actualizarPrecioFinal() {
      var $p = getProveedorConCostoIvaMasBajo(); // elige por costo_iva (unidad)
      if (!$p || !$p.length) { console.log('[CREAR][PV] no hay proveedor ganador'); return; }

      // Base SIEMPRE por UNIDAD (lo pediste explícito: si es "juego", dividir a la mitad)
      var base = toNumber($p.find('.costo_iva').val()); // c/IVA por unidad
      if (!base) { console.log('[CREAR][PV] base unit=0'); return; }

      // Obtener utilidad por id o por name
      var utilEl = document.getElementById('utilidad') || document.querySelector('input[name="utilidad"]');
      var utilRaw = utilEl ? utilEl.value : '';
      var utilidad = toNumber(utilRaw);

      var precioFinal = Math.ceil((base * (1 + utilidad / 100)) / 10) * 10;

      // Establecer por id y también por name (por si alguna vez cambia el id)
      $('#precio_venta, input[name="precio_venta"]').val(precioFinal).trigger('input').trigger('change');

      console.log('[CREAR][PV] presGanador=', ($p.data('presentacion')||'n/a'), 'baseUnidad=', base, 'utilidad=', utilidad, '→ PV=', precioFinal);
    }

    /* ================================
       INICIALIZACIÓN
    ================================= */
 $(function () {
  // DEBUG: chequear existencia de inputs clave
  console.log('[CREAR][INIT] #precio_venta?', document.getElementById('precio_venta') ? 'OK' : 'NO');
  console.log('[CREAR][INIT] name=precio_venta?', document.querySelector('input[name="precio_venta"]') ? 'OK' : 'NO');

  $('.proveedor').each(function () {
    var $w = $(this);
    var pres = ($w.find('.presentacion').val() || 'unidad').toLowerCase();
    var factor = (pres === 'juego') ? 0.5 : 1;
    asegurarHidden($w, 'factor_unidad', 'factor_unidad[]', factor).val(factor);
    asegurarVisibleCostoIVA($w);
    recalcularConIVA($w);
  });

  actualizarProveedorAsignado();
  actualizarPrecioFinal();

  // ==============================
  // ESCOBILLAS: UI + payload hidden
  // ==============================
  (function initEscobillasCreate(){
    var $cat = $('#categoria');
    var $sec = $('#escobillasSection');
    if (!$cat.length || !$sec.length) return;

    var $form = $cat.closest('form');

    var $tipo   = $('#escobillas_tipo');
    var $codJson= $('#escobillas_codigos_json');
    var $kitJson= $('#escobillas_kit_json');

    function findEscobillasCatId(){
      var id = null;
      $cat.find('option').each(function(){
        var txt = ($(this).text() || '').toLowerCase();
        if (txt.includes('escobill')) { id = $(this).val(); return false; }
      });
      return id;
    }

    var ESC_CAT_ID = findEscobillasCatId();

    function setReq($el, on){ if ($el && $el.length) $el.prop('required', !!on); }

    function clearAll(){
      $('#esc_formato').val('unidad');
      $('#esc_tecnologia').val('FLEX');
      $('#esc_codigo').val('');

      $('#esc_kit_tecnologia').val('FLEX');
      $('#esc_kit_conductor').val('');
      $('#esc_kit_acompanante').val('');

      $tipo.val('');
      $codJson.val('');
      $kitJson.val('');
    }

    function buildHidden(){
      var isEsc = ESC_CAT_ID && String($cat.val()) === String(ESC_CAT_ID);
      if (!isEsc) { clearAll(); return; }

      var formato = String($('#esc_formato').val() || 'unidad').toLowerCase();

      if (formato === 'kit') {
        $tipo.val('kit');

        var obj = {
          tecnologia: String($('#esc_kit_tecnologia').val() || 'FLEX').toUpperCase(),
          conductor: ($('#esc_kit_conductor').val() || '').trim(),
          acompanante: ($('#esc_kit_acompanante').val() || '').trim(),
          prioridad: 10
        };

        $kitJson.val(JSON.stringify(obj));
        $codJson.val('[]');
      } else {
        $tipo.val('unidad');

        var arr = [];
        var cod = ($('#esc_codigo').val() || '').trim();
        if (cod) {
          arr.push({
            codigo: cod,
            tecnologia: String($('#esc_tecnologia').val() || 'FLEX').toUpperCase(),
            prioridad: 10
          });
        }

        $codJson.val(JSON.stringify(arr));
        $kitJson.val('');
      }
    }

    function toggleFormato(){
      var formato = String($('#esc_formato').val() || 'unidad').toLowerCase();
      var isKit = (formato === 'kit');

      $('#esc_unidad_block').toggle(!isKit);
      $('#esc_kit_block').toggle(isKit);

      setReq($('#esc_codigo'), !isKit);
      setReq($('#esc_tecnologia'), !isKit);

      setReq($('#esc_kit_conductor'), isKit);
      setReq($('#esc_kit_acompanante'), isKit);
      setReq($('#esc_kit_tecnologia'), isKit);

      buildHidden();
    }

    function toggleSection(){
      var isEsc = ESC_CAT_ID && String($cat.val()) === String(ESC_CAT_ID);

      $sec.toggle(!!isEsc);
      $sec.find('input,select,textarea').prop('disabled', !isEsc);

      if (isEsc) toggleFormato();
      else clearAll();
    }

    $cat.on('change.escobillas', toggleSection);
    $('#esc_formato').on('change.escobillas', toggleFormato);
    $('#esc_tecnologia,#esc_codigo,#esc_kit_tecnologia,#esc_kit_conductor,#esc_kit_acompanante')
      .on('input.escobillas change.escobillas', buildHidden);

    if ($form.length) {
      $form.on('submit.escobillas', function(){
        toggleSection();
        buildHidden();
      });
    }

    toggleSection();
  })();
});

  } // if (window.jQuery)
} // GUARD
