// ===============================
//  PREVIEW DE IMÁGENES + SORTABLE
// ===============================
document.getElementById('imagen')?.addEventListener('change', function (e) {
  var preview = document.getElementById('preview');
  if (!preview) return;

  preview.innerHTML = '';
  Array.from(e.target.files).forEach(function (file, index) {
    var img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.height = 100;
    img.width = 100;
    img.classList.add('preview-img');
    img.dataset.id = index;
    img.addEventListener('click', function () {
      preview.removeChild(img);
    });
    preview.appendChild(img);
  });

  if (typeof Sortable !== 'undefined' && Sortable) {
    new Sortable(preview, {
      animation: 150,
      draggable: '.preview-img',
      onEnd: function () {
        Array.from(preview.children).forEach(function (img, index) {
          img.dataset.id = index;
        });
      }
    });
  } else {
    console.error('Sortable no está definido. Importar la librería.');
  }
});

// ===============================
//  MARCA → CARGA DE MODELOS
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
//  HELPERS
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
  if ($form.length === 0) $form = $('form'); // fallback
  var $ivaProd = $form.find('#iva_producto');
  if ($ivaProd.length === 0) {
    $ivaProd = $('<input>', { type: 'hidden', id: 'iva_producto', name: 'IVA_producto', value: 21 });
    $form.append($ivaProd);
  }
  return $ivaProd;
}
function getProductoId($context) {
  var $scope = $context && $context.length ? $context : $(document);
  return (
    $scope.find('#producto_id').val() ||
    $scope.find('#id').val() ||
    $scope.find('[name="id"]').val() || ''
  );
}

// Intenta encontrar el bloque del proveedor de forma muy robusta
function findProveedorBlock($start) {
  var $b = $start.closest('.proveedor');
  if ($b.length) return $b;

  // Ancestro con data-proveedor-id
  $b = $start.closest('[data-proveedor-id]');
  if ($b.length) return $b;

  // Ancestro que contenga un select .proveedores
  $b = $start.closest(':has(select.proveedores)');
  if ($b.length) return $b;

  // Último recurso: sube un poco y busca un div con clase aproximada
  $b = $start.parents().filter(function () {
    var $t = $(this);
    return $t.is('div') && ($t.hasClass('proveedor') || $t.find('select.proveedores').length);
  }).first();

  return $b;
}

