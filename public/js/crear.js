/* ================================
   GUARD: evitar doble carga del script en la VISTA CREAR
================================ */
if (!window.__CREAR_INIT__) {
  window.__CREAR_INIT__ = true;

  /* ================================
     PREVIEW DE IMÁGENES + SORTABLE
     - Clic: marcar portada
     - Doble-clic: eliminar
     - Drag & drop: reordenar
     - Mantiene el FileList sincronizado usando DataTransfer
  ================================= */
  (function initPreview() {
    var inputImagen = document.getElementById('imagen');
    var $portadaHidden = document.getElementById('portada_index');
    var $preview = document.getElementById('preview');

    if (!inputImagen || !$portadaHidden || !$preview) {
      // Si falta alguno de estos nodos, no inicializamos para evitar errores.
      return;
    }

    // DataTransfer global para manipular archivos
    var dt = new DataTransfer();

    // Utilidad: normalizar índices válidos
    function clampIndex(n) {
      if (isNaN(n) || n < 0) return 0;
      if (n >= dt.files.length) return dt.files.length - 1;
      return n;
    }

    // Marca visual de portada
    function markCover(idx) {
      Array.from($preview.children).forEach(function (node, i) {
        if (i === idx) node.classList.add('is-cover');
        else node.classList.remove('is-cover');
      });
      $portadaHidden.value = String(idx);
    }

    // Reflejar dt en el input real
    function syncInputFromDT() {
      inputImagen.files = dt.files;
    }

    // Reordena dt siguiendo el orden visual de .thumb
    function syncDTfromDOM() {
      var order = Array.from($preview.children).map(function (node) {
        return parseInt(node.dataset.idx, 10);
      });

      var newDT = new DataTransfer();
      order.forEach(function (oldIdx) {
        newDT.items.add(dt.files[oldIdx]);
      });
      dt = newDT;

      // Actualizo data-idx en DOM
      Array.from($preview.children).forEach(function (node, i) {
        node.dataset.idx = String(i);
      });

      // Por UX, al reordenar dejo como portada la primera visible
      markCover(0);
      syncInputFromDT();
    }

    // Elimina archivo en índice
    function removeAt(index) {
      if (index < 0 || index >= dt.files.length) return;
      var newDT = new DataTransfer();
      Array.from(dt.files).forEach(function (f, i) {
        if (i !== index) newDT.items.add(f);
      });
      dt = newDT;
      syncInputFromDT();
      rebuildPreviewFromDT();
    }

    // Setea portada moviendo ese archivo a la posición 0 de dt
    function setCover(index) {
      index = clampIndex(index);
      if (index === 0) {
        markCover(0);
        return;
      }
      var files = Array.from(dt.files);
      var chosen = files[index];
      files.splice(index, 1);
      files.unshift(chosen);

      var newDT = new DataTransfer();
      files.forEach(function (f) { newDT.items.add(f); });
      dt = newDT;

      syncInputFromDT();
      rebuildPreviewFromDT();
      markCover(0);
    }

    // Construye/reconstruye las miniaturas desde dt
    function rebuildPreviewFromDT() {
      $preview.innerHTML = '';

      Array.from(dt.files).forEach(function (file, idx) {
        var wrap = document.createElement('div');
        wrap.className = 'thumb';
        wrap.dataset.idx = String(idx);

        var img = document.createElement('img');
        var blobUrl = URL.createObjectURL(file);
        img.src = blobUrl;
        img.alt = file.name;

        // ✅ revocar URL al terminar de cargar (evita glitches y pérdidas de memoria)
        img.onload = function () {
          try { URL.revokeObjectURL(blobUrl); } catch (e) {}
        };

        var badge = document.createElement('span');
        badge.className = 'badge-portada';
        badge.textContent = 'PORTADA';

        wrap.appendChild(img);
        wrap.appendChild(badge);
        $preview.appendChild(wrap);
      });

      // Asegurar una portada siempre
      var portadaIdx = clampIndex(parseInt($portadaHidden.value, 10));
      markCover(portadaIdx);

      // (Re)inicializar Sortable si está disponible
      if (typeof Sortable !== 'undefined' && Sortable) {
        if ($preview.__sortable) {
          $preview.__sortable.destroy();
          $preview.__sortable = null;
        }
        $preview.__sortable = new Sortable($preview, {
          animation: 150,
          draggable: '.thumb',
          onEnd: syncDTfromDOM
        });
      }
    }

    // ✅ Diferenciar CLICK vs DBLCLICK
    var clickTimer = null;
    var SINGLE_CLICK_DELAY = 220; // ms

    $preview.addEventListener('click', function (e) {
      var thumb = e.target.closest('.thumb');
      if (!thumb) return;

      // Si se va a producir un doble-click, este timer será cancelado abajo
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(function () {
        var idx = Array.from($preview.children).indexOf(thumb);
        if (idx < 0) return;
        setCover(idx);          // ⟵ solo click: marcar portada
        clickTimer = null;
      }, SINGLE_CLICK_DELAY);
    });

    $preview.addEventListener('dblclick', function (e) {
      var thumb = e.target.closest('.thumb');
      if (!thumb) return;

      // Cancelar el click simple pendiente
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }

      var idx = Array.from($preview.children).indexOf(thumb);
      if (idx < 0) return;

      // ⟵ doble-click: eliminar
      removeAt(idx);
    });

    // Cuando el usuario selecciona archivos
    inputImagen.addEventListener('change', function (e) {
      var seleccion = Array.from(e.target.files || []);
      if (seleccion.length === 0 && dt.files.length === 0) return;

      // Por defecto: agrego a dt (si preferís reemplazar, descomentá la línea siguiente)
      // dt = new DataTransfer();

      seleccion.forEach(function (f) { dt.items.add(f); });
      syncInputFromDT();

      // si no hay portada previa, por defecto la primera
      if (dt.files.length > 0 && (isNaN(parseInt($portadaHidden.value, 10)) || parseInt($portadaHidden.value, 10) < 0)) {
        $portadaHidden.value = '0';
      }

      rebuildPreviewFromDT();
      // asegurar portada al primer elemento
      markCover(0);
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
       UTILIDADES GENERALES
    ================================= */
    // Evitar submit con Enter en cualquier form
    $(document).off('keypress.preventEnter').on('keypress.preventEnter', 'form', function (e) {
      if (e.keyCode === 13) e.preventDefault();
    });

    // Botón "+ Agregar proveedor" sin duplicaciones
    $(document).off('click.addProv', '#addProveedor').on('click.addProv', '#addProveedor', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();

      var $base = $('.proveedor').first(); // plantilla
      if ($base.length === 0) return;

      // Clon SIN eventos para no duplicar handlers
      var $nuevo = $base.clone(false);

      // Limpiar valores del clon
      $nuevo.find('input:not(.IVA)').val('');
      $nuevo.find('select').prop('selectedIndex', 0);
      $nuevo.find('.nombre_proveedor').text('');

      // Evitar IDs/for duplicados (si existieran)
      $nuevo.find('[id]').removeAttr('id');
      $nuevo.find('label[for]').removeAttr('for');

      // Reset labels (por clase si existen)
      $nuevo.find('.label-codigo').text('Código');
      $nuevo.find('.label-precio-lista').text('Precio de Lista');
      $nuevo.find('.label-descuento').text('Descuento');

      // El clon NUNCA debe contener el botón + dentro
      $nuevo.find('#addProveedor').remove();

      // Insertar SIEMPRE justo antes del botón +
      $nuevo.insertBefore('#addProveedor');

      // Inicializar valores/calculadora del bloque nuevo
      $nuevo.find('.proveedores').trigger('change');
      $nuevo.find('.precio_lista').trigger('change');

      actualizarProveedorAsignado();
      actualizarPrecioFinal();
    });

    /* =======================================
       DELEGACIÓN DE EVENTOS PARA BLOQUES DINÁMICOS
    ======================================== */
    $(document)
      .off('change.provSel', '.proveedores')
      .on('change.provSel', '.proveedores', function () {
        actualizarProveedor($(this));
        var $wrap = $(this).closest('.proveedor');
        $wrap.find('.precio_lista').trigger('change');
        actualizarProveedorAsignado();
      });

    $(document)
      .off('input change.precioLista', '.precio_lista')
      .on('input change.precioLista', '.precio_lista', function () {
        actualizarPrecio($(this));
      });

    $(document)
      .off('input change.costos', '.costo_neto, .IVA')
      .on('input change.costos', '.costo_neto, .IVA', function () {
        var $wrap = $(this).closest('.proveedor');
        actualizarCostoNeto($wrap.find('.costo_neto'));
        actualizarProveedorAsignado();
        actualizarPrecioFinal();
      });

    $('#utilidad').off('input change.util').on('input change.util', function () {
      actualizarPrecioFinal();
    });

    /* ================================
       FUNCIONES DE CÁLCULO POR BLOQUE
    ================================= */
    function actualizarProveedor($select) {
      var $wrap = $select.closest('.proveedor');
      var $opt = $select.find('option:selected');

      var nombreProveedor = ($opt.text() || '').trim();
      var descuento = parseFloat($opt.data('descuento'));
      if (isNaN(descuento)) descuento = 0;

      // Mostrar nombre del proveedor
      $wrap.find('.nombre_proveedor').text(nombreProveedor);

      // Setear hidden descuento (crear si no existe)
      var $hiddenDesc = $wrap.find('.descuentos_proveedor_id');
      if ($hiddenDesc.length === 0) {
        $hiddenDesc = $('<input>', { type: 'hidden', class: 'descuentos_proveedor_id', name: 'descuentos_proveedor_id[]', value: 0 });
        $wrap.append($hiddenDesc);
      }
      $hiddenDesc.val(descuento);

      // Actualizar labels
      var suf = nombreProveedor ? ' (' + nombreProveedor + ')' : '';
      var $lblCodigo = $wrap.find('.label-codigo');
      var $lblPL = $wrap.find('.label-precio-lista');
      var $lblDesc = $wrap.find('.label-descuento');
      if ($lblCodigo.length) $lblCodigo.text('Código' + suf); else $wrap.find('label[for="codigo"]').text('Código' + suf);
      if ($lblPL.length)     $lblPL.text('Precio de Lista' + suf); else $wrap.find('label[for="precio_lista"]').text('Precio de Lista' + suf);
      if ($lblDesc.length)   $lblDesc.text('Descuento' + suf); else $wrap.find('label[for="descuentos_proveedor_id"]').text('Descuento' + suf);
    }

    function asegurarHidden($wrap, cls, name, defVal) {
      var $el = $wrap.find('.' + cls);
      if ($el.length === 0) {
        $el = $('<input>', { type: 'hidden', class: cls, name: name, value: defVal });
        $wrap.append($el);
      }
      return $el;
    }

    function actualizarPrecio($precioLista) {
      var $wrap = $precioLista.closest('.proveedor');

      var pl = parseFloat($precioLista.val());
      if (isNaN(pl)) pl = 0;

      // descuento desde hidden o option
      var desc = parseFloat($wrap.find('.descuentos_proveedor_id').val());
      if (isNaN(desc)) {
        desc = parseFloat($wrap.find('.proveedores option:selected').data('descuento'));
        if (isNaN(desc)) desc = 0;
      }

      var $costoNeto = asegurarHidden($wrap, 'costo_neto', 'costo_neto[]', 0);
      var $iva      = asegurarHidden($wrap, 'IVA', 'IVA[]', 21);
      var $costoIVA = asegurarHidden($wrap, 'costo_iva', 'costo_iva[]', 0);

      var costoNeto = pl - (pl * desc / 100);
      $costoNeto.val(Math.ceil(costoNeto));

      var iva = parseFloat($iva.val());
      if (isNaN(iva)) iva = 0;

      var costoConIVA = costoNeto + (costoNeto * iva / 100);
      $costoIVA.val(Math.ceil(costoConIVA));

      actualizarProveedorAsignado();
      actualizarPrecioFinal();
    }

    function actualizarCostoNeto($costoNeto) {
      if (!$costoNeto || !$costoNeto.length) return;
      var $wrap = $costoNeto.closest('.proveedor');

      var cn = parseFloat($costoNeto.val());
      if (isNaN(cn)) cn = 0;

      var $iva = asegurarHidden($wrap, 'IVA', 'IVA[]', 21);
      var $costoIVA = asegurarHidden($wrap, 'costo_iva', 'costo_iva[]', 0);

      var iva = parseFloat($iva.val());
      if (isNaN(iva)) iva = 0;

      var cIVA = cn + (cn * iva / 100);
      $costoIVA.val(Math.ceil(cIVA));
    }

    /* =======================================
       SELECCIÓN DEL PROVEEDOR MÁS ECONÓMICO
    ======================================== */
    function getProveedorConCostoIvaMasBajo() {
      var $ganador = null;
      var min = Infinity;
      $('.proveedor').each(function () {
        var v = parseFloat($(this).find('.costo_iva').val());
        if (!isNaN(v) && v < min) {
          min = v;
          $ganador = $(this);
        }
      });
      return $ganador;
    }

    function actualizarProveedorAsignado() {
      var $p = getProveedorConCostoIvaMasBajo();
      var nombre = '';
      if ($p && $p.length) {
        nombre = ($p.find('.nombre_proveedor').text() || '').trim();
        $p.closest('.proveedor').find('.proveedor-designado-radio').prop('checked', true);
      }
      var cont = document.querySelector('#proveedorAsignado');
      if (cont) cont.textContent = nombre;
    }

    /* ================================
       PRECIO FINAL (UTILIDAD GLOBAL)
    ================================= */
    function actualizarPrecioFinal() {
      var $p = getProveedorConCostoIvaMasBajo();
      if (!$p || !$p.length) return;

      var costoConIVA = parseFloat($p.find('.costo_iva').val());
      if (isNaN(costoConIVA)) return;

      var utilidad = parseFloat($('#utilidad').val());
      if (isNaN(utilidad)) utilidad = 0;

      var precioFinal = costoConIVA + (costoConIVA * utilidad / 100);
      precioFinal = Math.ceil(precioFinal / 10) * 10; // múltiplos de 10 hacia arriba

      $('#precio_venta').val(precioFinal);
    }

    // Disparos iniciales si hay un primer bloque cargado
    $(function () {
      $('.proveedores').first().trigger('change');
      $('.precio_lista').first().trigger('change');
      actualizarProveedorAsignado();
      actualizarPrecioFinal();
    });
  } // if (window.jQuery)
}
