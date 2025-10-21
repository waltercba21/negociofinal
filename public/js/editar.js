/* ===========================================================
   GUARD: evitar doble carga del script en la VISTA EDITAR
=========================================================== */
if (!window.__EDITAR_INIT__) {
  window.__EDITAR_INIT__ = true;

  /* ===========================================================
     PREVIEW DE IMÁGENES (EDITAR) + EXISTENTES + NUEVAS
     - Clic: marcar portada (existente o nueva)
     - Doble-clic: eliminar (existente → hidden eliminar_imagenes[], nueva → del FileList)
     - Drag & drop: reordenar (existentes → orden_imagenes_existentes[], nuevas → DataTransfer)
     - Revoca ObjectURL al cargar thumb
  ============================================================ */
  (function initImagenesEditar() {
    var inputImagen = document.getElementById('imagen');
    var $preview    = document.getElementById('preview');
    var portadaTipo = document.getElementById('portada_tipo'); // 'existente' | 'nueva'
    var portadaExistenteId = document.getElementById('portada_existente_id');
    var portadaNuevaIndex  = document.getElementById('portada_nueva_index');
    var ordenExistentesContainer = document.getElementById('orden_existentes_container');
    var eliminarContainer = document.getElementById('eliminar_imagenes_container');

    if (!inputImagen || !$preview || !portadaTipo || !portadaExistenteId || !portadaNuevaIndex) return;

    // DataTransfer para nuevas
    var dt = new DataTransfer();

    // Al cargar la página, si había imágenes existentes, marcamos portada actual (si vino)
    marcarPortadaDesdeHidden();

    // Helpers
    function markCoverNode(node) {
      Array.from($preview.children).forEach(function (n) {
        if (n === node) n.classList.add('is-cover');
        else n.classList.remove('is-cover');
      });
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
    function syncInputFromDT() {
      inputImagen.files = dt.files;
    }

    // Reconstruir hidden de orden existentes según DOM
    function rebuildOrdenExistentesHidden() {
      clearOrdenExistentesHidden();
      Array.from($preview.children).forEach(function (node) {
        if (node.dataset.type === 'existente') {
          pushOrdenExistente(node.dataset.id);
        }
      });
    }

    // Reordenar DataTransfer de nuevas según DOM
    function reorderNewFilesFromDOM() {
      var orderNew = [];
      Array.from($preview.children).forEach(function (node) {
        if (node.dataset.type === 'nueva') {
          orderNew.push(parseInt(node.dataset.idx, 10));
        }
      });
      // orderNew tiene índices viejos → armamos un nuevo DT
      var newDT = new DataTransfer();
      orderNew.forEach(function (oldIdx) {
        if (dt.files[oldIdx]) newDT.items.add(dt.files[oldIdx]);
      });
      dt = newDT;

      // Reasignar idx visibles
      var k = 0;
      Array.from($preview.children).forEach(function (node) {
        if (node.dataset.type === 'nueva') {
          node.dataset.idx = String(k++);
        }
      });
      syncInputFromDT();
    }

    // Seleccionar portada (existente o nueva)
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
        // movemos esa nueva al frente del DT para que sea el primer archivo
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

          // Reasignar índices visibles de .nueva
          var n = 0;
          Array.from($preview.children).forEach(function (nd) {
            if (nd.dataset.type === 'nueva') nd.dataset.idx = String(n++);
          });
        }
        portadaNuevaIndex.value = '0'; // siempre 0 tras mover al frente
        portadaExistenteId.value = '';
      }
    }

    // Agregar thumbs de NUEVAS (dt → DOM)
    function rebuildNewThumbsAppend() {
      // Borro thumbs "nuevas" y los vuelvo a crear al final, manteniendo "existentes"
      Array.from($preview.querySelectorAll('.thumb[data-type="nueva"]')).forEach(function (n) { n.remove(); });

      Array.from(dt.files).forEach(function (file, idx) {
        var wrap = document.createElement('div');
        wrap.className = 'thumb';
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

    // Construye/actualiza Sortable
    function ensureSortable() {
      if (typeof Sortable === 'undefined' || !Sortable) {
        console.error('Sortable no está definido. Importar la librería.');
        return;
      }
      if ($preview.__sortable) {
        $preview.__sortable.destroy();
        $preview.__sortable = null;
      }
      $preview.__sortable = new Sortable($preview, {
        animation: 150,
        draggable: '.thumb',
        onEnd: function () {
          // Tras ordenar: 1) actualizo orden existentes, 2) reordeno nuevas en DT
          rebuildOrdenExistentesHidden();
          reorderNewFilesFromDOM();
          // Si la portada estaba en un nodo, que siga marcada visual
          var portadaNode = findPortadaNode();
          if (portadaNode) markCoverNode(portadaNode);
        }
      });
    }

    // Buscar el nodo actual de portada según hidden
    function findPortadaNode() {
      if (portadaTipo.value === 'existente' && portadaExistenteId.value) {
        return $preview.querySelector('.thumb[data-type="existente"][data-id="' + portadaExistenteId.value + '"]');
      }
      if (portadaTipo.value === 'nueva') {
        var idx = parseInt(portadaNuevaIndex.value, 10);
        if (!isNaN(idx) && idx >= 0) {
          // portada nueva siempre será la .nueva con dataset.idx == 0 si movimos al frente
          return $preview.querySelector('.thumb[data-type="nueva"][data-idx="0"]');
        }
      }
      return null;
    }

    function marcarPortadaDesdeHidden() {
      var node = findPortadaNode();
      if (!node) {
        // fallback: si hay existente, dejo la primera como portada visual sin tocar hidden
        var first = $preview.querySelector('.thumb');
        if (first) markCoverNode(first);
      } else {
        markCoverNode(node);
      }
    }

    // CLICK vs DBLCLICK (igual que en CREAR)
    var clickTimer = null;
    var SINGLE_CLICK_DELAY = 220;

    $preview.addEventListener('click', function (e) {
      var thumb = e.target.closest('.thumb');
      if (!thumb) return;

      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(function () {
        setCover(thumb);
        clickTimer = null;
      }, SINGLE_CLICK_DELAY);
    });

    $preview.addEventListener('dblclick', function (e) {
      var thumb = e.target.closest('.thumb');
      if (!thumb) return;

      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }

      // Doble-clic: eliminar
      var type = thumb.dataset.type;
      if (type === 'existente') {
        var id = thumb.dataset.id;
        if (id) pushEliminarExistente(id);
        thumb.remove();
        rebuildOrdenExistentesHidden();

        // Si borramos la portada actual, reasigno portada al primer nodo
        var portadaNode = findPortadaNode();
        if (!portadaNode || !document.body.contains(portadaNode)) {
          var first = $preview.querySelector('.thumb');
          if (first) setCover(first);
        }
        ensureSortable();
      } else {
        // NUEVA: quitar del DT y del DOM
        var idx = parseInt(thumb.dataset.idx, 10);
        if (!isNaN(idx)) {
          var newDT = new DataTransfer();
          Array.from(dt.files).forEach(function (f, i) {
            if (i !== idx) newDT.items.add(f);
          });
          dt = newDT;
          syncInputFromDT();
          thumb.remove();

          // Reasignar índices a las nuevas visibles
          var k = 0;
          Array.from($preview.children).forEach(function (nd) {
            if (nd.dataset.type === 'nueva') nd.dataset.idx = String(k++);
          });

          // Si era portada y quedó sin nueva #0, ajusto hidden
          var portNode = findPortadaNode();
          if (!portNode || !document.body.contains(portNode)) {
            var first = $preview.querySelector('.thumb');
            if (first) setCover(first);
          }

          ensureSortable();
        }
      }
    });

    // Input change: agregar nuevas (se ADJUNTAN)
    inputImagen.addEventListener('change', function (e) {
      var seleccion = Array.from(e.target.files || []);
      if (seleccion.length === 0 && dt.files.length === 0) return;

      // Adjuntar
      seleccion.forEach(function (f) { dt.items.add(f); });
      syncInputFromDT();

      rebuildNewThumbsAppend();
      ensureSortable();

      // Si no había portada definida, marco la primera visible
      var portadaNode = findPortadaNode();
      if (!portadaNode) {
        var first = $preview.querySelector('.thumb');
        if (first) setCover(first);
      } else {
        markCoverNode(portadaNode);
      }

      // Actualizar orden existentes (por si no había)
      rebuildOrdenExistentesHidden();
    });

    // Inicialización al cargar: construir orden existentes y sortable
    rebuildOrdenExistentesHidden();
    ensureSortable();
  })();

  /* ===========================================================
     RESTO DE LA LÓGICA (proveedores, IVA, utilidades)
     — Basado en tu archivo original.
  ============================================================ */

  // ===============================
  //  MARCA → CARGA DE MODELOS (AJAX)
  // ===============================
  $('#marca').off('change.cargarModelos').on('change.cargarModelos', function () {
    var marcaId = $(this).val();
    var $modelo = $('#modelo_id');
    $modelo.empty();
    $modelo.append('<option value="">Selecciona un modelo...</option>');
    if (!marcaId) return;
    $.get('/productos/modelos/' + marcaId, function (modelosPorMarca) {
      (modelosPorMarca || []).forEach(function (modelo) {
        $modelo.append('<option value="' + modelo.id + '">' + modelo.nombre + '</option>');
      });
    });
  });

  // ===============================
  //  HELPERS NÚMERICOS
  // ===============================
  function toNumber(val) {
    if (val == null) return 0;
    var s = (typeof val === 'string') ? val.replace(',', '.') : String(val);
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function redondearAlCentenar(valor) {
    var n = toNumber(valor);
    var resto = n % 100;
    return (resto < 50) ? (n - resto) : (n + (100 - resto));
  }
  function getIVA($wrap) {
    var raw = $wrap.find('.IVA').val();
    return toNumber(raw);
  }
  function asegurarHidden($wrap, cls, name, defVal) {
    var $el = $wrap.find('.' + cls);
    if ($el.length === 0) {
      $el = $('<input>', { type: 'hidden', class: cls, name: name, value: defVal });
      $wrap.append($el);
    }
    return $el;
  }
  function asegurarHiddenIVAProducto() {
    var $form = $('form.contenido-editar');
    if ($form.length === 0) $form = $('form');
    var $ivaProd = $form.find('#iva_producto');
    if ($ivaProd.length === 0) {
      $ivaProd = $('<input>', { type: 'hidden', id: 'iva_producto', name: 'IVA_producto', value: 21 });
      $form.append($ivaProd);
    }
    return $ivaProd;
  }

  // ===============================
  //  INIT
  // ===============================
  $(document).ready(function () {
    // Evitar submit con Enter SOLO dentro de inputs/textareas (no afecta botones)
    $('form').off('keydown.preventEnter').on('keydown.preventEnter', function (e) {
      if ((e.key === 'Enter' || e.keyCode === 13) &&
          (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        e.preventDefault();
      }
    });

    window.__seleccionManualProveedor__ = false;

    // Respetar selección guardada
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

    // Inicializar cálculos visibles
    $('.proveedores').each(function () { $(this).trigger('change'); });
    $('.precio_lista').each(function () { $(this).trigger('change'); });

    if (!window.__seleccionManualProveedor__) {
      actualizarProveedorAsignado();
    }
    actualizarPrecioFinal();
    syncIVAProductoConAsignado();

    // Botón Agregar Proveedor
    $('#addProveedor').off('click.addProv').on('click.addProv', function (e) {
      e.preventDefault();
      var $base = $('.proveedor').first();
      if ($base.length === 0) return;

      var $nuevo = $base.clone(false);

      // Limpiar valores del clon
      $nuevo.find('input:not(.IVA)').val('');
      $nuevo.find('select').each(function(){
        if (!$(this).hasClass('IVA')) $(this).prop('selectedIndex', 0);
      });
      $nuevo.find('.nombre_proveedor').text('');

      // Quitar ids/for duplicados
      $nuevo.find('[id]').removeAttr('id');
      $nuevo.find('label[for]').removeAttr('for');

      // Labels base
      $nuevo.find('.label-codigo').text('Código');
      $nuevo.find('.label-precio-lista').text('Precio de Lista');
      $nuevo.find('.label-descuento').text('Descuento');

      // Radio desmarcado
      $nuevo.find('.proveedor-designado-radio').prop('checked', false).val('');

      // Botón eliminar (nuevos sin data-proveedor-id)
      if ($nuevo.find('.eliminar-proveedor').length === 0) {
        $nuevo.append(
          '<div class="form-group-crear">' +
            '<button class="eliminar-proveedor btn btn-outline-danger" type="button">Eliminar proveedor</button>' +
          '</div>'
        );
      } else {
        $nuevo.find('.eliminar-proveedor').removeAttr('data-proveedor-id');
      }

      $nuevo.insertBefore('#addProveedor');

      // Inicializa cálculos del bloque nuevo
      $nuevo.find('.proveedores').trigger('change');
      $nuevo.find('.precio_lista').trigger('change');

      if (!window.__seleccionManualProveedor__) {
        actualizarProveedorAsignado();
      }
      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
    });
  });

  // =======================================
  //  DELEGACIÓN DE EVENTOS DINÁMICOS
  // =======================================
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
      actualizarCostoNeto($wrap.find('.costo_neto'));
      if (!window.__seleccionManualProveedor__) {
        actualizarProveedorAsignado();
      }
      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
    })
    .off('input change.utilidad', '#utilidad')
    .on('input change.utilidad', '#utilidad', function () {
      actualizarPrecioFinal();
    });

  // ===============================
  //  ELIMINAR PROVEEDOR (DOM-first, sin “this”)
  // ===============================
  $(document)
    .off('click.eliminarProveedor', '.eliminar-proveedor')
    .on('click.eliminarProveedor', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.eliminar-proveedor') : null;
      if (!btn) return;
      var $btn = $(btn);
      var provNode = btn.closest('.proveedor');
      var $bloque  = provNode ? $(provNode) : $();

      if (!$bloque.length) return;

      var $form = $btn.closest('form');

      // proveedorId: botón → bloque → select
      var proveedorId =
        ($btn.attr('data-proveedor-id') || '').trim() ||
        ($bloque.attr('data-proveedor-id') || '').trim() ||
        String($bloque.find('.proveedores').val() || '').trim();

      var productoId = ($('[name="id"]').val() || $('#id').val() || $('#producto_id').val() || '').trim();

      // Si es proveedor existente, marcar hidden para que el backend lo borre al Guardar
      if (proveedorId) {
        $('<input>', {
          type: 'hidden',
          name: 'eliminar_proveedores[]',
          value: proveedorId
        }).appendTo($form);
      }

      var eraSeleccionado = $bloque.find('.proveedor-designado-radio').is(':checked');

      $bloque.remove();

      if (eraSeleccionado) {
        window.__seleccionManualProveedor__ = false;
        $('#proveedor_designado').val('');
        $('.proveedor-designado-radio').prop('checked', false);
      }

      actualizarProveedorAsignado();
      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
    });

  // ===============================
  //  ELECCIÓN MANUAL DEL PROVEEDOR
  // ===============================
  $(document)
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
    });

  // ===============================
  //  LÓGICA DE CÁLCULOS POR BLOQUE
  // ===============================
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
    var $lblCodigo = $wrap.find('.label-codigo');
    var $lblPL = $wrap.find('.label-precio-lista');
    var $lblDesc = $wrap.find('.label-descuento');
    if ($lblCodigo.length) $lblCodigo.text('Código' + suf);
    if ($lblPL.length)     $lblPL.text('Precio de Lista' + suf);
    if ($lblDesc.length)   $lblDesc.text('Descuento' + suf);
  }

  function actualizarPrecio($precioLista) {
    var $wrap = $precioLista.closest('.proveedor');

    var pl = toNumber($precioLista.val());
    var desc = toNumber($wrap.find('.descuentos_proveedor_id').val());

    var $costoNeto = asegurarHidden($wrap, 'costo_neto', 'costo_neto[]', 0);
    var $costoIVA  = asegurarHidden($wrap, 'costo_iva',  'costo_iva[]',  0);

    var costoNeto = pl - (pl * desc / 100);
    $costoNeto.val(Math.ceil(costoNeto));

    var iva = getIVA($wrap);
    var costoConIVA = costoNeto + (costoNeto * iva / 100);
    $costoIVA.val(Math.ceil(costoConIVA));

    if (!window.__seleccionManualProveedor__) {
      actualizarProveedorAsignado();
    }
    actualizarPrecioFinal();
  }

  function actualizarCostoNeto($costoNeto) {
    if (!$costoNeto || !$costoNeto.length) return;

    var $wrap = $costoNeto.closest('.proveedor');
    var cn = toNumber($costoNeto.val());
    var $costoIVA = asegurarHidden($wrap, 'costo_iva', 'costo_iva[]', 0);

    var iva = getIVA($wrap);
    var cIVA = cn + (cn * iva / 100);
    $costoIVA.val(Math.ceil(cIVA));
  }

  // =======================================
  //  SELECCIÓN DEL PROVEEDOR ASIGNADO
  // =======================================
  function getProveedorConCostoIvaMasBajo() {
    var $ganador = null;
    var costoIvaMasBajo = Infinity;

    $('.proveedor').each(function () {
      var $wrap = $(this);
      var val = $wrap.find('.costo_iva').val();
      var costoIva = toNumber(val);
      if (!isNaN(costoIva) && costoIva < costoIvaMasBajo) {
        costoIvaMasBajo = costoIva;
        $ganador = $wrap;
      }
    });

    return $ganador;
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

  // ===============================
  //  PRECIO FINAL (UTILIDAD GLOBAL)
  // ===============================
  function actualizarPrecioFinal() {
    var $proveedor;

    var $radioChecked = $('.proveedor-designado-radio:checked');
    if (window.__seleccionManualProveedor__ && $radioChecked.length) {
      $proveedor = $radioChecked.closest('.proveedor');
    } else {
      $proveedor = getProveedorConCostoIvaMasBajo();
    }

    if (!$proveedor || !$proveedor.length) return;

    var costoConIVA = toNumber($proveedor.find('.costo_iva').val());
    if (isNaN(costoConIVA) || costoConIVA <= 0) return;

    var utilidad = toNumber($('#utilidad').val());
    var precioFinal = costoConIVA + (costoConIVA * utilidad / 100);

    precioFinal = redondearAlCentenar(precioFinal);

    $('#precio_venta').val(precioFinal);

    actualizarProveedorAsignado();
    syncIVAProductoConAsignado();
  }

  // ===============================
  //  SYNC IVA PRODUCTO (hidden name="IVA_producto")
  // ===============================
  function syncIVAProductoConAsignado() {
    var $ivaProd = asegurarHiddenIVAProducto();

    var $proveedor;
    var $radioChecked = $('.proveedor-designado-radio:checked');
    if (window.__seleccionManualProveedor__ && $radioChecked.length) {
      $proveedor = $radioChecked.closest('.proveedor');
    } else {
      $proveedor = getProveedorConCostoIvaMasBajo();
    }
    if (!$proveedor || !$proveedor.length) {
      $ivaProd.val(21);
      return;
    }

    var ivaSel = getIVA($proveedor) || 21;
    $ivaProd.val(ivaSel);
  }

  // ===============================
  //  LOGGER GLOBAL
  // ===============================
  window.addEventListener('error', function (e) {
    console.error('[JS ERROR]', e.message, e.filename + ':' + e.lineno + ':' + e.colno);
  });
}
