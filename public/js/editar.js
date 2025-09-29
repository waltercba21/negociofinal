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
  // Lee de <select class="IVA"> o <input class="IVA">
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

// ===============================
//  INIT
// ===============================
$(document).ready(function () {
  // Evitar submit con Enter
  $('form').off('keypress.preventEnter').on('keypress.preventEnter', function (e) {
    if (e.keyCode === 13) e.preventDefault();
  });

  // Flag global: si el usuario eligió manualmente un proveedor
  window.__seleccionManualProveedor__ = false;

  // 1) Respetar selección guardada
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

  // 2) Inicializar cálculos visibles
  $('.proveedores').each(function () { $(this).trigger('change'); });
  $('.precio_lista').each(function () { $(this).trigger('change'); });

  if (!window.__seleccionManualProveedor__) {
    actualizarProveedorAsignado();
  }
  actualizarPrecioFinal();

  // Botón Agregar Proveedor
  $('#addProveedor').off('click.addProv').on('click.addProv', function (e) {
    e.preventDefault();
    var $base = $('.proveedor').first();
    if ($base.length === 0) return;

    var $nuevo = $base.clone(false);

    // Limpiar valores del clon
    $nuevo.find('input:not(.IVA)').val('');
    $nuevo.find('select').each(function(){
      // reset selects, excepto .IVA (dejar default 21%)
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
  })
  .off('input change.precioLista', '.precio_lista')
  .on('input change.precioLista', '.precio_lista', function () {
    actualizarPrecio($(this));
  })
  // ✅ al cambiar IVA (select o input), recalcular todo
  .off('input change.iva', '.IVA')
  .on('input change.iva', '.IVA', function () {
    var $wrap = $(this).closest('.proveedor');
    // si hay costo_neto, recalcular costo_iva
    actualizarCostoNeto($wrap.find('.costo_neto'));
    if (!window.__seleccionManualProveedor__) {
      actualizarProveedorAsignado();
    }
    actualizarPrecioFinal();
  })
  // ✅ cambiar utilidad SIEMPRE recalcula precio de venta (ignora modo manual)
  .off('input change.utilidad', '#utilidad')
  .on('input change.utilidad', '#utilidad', function () {
    actualizarPrecioFinal();
  });

// ===============================
//  ELIMINAR PROVEEDOR
// ===============================
$(document)
  .off('click.eliminarProveedor', '.eliminar-proveedor')
  .on('click.eliminarProveedor', async function () {
    var $btn = $(this);
    var $bloque = $btn.closest('.proveedor');
    var proveedorId = $btn.data('proveedor-id'); // si viene de BD
    var eraSeleccionado = $bloque.find('.proveedor-designado-radio').is(':checked');
    var $form = $btn.closest('form');
    var productoId = $('[name="id"]').val() || $('#id').val() || $('#producto_id').val() || '';

    // Siempre quitamos del DOM para que la UI quede consistente
    $bloque.remove();

    // Si estaba seleccionado, reseteo selección manual
    if (eraSeleccionado) {
      window.__seleccionManualProveedor__ = false;
      $('#proveedor_designado').val('');
      $('.proveedor-designado-radio').prop('checked', false);
    }

    // 1) Fallback por formulario (por si el backend lo maneja en /actualizar)
    if (proveedorId) {
      $('<input>', {
        type: 'hidden',
        name: 'eliminar_proveedores[]',
        value: String(proveedorId)
      }).appendTo($form);
    }

    // 2) Intento DELETE (ruta típica)
    try {
      if (proveedorId && productoId) {
        const resp = await fetch(`/productos/eliminarProveedor/${encodeURIComponent(proveedorId)}?productoId=${encodeURIComponent(productoId)}`, { method: 'DELETE' });
        if (!resp.ok) {
          // 3) Fallback POST (otra variante común)
          await fetch('/productos/eliminarProveedor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productoId, proveedorId })
          }).catch(()=>{});
        }
      }
    } catch (_) {
      // sin bloquear la UI
    }

    actualizarProveedorAsignado();
    actualizarPrecioFinal();
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

    var nombre = $(this).closest('.proveedor').find('.nombre_proveedor').text().trim();
    if (!nombre) {
      nombre = $(this).closest('.proveedor').find('.proveedores option:selected').text().trim() || '';
      $(this).closest('.proveedor').find('.nombre_proveedor').text(nombre);
    }
    $('#proveedorAsignado').text(nombre);

    actualizarPrecioFinal();
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

  // Alinear value del radio con el proveedor seleccionado en el <select>
  $wrap.find('.proveedor-designado-radio').val($select.val() || '');

  // hidden descuento por compatibilidad
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
  if ($lblPL.length) $lblPL.text('Precio de Lista' + suf);
  if ($lblDesc.length) $lblDesc.text('Descuento' + suf);
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
    var nombreManual = $radioChecked.closest('.proveedor').find('.nombre_proveedor').text().trim();
    if (!nombreManual) {
      nombreManual = $radioChecked.closest('.proveedor').find('.proveedores option:selected').text().trim() || '';
      $radioChecked.closest('.proveedor').find('.nombre_proveedor').text(nombreManual);
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

  // redondeo al centenar (como en backend)
  precioFinal = redondearAlCentenar(precioFinal);

  $('#precio_venta').val(precioFinal);

  // refrescar asignado (no pisa selección manual)
  actualizarProveedorAsignado();
}
