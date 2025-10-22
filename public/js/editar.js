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
        (document.querySelector('form') || document.body).appendChild(el);
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
      (document.querySelector('form') || document.body).appendChild(ordenExistentesContainer);
    }
    if (!eliminarContainer) {
      eliminarContainer = document.createElement('div');
      eliminarContainer.id = 'eliminar_imagenes_container';
      eliminarContainer.style.display = 'none';
      (document.querySelector('form') || document.body).appendChild(eliminarContainer);
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
    return (resto < 50) ? (n - resto) : (n + (100 - resto));
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

    $('form').off('keydown.preventEnter').on('keydown.preventEnter', function(e){
      if ((e.key === 'Enter' || e.keyCode === 13) &&
          (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        e.preventDefault();
      }
    });

    window.__seleccionManualProveedor__ = false;

    var seleccionadoBD = $('#proveedor_designado').val();
    if (seleccionadoBD) {
      var $radioBD = $('.proveedor-designado-radio').filter(function () {
        return String($(this).val()) === String(seleccionadoBD);
      });
      if ($radioBD.length) {
        $radioBD.prop('checked', true);
        window.__seleccionManualProveedor__ = true;
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
    actualizarPrecioFinal();
    syncIVAProductoConAsignado();
  });

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
      actualizarPrecio($(this));
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
    })
    // +++ NUEVO: Agregar proveedor +++
    .off('click.addProv', '#addProveedor')
    .on('click.addProv', '#addProveedor', function () {
      var $container = $('#proveedoresContainer');
      // Tomamos el HTML de opciones del primer select de proveedores
      var optsHTML = ($('.proveedores').first().html() || '<option value="">Selecciona proveedor...</option>');

      // Construimos la card
      var $card = $(`
        <div class="proveedor" data-proveedor-id="">
          <div class="form-group-crear">
            <label class="radio-elige-proveedor">
              <input type="radio" name="proveedor_designado_radio" class="proveedor-designado-radio" value="">
              Usar este proveedor
            </label>
          </div>

          <div class="form-group-crear">
            <label class="label-proveedor">Proveedor <span class="nombre_proveedor"></span></label>
            <select class="proveedores form-control" name="proveedores[]">
              ${optsHTML}
            </select>
          </div>

          <div class="form-group-crear">
            <label class="label-codigo">Código</label>
            <input class="codigo form-control" type="text" name="codigo[]" value="">
          </div>

          <div class="form-group-crear">
            <label class="label-precio-lista">Precio de Lista</label>
            <input class="precio_lista form-control" type="number" step="0.01" name="precio_lista[]" value="">
          </div>

          <div class="form-group-crear">
            <label class="label-descuento">Descuento</label>
            <input class="descuentos_proveedor_id form-control" type="text" name="descuentos_proveedor_id[]" value="0" readonly>
          </div>

          <div class="form-group-crear">
            <label>Precio de costo (Neto)</label>
            <input class="costo_neto form-control" type="number" name="costo_neto[]" value="0" readonly>
          </div>

          <div class="form-group-crear">
            <label>IVA</label>
            <select class="IVA form-control" name="IVA[]">
              <option value="21" selected>21%</option>
              <option value="10.5">10,5%</option>
            </select>
          </div>

          <div class="form-group-crear">
            <label>Presentación del precio</label>
            <select class="presentacion form-control" name="presentacion[]">
              <option value="unidad" selected>Unidad</option>
              <option value="juego">Juego (par)</option>
            </select>
            <small>Si es "juego", se divide a la mitad (por unidad) para comparar y calcular.</small>
            <input type="hidden" class="factor_unidad" name="factor_unidad[]" value="1">
          </div>

          <div class="form-group-crear campo-costo-iva">
            <label>Costo con IVA (por unidad)</label>
            <input class="costo_iva_vis form-control" type="number" step="0.01" value="" readonly>
          </div>

          <input class="costo_iva" type="hidden" name="costo_iva[]" value="0">

          <div class="form-group-crear">
            <button class="eliminar-proveedor btn btn-outline-danger" type="button">Eliminar proveedor</button>
          </div>
        </div>
      `);

      // Anexar y inicializar
      $container.find('#addProveedor').closest('.form-group-crear').before($card);

      // Setear proveedor a vacío y actualizar labels
      var $sel = $card.find('.proveedores');
      $sel.val($sel.find('option:first').val() || '');
      actualizarProveedor($sel);

      // Asegurar elementos auxiliares y calcular
      ensurePresentacionSelect($card);
      asegurarVisibleCostoIVA($card);

      // Disparar cálculo (neto → IVA → normalización)
      $card.find('.precio_lista').trigger('change');

      // Recalcular proveedor asignado/IVA producto/PV si no hay selección manual
      if (!window.__seleccionManualProveedor__) actualizarProveedorAsignado();
      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
    })
    // +++ NUEVO: Eliminar proveedor +++
    .off('click.delProv', '.eliminar-proveedor')
    .on('click.delProv', '.eliminar-proveedor', function () {
      var $card = $(this).closest('.proveedor');
      $card.remove();
      if (!window.__seleccionManualProveedor__) actualizarProveedorAsignado();
      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
    });

  // ===== Cálculos por bloque =====
  function actualizarProveedor($select) {
    var $wrap = $select.closest('.proveedor');
    var $opt = $select.find('option:selected');

    var nombreProveedor = $opt.text() || '';
    var descuento = toNumber($opt.data('descuento'));
    $wrap.find('.nombre_proveedor').text(nombreProveedor);

    $wrap.find('.proveedor-designado-radio').val($select.val() || '');

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

  // ⟶ COSTO NETO (visible) = PL - (PL * desc/100)
  function actualizarPrecio($precioLista) {
    var $wrap = $precioLista.closest('.proveedor');

    ensurePresentacionSelect($wrap);
    asegurarVisibleCostoIVA($wrap);

    var pl = toNumber($precioLista.val());
    var desc = toNumber($wrap.find('.descuentos_proveedor_id').val());

    var $costoNeto = asegurarHidden($wrap, 'costo_neto', 'costo_neto[]', 0);
    var costoNeto = pl - (pl * desc / 100);
    $costoNeto.val(Math.ceil(costoNeto));

    console.log('[EDITAR][NETO] PL=', pl, 'desc=', desc, '→ neto=', $costoNeto.val());

    recalcularConIVA($wrap);
  }

  // ⟶ COSTO con IVA (hidden por unidad, visible por unidad)
  //    Si Presentación = "juego" → divide a la mitad
  function recalcularConIVA($wrap, presOverride) {
    ensurePresentacionSelect($wrap);
    asegurarVisibleCostoIVA($wrap);

    var cn  = toNumber($wrap.find('.costo_neto').val()); // neto SIN IVA
    var iva = getIVA($wrap);
    if (!iva) iva = 21;

    var presSel = ($wrap.find('.presentacion').val() || 'unidad').toLowerCase();
    var pres = (presOverride || presSel);

    var cIVA_unit;
    if (pres === 'juego') {
      var cnUnidad = cn * 0.5;
      cIVA_unit = Math.ceil(cnUnidad * (1 + iva / 100));
    } else {
      var cnUnidad2 = cn;
      cIVA_unit = Math.ceil(cnUnidad2 * (1 + iva / 100));
    }

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
      if (!isNaN(v) && v < min) { min = v; $g = $(this); }
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
  function actualizarPrecioFinal() {
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

    var utilidad = toNumber($('#utilidad').val());
    var precioFinal = baseUnit * (1 + (utilidad / 100));
    precioFinal = redondearAlCentenar(precioFinal);

    $('#precio_venta, input[name="precio_venta"]').val(precioFinal).trigger('input').trigger('change');

    console.log('[EDITAR][PV] presGanador=', ($proveedor.data('presentacion')||$proveedor.find('.presentacion').val()||'unidad'),
                'baseUnidad=', baseUnit, 'utilidad=', utilidad, '→ PV=', precioFinal);

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