// ===============================
//  INIT
// ===============================
$(document).ready(function () {
  // Evitar submit con Enter
  $('form').off('keypress.preventEnter').on('keypress.preventEnter', function (e) {
    if (e.keyCode === 13) e.preventDefault();
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

      var $bloque = findProveedorBlock($radioBD);
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

    // Reset labels
    $nuevo.find('.label-codigo').text('Código');
    $nuevo.find('.label-precio-lista').text('Precio de Lista');
    $nuevo.find('.label-descuento').text('Descuento');

    // Radio desmarcado y sin valor
    $nuevo.find('.proveedor-designado-radio').prop('checked', false).val('');

    // Botón eliminar
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
    var $wrap = findProveedorBlock($(this));
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
    var $wrap = findProveedorBlock($(this));
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
//  ELIMINAR PROVEEDOR (ROBUSTO + LOGS)
// ===============================
$(document)
  .off('click.eliminarProveedor', '.eliminar-proveedor')
  .on('click.eliminarProveedor', async function (e) {
    e.preventDefault();
    e.stopPropagation();

    var $btn    = $(this);
    var $bloque = findProveedorBlock($btn);
    var $form   = $btn.closest('form');

    // Logs de diagnóstico
    console.log('[ELIM] Botón clicado. Tiene data-proveedor-id?:', $btn.data('proveedor-id'));
    console.log('[ELIM] $bloque encontrado?', $bloque.length, $bloque.get(0) ? $bloque.get(0).outerHTML.slice(0, 160) + '...' : '(no hallado)');

    // Resolver proveedorId (3 fuentes)
    var proveedorId = $btn.data('proveedor-id');
    if (!proveedorId) proveedorId = $bloque.data('proveedor-id');
    if (!proveedorId) {
      var $sel = $bloque.find('.proveedores');
      proveedorId = $sel.length ? $sel.val() : '';
    }
    proveedorId = proveedorId ? String(proveedorId).trim() : '';

    // Resolver productoId
    var productoId = getProductoId($form);

    console.log('[ELIM] Click eliminar → proveedorId=', proveedorId, '| productoId=', productoId);

    // Si no hay contenedor, aborto (evito remover cualquier cosa incorrecta)
    if (!$bloque.length) {
      console.warn('[ELIM] No se halló bloque contenedor para este botón. Revisá que el botón esté dentro del <div class="proveedor"> correspondiente.');
      return;
    }

    // Caso: bloque "nuevo" (sin proveedorId real) → remover únicamente del DOM
    if (!proveedorId) {
      console.log('[ELIM] Bloque nuevo sin proveedorId en DB, removiendo del DOM.');
      var eraSelNuevo = $bloque.find('.proveedor-designado-radio').is(':checked');
      $bloque.remove();
      if (eraSelNuevo) {
        window.__seleccionManualProveedor__ = false;
        $('#proveedor_designado').val('');
        $('.proveedor-designado-radio').prop('checked', false);
      }
      actualizarProveedorAsignado();
      actualizarPrecioFinal();
      syncIVAProductoConAsignado();
      return;
    }

    // Eliminación vía API (DELETE → fallback POST) o marcado hidden
    let eliminado = false;
    try {
      if (productoId) {
        const url = `/productos/eliminarProveedor/${encodeURIComponent(proveedorId)}?productoId=${encodeURIComponent(productoId)}`;
        console.log('[ELIM] Intentando DELETE →', url);

        const resp = await fetch(url, {
          method: 'DELETE',
          credentials: 'same-origin'
        });

        console.log('[ELIM] Respuesta DELETE → status:', resp.status, 'ok:', resp.ok);
        if (!resp.ok) {
          const txt = await safeText(resp);
          console.warn('[ELIM] DELETE no ok. body:', txt);

          console.log('[ELIM] Intentando POST fallback → /productos/eliminarProveedor');
          const resp2 = await fetch('/productos/eliminarProveedor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ productoId, proveedorId })
          });
          console.log('[ELIM] Respuesta POST → status:', resp2.status, 'ok:', resp2.ok);
          if (!resp2.ok) {
            const txt2 = await safeText(resp2);
            console.error('[ELIM] POST fallback falló. body:', txt2);
            throw new Error('POST fallback no aceptado');
          }
        }
        eliminado = true;
      } else {
        console.warn('[ELIM] No se detectó productoId en el form. Marco para eliminar al guardar.');
      }
    } catch (err) {
      console.error('[ELIM] Error en eliminación vía API:', err && err.message ? err.message : err);
    }

    if (!eliminado) {
      // Marcamos para eliminar al guardar
      console.log('[ELIM] Marcando hidden eliminar_proveedores[] y removiendo del DOM.');
      $('<input>', {
        type: 'hidden',
        name: 'eliminar_proveedores[]',
        value: String(proveedorId)
      }).appendTo($form);
    }

    // Ahora sí, quitar del DOM y recalcular UI
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

async function safeText(resp) {
  try { return await resp.text(); } catch { return '(sin body)'; }
}

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

    var $wrap = findProveedorBlock($(this));
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
//  CÁLCULOS
// ===============================
function actualizarProveedor($select) {
  var $wrap = findProveedorBlock($select);
  var $opt = $select.find('option:selected');

  var nombreProveedor = $opt.text() || '';
  var descuento = toNumber($opt.data('descuento'));
  $wrap.find('.nombre_proveedor').text(nombreProveedor);

  // Radio: value = proveedor seleccionado
  $wrap.find('.proveedor-designado-radio').val($select.val() || '');

  // hidden descuento
  var $hiddenDesc = $wrap.find('.descuentos_proveedor_id');
  if ($hiddenDesc.length === 0) {
    $hiddenDesc = $('<input>', { type: 'hidden', class: 'descuentos_proveedor_id', name: 'descuentos_proveedor_id[]', value: 0 });
    $wrap.append($hiddenDesc);
  }
  $hiddenDesc.val(descuento);

  // labels
  var suf = nombreProveedor ? ' (' + nombreProveedor + ')' : '';
  var $lblCodigo = $wrap.find('.label-codigo');
  var $lblPL = $wrap.find('.label-precio-lista');
  var $lblDesc = $wrap.find('.label-descuento');
  if ($lblCodigo.length) $lblCodigo.text('Código' + suf);
  if ($lblPL.length)    $lblPL.text('Precio de Lista' + suf);
  if ($lblDesc.length)  $lblDesc.text('Descuento' + suf);
}

function actualizarPrecio($precioLista) {
  var $wrap = findProveedorBlock($precioLista);

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

  var $wrap = findProveedorBlock($costoNeto);
  var cn = toNumber($costoNeto.val());
  var $costoIVA = asegurarHidden($wrap, 'costo_iva', 'costo_iva[]', 0);

  var iva = getIVA($wrap);
  var cIVA = cn + (cn * iva / 100);
  $costoIVA.val(Math.ceil(cIVA));
}

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
    var $p = findProveedorBlock($radioChecked);
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

function actualizarPrecioFinal() {
  var $proveedor;

  var $radioChecked = $('.proveedor-designado-radio:checked');
  if (window.__seleccionManualProveedor__ && $radioChecked.length) {
    $proveedor = findProveedorBlock($radioChecked);
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

function syncIVAProductoConAsignado() {
  var $ivaProd = asegurarHiddenIVAProducto();

  var $proveedor;
  var $radioChecked = $('.proveedor-designado-radio:checked');
  if (window.__seleccionManualProveedor__ && $radioChecked.length) {
    $proveedor = findProveedorBlock($radioChecked);
  } else {
    $proveedor = getProveedorConCostoIvaMasBajo();
  }
  if (!$proveedor || !$proveedor.length) {
    $ivaProd.val(21);
    console.log('syncIVA → sin proveedor, IVA_producto=21');
    return;
  }

  var ivaSel = getIVA($proveedor) || 21;
  $ivaProd.val(ivaSel);
  console.log('syncIVA → IVA_producto=', ivaSel);
}
