/* ===========================================================
   GUARD: evitar doble carga del script en la VISTA EDITAR
=========================================================== */
if (!window.__EDITAR_INIT__) {
  window.__EDITAR_INIT__ = true;

  /* ===========================================================
     PREVIEW DE IMÁGENES (EDITAR) + EXISTENTES + NUEVAS
     (idéntico a tu flujo actual; sin cambios de comportamiento)
  ============================================================ */
  (function initImagenesEditar() {
    var inputImagen = document.getElementById('imagen');
    var $preview    = document.getElementById('preview');
    var portadaTipo = document.getElementById('portada_tipo'); // 'existente' | 'nueva'
    var portadaExistenteId = document.getElementById('portada_existente_id');
    var portadaNuevaIndex  = document.getElementById('portada_nueva_index');
    var ordenExistentesContainer = document.getElementById('orden_existentes_container');
    var eliminarContainer = document.getElementById('eliminar_imagenes_container');

    if (!inputImagen || !$preview) return;

    function ensureHidden(id, defaultVal) {
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement('input');
        el.type = 'hidden';
        el.id = id;
        el.name = id;
        el.value = defaultVal;
        (document.querySelector('form[data-producto-id]') || document.body).appendChild(el);
      }
      return el;
    }
    portadaTipo        = ensureHidden('portada_tipo','existente');
    portadaExistenteId = ensureHidden('portada_existente_id','');
    portadaNuevaIndex  = ensureHidden('portada_nueva_index','-1');

    if (!ordenExistentesContainer) {
      ordenExistentesContainer = document.createElement('div');
      ordenExistentesContainer.id = 'orden_existentes_container';
      ordenExistentesContainer.style.display = 'none';
      (document.querySelector('form[data-producto-id]') || document.body).appendChild(ordenExistentesContainer);
    }
    if (!eliminarContainer) {
      eliminarContainer = document.createElement('div');
      eliminarContainer.id = 'eliminar_imagenes_container';
      eliminarContainer.style.display = 'none';
      (document.querySelector('form[data-producto-id]') || document.body).appendChild(eliminarContainer);
    }

    var dt = new DataTransfer();

    function markCoverNode(node) {
      Array.from($preview.children).forEach(function (n) { n.classList.remove('is-cover'); });
      if (node) node.classList.add('is-cover');
    }
    function clearOrdenExistentesHidden() {
      if (ordenExistentesContainer) ordenExistentesContainer.innerHTML = '';
    }
    function pushOrdenExistente(id) {
      if (!ordenExistentesContainer) return;
      var inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = 'orden_imagenes_existentes[]';
      inp.value = String(id);
      ordenExistentesContainer.appendChild(inp);
    }
    function pushEliminarExistente(id) {
      if (!eliminarContainer) return;
      var inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = 'eliminar_imagenes[]';
      inp.value = String(id);
      eliminarContainer.appendChild(inp);
    }
    function clampIndex(n) {
      if (isNaN(n) || n < 0) return 0;
      if (n >= dt.files.length) return dt.files.length - 1;
      return n;
    }
    function syncInputFromDT() { inputImagen.files = dt.files; }
    function rebuildOrdenExistentesHidden() {
      clearOrdenExistentesHidden();
      Array.from($preview.children).forEach(function (node) {
        if (node.dataset.type === 'existente') pushOrdenExistente(node.dataset.id);
      });
    }
    function reorderNewFilesFromDOM() {
      var orderNew = [];
      Array.from($preview.children).forEach(function (node) {
        if (node.dataset.type === 'nueva') orderNew.push(parseInt(node.dataset.idx, 10));
      });
      var newDT = new DataTransfer();
      orderNew.forEach(function (oldIdx) { if (dt.files[oldIdx]) newDT.items.add(dt.files[oldIdx]); });
      dt = newDT;
      var k = 0;
      Array.from($preview.children).forEach(function (node) {
        if (node.dataset.type === 'nueva') node.dataset.idx = String(k++);
      });
      syncInputFromDT();
    }
    function setCover(node) {
      if (!node) return;
      var type = node.dataset.type;
      markCoverNode(node);
      if (type === 'existente') {
        portadaTipo.value = 'existente';
        portadaExistenteId.value = node.dataset.id || '';
        portadaNuevaIndex.value = -1;
      } else if (type === 'nueva') {
        portadaTipo.value = 'nueva';
        var idx = parseInt(node.dataset.idx, 10);
        idx = clampIndex(idx);
        if (idx !== 0) {
          var files = Array.from(dt.files);
          var chosen = files[idx];
          files.splice(idx, 1);
          files.unshift(chosen);
          var newDT = new DataTransfer();
          files.forEach(function (f) { newDT.items.add(f); });
          dt = newDT;
          syncInputFromDT();
          var n = 0;
          Array.from($preview.children).forEach(function (nd) {
            if (nd.dataset.type === 'nueva') nd.dataset.idx = String(n++);
          });
        }
        portadaNuevaIndex.value = '0';
        portadaExistenteId.value = '';
      }
    }
    function rebuildNewThumbsAppend() {
      Array.from($preview.querySelectorAll('.thumb[data-type="nueva"], .preview-img[data-type="nueva"]')).forEach(function (n) { n.remove(); });
      Array.from(dt.files).forEach(function (file, idx) {
        var wrap = document.createElement('div');
        wrap.className = 'thumb preview-img';
        wrap.dataset.type = 'nueva';
        wrap.dataset.idx = String(idx);
        var img = document.createElement('img');
        var blobUrl = URL.createObjectURL(file);
        img.src = blobUrl;
        img.alt = file.name;
        img.onload = function () { try { URL.revokeObjectURL(blobUrl); } catch(e){} };
        var badge = document.createElement('span');
        badge.className = 'badge-portada';
        badge.textContent = 'PORTADA';
        wrap.appendChild(img);
        wrap.appendChild(badge);
        $preview.appendChild(wrap);
      });
    }
    function ensureSortable() {
      if (typeof Sortable === 'undefined' || !Sortable) return;
      if ($preview.__sortable) { $preview.__sortable.destroy(); $preview.__sortable = null; }
      $preview.__sortable = new Sortable($preview, {
        animation: 150,
        draggable: '.thumb, .preview-img',
        onEnd: function () {
          rebuildOrdenExistentesHidden();
          reorderNewFilesFromDOM();
          var portadaNode = findPortadaNode();
          if (portadaNode) markCoverNode(portadaNode);
        }
      });
    }
    function findPortadaNode() {
      if (portadaTipo.value === 'existente' && portadaExistenteId.value) {
        return $preview.querySelector('.thumb[data-type="existente"][data-id="' + portadaExistenteId.value + '"], .preview-img[data-type="existente"][data-id="' + portadaExistenteId.value + '"]');
      }
      if (portadaTipo.value === 'nueva') {
        var idx = parseInt(portadaNuevaIndex.value, 10);
        if (!isNaN(idx) && idx >= 0) {
          return $preview.querySelector('.thumb[data-type="nueva"][data-idx="0"], .preview-img[data-type="nueva"][data-idx="0"]');
        }
      }
      return null;
    }
    function marcarPortadaDesdeHidden() {
      var node = findPortadaNode();
      if (!node) {
        var first = $preview.querySelector('.thumb, .preview-img');
        if (first) markCoverNode(first);
      } else {
        markCoverNode(node);
      }
    }

    Array.from($preview.querySelectorAll('.preview-img, .thumb')).forEach(function (node) {
      if (!node.classList.contains('preview-img')) node.classList.add('preview-img');
      if (!node.querySelector('.badge-portada')) {
        var badge = document.createElement('span');
        badge.className = 'badge-portada';
        badge.textContent = 'PORTADA';
        node.appendChild(badge);
      }
      if (!node.dataset.type) {
        var id = node.getAttribute('data-imagen-id') || node.dataset.imagenId;
        node.dataset.type = id ? 'existente' : 'nueva';
        if (id) node.dataset.id = String(id);
      }
    });

    var clickTimer = null, SINGLE_CLICK_DELAY = 220;
    $preview.addEventListener('click', function (e) {
      var thumb = e.target.closest('.thumb, .preview-img'); if (!thumb) return;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(function () { setCover(thumb); clickTimer = null; }, SINGLE_CLICK_DELAY);
    });
    $preview.addEventListener('dblclick', function (e) {
      var thumb = e.target.closest('.thumb, .preview-img'); if (!thumb) return;
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      var type = thumb.dataset.type;
      if (type === 'existente') {
        var id = thumb.dataset.id;
        if (id) pushEliminarExistente(id);
        thumb.remove();
        rebuildOrdenExistentesHidden();
        var portadaNode = findPortadaNode();
        if (!portadaNode || !document.body.contains(portadaNode)) {
          var first = $preview.querySelector('.thumb, .preview-img');
          if (first) setCover(first);
        }
        ensureSortable();
      } else {
        var idx = parseInt(thumb.dataset.idx, 10);
        if (!isNaN(idx)) {
          var newDT = new DataTransfer();
          Array.from(dt.files).forEach(function (f, i) { if (i !== idx) newDT.items.add(f); });
          dt = newDT;
          syncInputFromDT();
          thumb.remove();
          var k = 0;
          Array.from($preview.children).forEach(function (nd) {
            if (nd.dataset.type === 'nueva') nd.dataset.idx = String(k++);
          });
          var firstN = $preview.querySelector('.thumb, .preview-img');
          if (firstN) setCover(firstN);
          ensureSortable();
        }
      }
    });
    inputImagen.addEventListener('change', function (e) {
      var seleccion = Array.from(e.target.files || []);
      if (seleccion.length === 0 && dt.files.length === 0) return;
      seleccion.forEach(function (f) { dt.items.add(f); });
      syncInputFromDT();
      rebuildNewThumbsAppend();
      ensureSortable();
      var portadaNode = findPortadaNode();
      if (!portadaNode) {
        var first = $preview.querySelector('.thumb, .preview-img');
        if (first) setCover(first);
      } else {
        markCoverNode(portadaNode);
      }
      rebuildOrdenExistentesHidden();
    });

    marcarPortadaDesdeHidden();
    rebuildOrdenExistentesHidden();
    ensureSortable();
  })();

  /* ===========================================================
     RESTO DE LA LÓGICA (proveedores, IVA, utilidad, presentación)
     — Unidad / Juego (par) con normalización a unidad
  ============================================================ */

  // Helpers
  function toNumber(v) {
    var n = parseFloat(String(v ?? '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
function redondearAlCentenar(valor) {
  var n = toNumber(valor);
  var resto = n % 100;
  n = (resto < 50) ? (n - resto) : (n + (100 - resto));
  return Math.ceil(n); // asegura entero, sin cambiar tu lógica de centena
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
      var $contenedor = $wrap.find('.costo_iva').closest('.form-group-crear');
      if (!$contenedor.length) $contenedor = $wrap;
      $vis = $('<input>', { type: 'number', step: '0.01', class: 'costo_iva_vis form-control', readonly: true });
      if (!$contenedor.find('.label-costo-iva-vis').length) {
        $('<label class="label-costo-iva-vis">Costo con IVA (por unidad)</label>').insertBefore($vis);
      }
      $contenedor.append($vis);
    }
    return $vis;
  }
  function ensurePresentacionSelect($wrap) {
    var $pres = $wrap.find('select.presentacion');
    if ($pres.length) return $pres;

    var $pivot = $wrap.find('select.IVA').closest('.form-group-crear');
    if (!$pivot.length) $pivot = $wrap.find('.costo_neto').closest('.form-group-crear');
    if (!$pivot.length) $pivot = $wrap;

    var $grp = $('<div class="form-group-crear"></div>');
    var $label = $('<label>Presentación del precio</label>');
    var $sel = $('<select class="presentacion form-control" name="presentacion[]"></select>');
    $sel.append('<option value="unidad" selected>Unidad</option>');
    $sel.append('<option value="juego">Juego (par)</option>');

    $grp.append($label).append($sel);
    $grp.append('<small>Si es "juego", se divide a la mitad (por unidad).</small>');
    $grp.insertAfter($pivot);

    asegurarHidden($wrap, 'factor_unidad', 'factor_unidad[]', 1);

    return $sel;
  }

  function getIVA($wrap) {
    return toNumber($wrap.find('.IVA').val() || 21);
  }

  // ===== Inicialización general =====
  $(function(){
    console.log('[EDITAR][INIT]');
    window.__EDITAR_FIRST_LOAD__ = true;
    $('form').off('keydown.preventEnter').on('keydown.preventEnter', function(e){
      if ((e.key === 'Enter' || e.keyCode === 13) &&
          (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        e.preventDefault();
      }
    });

    window.__seleccionManualProveedor__ = false;

    // ── Leer desde la BD si el proveedor fue seleccionado manualmente ──
    // Si proveedor_es_manual === '1' (guardado en BD), activamos el flag
    // y el init respeta esa elección en lugar de forzar el más barato.
    var esManualBD = $('#proveedor_es_manual').val() === '1';
    if (esManualBD) {
      window.__seleccionManualProveedor__ = true;
    }
    var seleccionadoBD = $('#proveedor_designado').val();
    if (seleccionadoBD) {
      var $radioBD = $('.proveedor-designado-radio').filter(function () {
        return String($(this).val()) === String(seleccionadoBD);
      });
      if ($radioBD.length) {
        $radioBD.prop('checked', true);
        var $bloque = $radioBD.closest('.proveedor');
        var nombre = $bloque.find('.nombre_proveedor').text().trim();
        if (!nombre) {
          nombre = $bloque.find('.proveedores option:selected').text().trim() || '';
          $bloque.find('.nombre_proveedor').text(nombre);
        }
        $('#proveedorAsignado').text(nombre);
      }
    }

    $('.proveedor').each(function () {
      var $w = $(this);
      ensurePresentacionSelect($w);
      asegurarVisibleCostoIVA($w);
      $w.find('.precio_lista').trigger('change'); // dispara neto → con IVA (y present.)
    });

    if (!window.__seleccionManualProveedor__) actualizarProveedorAsignado();
    actualizarPrecioFinal();          // con __EDITAR_FIRST_LOAD__=true: no toca precio_venta
    window.__EDITAR_FIRST_LOAD__ = false;  // apagamos el flag AQUI, una sola vez, al terminar el init
    syncIVAProductoConAsignado();
    actualizarBadgeManual();          // mostrar/ocultar badge y avisos según estado inicial
    initEscobillasEditar();

  });
  function initEscobillasEditar() {
  var $cat = $('#categoria');
  var $sec = $('#escobillasSection');
  if (!$cat.length || !$sec.length) return;

  var $tipo    = $('#escobillas_tipo');
  var $codJson = $('#escobillas_codigos_json');
  var $kitJson = $('#escobillas_kit_json');

  function getEscobillasCategoriaId() {
    var id = null;
    $cat.find('option').each(function () {
      var txt = ($(this).text() || '').trim().toLowerCase();
      if (txt.includes('escobill')) {
        id = $(this).val();
        return false;
      }
    });
    return id;
  }

  var ESC_CAT_ID = getEscobillasCategoriaId();

  function setEnabled(enabled) {
    $sec.find('input, select, textarea').prop('disabled', !enabled);
  }

  function setReq($el, on) {
    if ($el && $el.length) $el.prop('required', !!on);
  }

  function hydrateFromHidden() {
    var tipo = String($tipo.val() || '').toLowerCase();

    // Si inputs están vacíos, los hidratamos desde los hidden JSON
    if (tipo === 'kit') {
      var con = ($('#esc_kit_conductor').val() || '').trim();
      var aco = ($('#esc_kit_acompanante').val() || '').trim();
      if ((!con || !aco) && $kitJson.val()) {
        try {
          var obj = JSON.parse($kitJson.val() || 'null');
          if (obj) {
            $('#esc_kit_tecnologia').val(String(obj.tecnologia || 'FLEX').toUpperCase());
            $('#esc_kit_conductor').val((obj.conductor || '').trim());
            $('#esc_kit_acompanante').val((obj.acompanante || '').trim());
          }
        } catch (e) {}
      }
      $('#esc_formato').val('kit');
    } else {
      var cod = ($('#esc_codigo').val() || '').trim();
      if (!cod && $codJson.val()) {
        try {
          var arr = JSON.parse($codJson.val() || '[]');
          var it = Array.isArray(arr) && arr.length ? arr[0] : null;
          if (it) {
            $('#esc_tecnologia').val(String(it.tecnologia || 'FLEX').toUpperCase());
            $('#esc_codigo').val((it.codigo || '').trim());
          }
        } catch (e) {}
      }
      if (!$('#esc_formato').val()) $('#esc_formato').val('unidad');
    }
  }

  function buildHidden() {
    var isEsc = !!ESC_CAT_ID && String($cat.val()) === String(ESC_CAT_ID);
    if (!isEsc) return;

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

  function toggleFormato() {
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

  function clearAll() {
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

  function toggleSection() {
    ESC_CAT_ID = ESC_CAT_ID || getEscobillasCategoriaId();
    var isEsc = !!ESC_CAT_ID && String($cat.val()) === String(ESC_CAT_ID);

    $sec.toggle(isEsc);
    setEnabled(isEsc);

    if (isEsc) {
      hydrateFromHidden();
      toggleFormato();
      buildHidden();
    } else {
      clearAll();
    }
  }

  // Eventos
  $cat.off('change.escobillasEditar').on('change.escobillasEditar', toggleSection);

  $('#esc_formato')
    .off('change.escobillasEditarFormato')
    .on('change.escobillasEditarFormato', function () {
      toggleFormato();
    });

  $('#esc_tecnologia,#esc_codigo,#esc_kit_tecnologia,#esc_kit_conductor,#esc_kit_acompanante')
    .off('input.escobillasEditar change.escobillasEditar')
    .on('input.escobillasEditar change.escobillasEditar', buildHidden);

  // Antes de submit, garantizamos hidden correcto
  var $form = $('form');
  if ($form.length) {
    $form.off('submit.escobillasEditar').on('submit.escobillasEditar', function () {
      toggleSection();
      buildHidden();
    });
  }

  // Init
  toggleSection();
}

  // ===== Badge de selección manual + aviso en proveedor más barato ignorado =====
  function actualizarBadgeManual() {
    var esManual = window.__seleccionManualProveedor__;

    // Badge y botón en el header de proveedores
    $('#badgeManual').toggle(esManual);
    $('#btnVolverMasBarato').toggle(esManual);
    $('#labelProveedorAuto').toggle(!esManual);

    // Quitar avisos y borde amarillo de todas las cards
    $('.proveedor').each(function () {
      $(this).removeClass('cr-prov-card--mas-barato-ignorado');
      $(this).find('.cr-aviso-mas-barato').hide();
    });

    if (esManual) {
      // Marcar el proveedor más barato si NO es el que está seleccionado
      var $masBarato = getProveedorConCostoIvaMasBajo();
      var $radioChecked = $('.proveedor-designado-radio:checked');
      if ($masBarato && $masBarato.length && $radioChecked.length) {
        var provManual = $radioChecked.val();
        var provBarato = $masBarato.find('.proveedor-designado-radio').val();
        if (provManual !== provBarato) {
          $masBarato.addClass('cr-prov-card--mas-barato-ignorado');
          $masBarato.find('.cr-aviso-mas-barato').show();
        }
      }
    }
  }

  // ===== Delegación de eventos =====
  $(document)
    .off('change.provSel', '.proveedores')
    .on('change.provSel', '.proveedores', function () {
      var $wrap = $(this).closest('.proveedor');
      actualizarProveedor($(this));
      $wrap.find('.precio_lista').trigger('change');

      if ($wrap.find('.proveedor-designado-radio').is(':checked')) {
        $('#proveedor_designado').val($(this).val() || '');
        actualizarPrecioFinal();
      } else if (!window.__seleccionManualProveedor__) {
        actualizarProveedorAsignado();
        actualizarPrecioFinal();
      }
      syncIVAProductoConAsignado();
    })
    .off('input change.precioLista', '.precio_lista')
    .on('input change.precioLista', '.precio_lista', function () {
      // FIX Bug 2: propagar cambio de precio_lista al proveedor asignado y precio final.
      // Antes solo se recalculaba el costo_neto/costo_iva del bloque, sin actualizar
      // el proveedor ganador ni el precio de venta. Resultado: habia que guardar y
      // volver a entrar para que tomara el proveedor mas barato.
      actualizarPrecio($(this));
      if (!window.__seleccionManualProveedor__) actualizarProveedorAsignado();
      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
    })
    .off('input change.iva', '.IVA')
    .on('input change.iva', '.IVA', function () {
      var $wrap = $(this).closest('.proveedor');
      recalcularConIVA($wrap);
      if (!window.__seleccionManualProveedor__) actualizarProveedorAsignado();
      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
    })
    // 🔴 Handler: Presentación Unidad/Juego
    .off('change.presentacion', '.presentacion')
    .on('change.presentacion', '.presentacion', function () {
      var $w = $(this).closest('.proveedor');
      var pres = ($(this).val() || 'unidad').toLowerCase();
      var factor = (pres === 'juego') ? 0.5 : 1;

      console.log('[EDITAR][PRES] cambio →', pres, 'factor=', factor,
                  'provId=', $w.data('proveedor-id'));

      // sincronizar hidden factor
      asegurarHidden($w, 'factor_unidad', 'factor_unidad[]', factor).val(factor);

      // recalcular con override por si hubiera rarezas del DOM
      recalcularConIVA($w, pres);

      if (!window.__seleccionManualProveedor__) actualizarProveedorAsignado();
      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
    })
    .off('input change.utilidad', '#utilidad')
    .on('input change.utilidad', '#utilidad', function () {
      console.log('[EDITAR][UTILIDAD] cambio →', $(this).val());
      actualizarPrecioFinal();
    })
    .off('change.provRadio', '.proveedor-designado-radio')
    .on('change.provRadio', '.proveedor-designado-radio', function () {
      window.__seleccionManualProveedor__ = true;
      $('#proveedor_es_manual').val('1');  // persistir en el form
      $('.proveedor-designado-radio').not(this).prop('checked', false);
      $(this).prop('checked', true);

      var proveedorId = $(this).val() || '';
      $('#proveedor_designado').val(proveedorId);

      var $wrap = $(this).closest('.proveedor');
      var nombre = $wrap.find('.nombre_proveedor').text().trim();
      if (!nombre) {
        nombre = $wrap.find('.proveedores option:selected').text().trim() || '';
        $wrap.find('.nombre_proveedor').text(nombre);
      }
      $('#proveedorAsignado').text(nombre);

      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
      actualizarBadgeManual();
    })
    // +++ Volver al proveedor más barato (limpiar selección manual) +++
    .off('click.volverBarato', '#btnVolverMasBarato')
    .on('click.volverBarato', '#btnVolverMasBarato', function () {
      window.__seleccionManualProveedor__ = false;
      $('#proveedor_es_manual').val('0');
      actualizarProveedorAsignado();
      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
      actualizarBadgeManual();
    })
    // +++ Agregar proveedor +++
    .off('click.addProv', '#addProveedor')
    .on('click.addProv', '#addProveedor', function () {
      var $container = $('#proveedoresContainer');
      var optsHTML = ($('.proveedores').first().html() || '<option value="">Selecciona proveedor...</option>');

      var $card = $(`
        <div class="proveedor cr-prov-card" data-proveedor-id="">
          <div class="form-group-crear cr-field cr-field--inline">
            <label class="cr-label">Usar este proveedor</label>
            <label class="cr-toggle">
              <input type="radio" name="proveedor_designado_radio" class="proveedor-designado-radio cr-toggle__input" value="">
              <span class="cr-toggle__slider"></span>
            </label>
          </div>

          <div class="form-group-crear cr-field">
            <label class="label-proveedor cr-label">Proveedor <span class="nombre_proveedor cr-prov-nombre"></span></label>
            <select class="proveedores cr-select form-control" name="proveedores[]">
              ${optsHTML}
            </select>
          </div>

          <div class="form-group-crear cr-field">
            <label class="label-codigo cr-label">Código proveedor</label>
            <input class="codigo cr-input form-control" type="text" name="codigo[]" value="">
          </div>

          <div class="cr-prov-grid">
            <div class="form-group-crear cr-field">
              <label class="label-precio-lista cr-label">Precio de lista</label>
              <input class="precio_lista cr-input form-control" type="number" step="0.01" name="precio_lista[]" value="">
            </div>
            <div class="form-group-crear cr-field">
              <label class="label-descuento cr-label">Descuento prov.</label>
              <input class="descuentos_proveedor_id cr-input cr-input--readonly form-control" type="text" name="descuentos_proveedor_id[]" value="0" readonly>
            </div>
          </div>

          <div class="form-group-crear cr-field">
            <label class="cr-label">Precio de costo (Neto)</label>
            <input class="costo_neto cr-input cr-input--readonly form-control" type="number" name="costo_neto[]" value="0" readonly>
          </div>

          <div class="cr-prov-grid">
            <div class="form-group-crear cr-field">
              <label class="cr-label">Presentación</label>
              <select class="presentacion cr-select form-control" name="presentacion[]">
                <option value="unidad" selected>Unidad</option>
                <option value="juego">Juego (par)</option>
              </select>
              <input type="hidden" class="factor_unidad" name="factor_unidad[]" value="1">
            </div>
            <div class="form-group-crear cr-field">
              <label class="cr-label">IVA</label>
              <select class="IVA cr-select form-control" name="IVA[]">
                <option value="21" selected>21%</option>
                <option value="10.5">10,5%</option>
              </select>
            </div>
          </div>

          <div class="form-group-crear cr-field campo-costo-iva">
            <label class="cr-label">Costo con IVA (por unidad)</label>
            <input class="costo_iva_vis cr-input cr-input--readonly form-control" type="number" step="0.01" value="" readonly>
            <input class="costo_iva" type="hidden" name="costo_iva[]" value="0">
          </div>

          <button class="eliminar-proveedor cr-btn cr-btn--danger cr-btn--sm" type="button">
            <i class="fa-solid fa-trash"></i> Eliminar proveedor
          </button>
        </div>
      `);

      // Insertar justo antes del botón #addProveedor (que es hijo directo del container, sin wrapper)
      var $btn = $container.find('#addProveedor');
      if ($btn.length) {
        $btn.before($card);
      } else {
        $container.append($card);
      }

      var $sel = $card.find('.proveedores');
      $sel.val($sel.find('option:first').val() || '');
      actualizarProveedor($sel);

      ensurePresentacionSelect($card);
      asegurarVisibleCostoIVA($card);
      $card.find('.precio_lista').trigger('change');

      if (!window.__seleccionManualProveedor__) actualizarProveedorAsignado();
      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
    })
    // +++ Eliminar proveedor +++
    .off('click.delProv', '.eliminar-proveedor')
    .on('click.delProv', '.eliminar-proveedor', function () {
      var $form = $('form.contenido-editar').length ? $('form.contenido-editar') : $('form');
      var $card = $(this).closest('.proveedor');

      // si existía (tiene proveedor_id asignado) agregamos hidden para borrar en DB
      var provId = $card.data('proveedor-id');
      if (!provId) {
        // fallback: si no tiene data, intento con el valor del select (por si estaba set)
        provId = $card.find('.proveedores').val();
      }
      if (provId) {
        $('<input>', { type: 'hidden', name: 'eliminar_proveedores[]', value: String(provId) }).appendTo($form);
      }

      // si era el proveedor seleccionado manualmente, reseteo esa preferencia
      if ($card.find('.proveedor-designado-radio').is(':checked')) {
        window.__seleccionManualProveedor__ = false;
        $('#proveedor_es_manual').val('0');
        $('#proveedor_designado').val('');
      }

      // quitar del DOM
      $card.remove();

      // recalcular todo
      if (!window.__seleccionManualProveedor__) actualizarProveedorAsignado();
      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
      actualizarBadgeManual();
    });

  // ===== Cálculos por bloque =====
  function actualizarProveedor($select) {
    var $wrap = $select.closest('.proveedor');
    var $opt = $select.find('option:selected');

    var nombreProveedor = $opt.text() || '';
    var descuento = toNumber($opt.data('descuento'));
    $wrap.find('.nombre_proveedor').text(nombreProveedor);

    // actualizar value del radio y data-proveedor-id de la card
    var val = $select.val() || '';
    $wrap.find('.proveedor-designado-radio').val(val);
    if (val) { $wrap.attr('data-proveedor-id', val); }

    var $hiddenDesc = $wrap.find('.descuentos_proveedor_id');
    if ($hiddenDesc.length === 0) {
      $hiddenDesc = $('<input>', { type: 'hidden', class: 'descuentos_proveedor_id', name: 'descuentos_proveedor_id[]', value: 0 });
      $wrap.append($hiddenDesc);
    }
    $hiddenDesc.val(descuento);

    var suf = nombreProveedor ? ' (' + nombreProveedor + ')' : '';
    $wrap.find('.label-codigo').text('Código' + suf);
    $wrap.find('.label-precio-lista').text('Precio de Lista' + suf);
    $wrap.find('.label-descuento').text('Descuento' + suf);
  }

  // FIX redondeo: calcular costo_neto SIN Math.ceil intermedio para evitar
  // que el +1 del ceil se amplifique por IVA y utilidad hasta saltar de centena.
  // El hidden costo_neto[] guarda el valor exacto (float); solo se redondea
  // el precio de venta final (igual que hace el servidor en actualizarPreciosPDF).
  // El campo visible se muestra redondeado a entero solo para la UI.
  function actualizarPrecio($precioLista) {
    var $wrap = $precioLista.closest('.proveedor');

    ensurePresentacionSelect($wrap);
    asegurarVisibleCostoIVA($wrap);

    var pl = toNumber($precioLista.val());
    var desc = toNumber($wrap.find('.descuentos_proveedor_id').val());

    var $costoNeto = asegurarHidden($wrap, 'costo_neto', 'costo_neto[]', 0);
    var costoNeto = pl - (pl * desc / 100);  // valor exacto, SIN Math.ceil
    $costoNeto.val(costoNeto);               // guardamos el float exacto en el hidden

    console.log('[EDITAR][NETO] PL=', pl, 'desc=', desc, '→ neto=', costoNeto);

    recalcularConIVA($wrap);
  }

  // ⟶ COSTO con IVA (hidden por unidad, visible por unidad)
  //    Si Presentación = "juego" → divide a la mitad
  function recalcularConIVA($wrap, presOverride) {
    ensurePresentacionSelect($wrap);
    asegurarVisibleCostoIVA($wrap);

    var cn  = toNumber($wrap.find('.costo_neto').val()); // neto SIN IVA (float exacto)
    var iva = getIVA($wrap);
    if (!iva) iva = 21;

    var presSel = ($wrap.find('.presentacion').val() || 'unidad').toLowerCase();
    var pres = (presOverride || presSel);

    // FIX redondeo: NO aplicar Math.ceil al costo_neto intermedio.
    // Trabajamos con floats hasta el Math.ceil final sobre costo_iva_unit,
    // igual que lo hace el servidor en actualizarPreciosPDF y el controller.
    var cnUnidad = (pres === 'juego') ? cn * 0.5 : cn;
    var cIVA_unit = Math.ceil(cnUnidad * (1 + iva / 100));

    asegurarHidden($wrap, 'costo_iva', 'costo_iva[]', 0).val(cIVA_unit);
    $wrap.find('.costo_iva_vis').val(cIVA_unit);

    var factor = (pres === 'juego') ? 0.5 : 1;
    asegurarHidden($wrap, 'factor_unidad', 'factor_unidad[]', factor).val(factor);

    $wrap.data('presentacion', pres);
    $wrap.data('civa_unit', cIVA_unit);

    console.log('[EDITAR][IVA] pres=', pres, 'cn=', cn, 'iva=', iva, '→ unit=', cIVA_unit, 'visible=', cIVA_unit, 'factor=', factor);
  }

  // ===== Proveedor más barato (por unidad) =====
  function getProveedorConCostoIvaMasBajo() {
    var $g = null, min = Infinity;
    $('.proveedor').each(function () {
      var v = toNumber($(this).find('.costo_iva').val()); // hidden por unidad
      if (!isNaN(v) && v > 0 && v < min) { min = v; $g = $(this); } // v>0: excluir proveedores sin precio
    });
    return $g;
  }

  function actualizarProveedorAsignado() {
    var $radioChecked = $('.proveedor-designado-radio:checked');
    if (window.__seleccionManualProveedor__ && $radioChecked.length) {
      var $p = $radioChecked.closest('.proveedor');
      var nombreManual = $p.find('.nombre_proveedor').text().trim();
      if (!nombreManual) {
        nombreManual = $p.find('.proveedores option:selected').text().trim() || '';
        $p.find('.nombre_proveedor').text(nombreManual);
      }
      $('#proveedorAsignado').text(nombreManual);
      $('#proveedor_designado').val($radioChecked.val() || '');
      return;
    }

    var $proveedor = getProveedorConCostoIvaMasBajo();
    var nombre = '';
    $('.proveedor-designado-radio').prop('checked', false);

    if ($proveedor && $proveedor.length) {
      nombre = $proveedor.find('.nombre_proveedor').text().trim();
      if (!nombre) {
        nombre = $proveedor.find('.proveedores option:selected').text().trim() || '';
        $proveedor.find('.nombre_proveedor').text(nombre);
      }
      var $radio = $proveedor.find('.proveedor-designado-radio');
      if ($radio.length) {
        $radio.prop('checked', true);
        $('#proveedor_designado').val($radio.val() || '');
      } else {
        var provIdSel = $proveedor.find('.proveedores').val();
        if (provIdSel) $('#proveedor_designado').val(provIdSel);
      }
    } else {
      $('#proveedor_designado').val('');
    }

    $('#proveedorAsignado').text(nombre);
  }

  // ===== Precio final (utilidad) =====
function actualizarPrecioFinal(opts) {
  opts = opts || {};

  var $proveedor;
  var $radioChecked = $('.proveedor-designado-radio:checked');
  if (window.__seleccionManualProveedor__ && $radioChecked.length) {
    $proveedor = $radioChecked.closest('.proveedor');
  } else {
    $proveedor = getProveedorConCostoIvaMasBajo();
  }

  if (!$proveedor || !$proveedor.length) return;

  var baseUnit = toNumber($proveedor.find('.costo_iva').val()); // SIEMPRE unidad
  if (!baseUnit) return;

  // FIX Bug 3 (corregido): durante el init, __EDITAR_FIRST_LOAD__ se mantiene en true
  // hasta que el init lo apaga explícitamente al final — después de esta última llamada.
  // Así cualquier actualizarPrecioFinal() disparada por trigger('change') durante el init
  // también entra aquí con el flag en true y no toca precio_venta.
  // El flag ya NO se apaga dentro de esta función; el init es el único responsable de hacerlo.
  if (window.__EDITAR_FIRST_LOAD__) {
    actualizarProveedorAsignado();
    syncIVAProductoConAsignado();
    return;  // no tocar precio_venta durante el init
  }

  var utilidad = toNumber($('#utilidad').val());
  var precioFinal = baseUnit * (1 + (utilidad / 100));
  precioFinal = redondearAlCentenar(precioFinal);

  var $pv = $('#precio_venta, input[name="precio_venta"]').first();
  $pv.val(precioFinal).trigger('input').trigger('change');

  console.log('[EDITAR][PV] presGanador=',
    ($proveedor.data('presentacion') || $proveedor.find('.presentacion').val() || 'unidad'),
    'baseUnidad=', baseUnit, 'utilidad=', utilidad, '\u2192 PV=', precioFinal
  );

  actualizarProveedorAsignado();
  syncIVAProductoConAsignado();
}


  // ===== Sincroniza IVA del producto según el proveedor asignado =====
  function syncIVAProductoConAsignado() {
    var $form = $('form.contenido-editar');
    if ($form.length === 0) $form = $('form');
    var $ivaProd = $form.find('#iva_producto');
    if (!$ivaProd.length) {
      $ivaProd = $('<input>', { type: 'hidden', id: 'iva_producto', name: 'IVA_producto', value: 21 });
      $form.append($ivaProd);
    }

    var $proveedor;
    var $radioChecked = $('.proveedor-designado-radio:checked');
    if (window.__seleccionManualProveedor__ && $radioChecked.length) {
      $proveedor = $radioChecked.closest('.proveedor');
    } else {
      $proveedor = getProveedorConCostoIvaMasBajo();
    }
    if (!$proveedor || !$proveedor.length) { $ivaProd.val(21); return; }

    var ivaSel = getIVA($proveedor) || 21;
    $ivaProd.val(ivaSel);
  }

  // ===== Logger global =====
  window.addEventListener('error', function (e) {
    console.error('[JS ERROR]', e.message, e.filename + ':' + e.lineno + ':' + e.colno);
  });
}