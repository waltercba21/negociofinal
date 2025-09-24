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
//  INIT
// ===============================
$(document).ready(function () {
  // Evitar submit con Enter
  $('form').off('keypress.preventEnter').on('keypress.preventEnter', function (e) {
    if (e.keyCode === 13) e.preventDefault();
  });

  // Flag global: si el usuario eligió manualmente un proveedor
  window.__seleccionManualProveedor__ = false;

  // Botón Agregar Proveedor (prevenir handlers duplicados)
  $('#addProveedor').off('click.addProv').on('click.addProv', function (e) {
    e.preventDefault();

    var $base = $('.proveedor').first(); // plantilla
    if ($base.length === 0) return;

    // Clon sin eventos (evita duplicaciones y “crecimientos” extra)
    var $nuevo = $base.clone(false);

    // Limpiar valores del clon
    $nuevo.find('input:not(.IVA)').val('');
    $nuevo.find('select').prop('selectedIndex', 0);
    $nuevo.find('.nombre_proveedor').text('');

    // Eliminar ids/for duplicados si existieran
    $nuevo.find('[id]').removeAttr('id');
    $nuevo.find('label[for]').removeAttr('for');

    // Reset labels de bloque
    $nuevo.find('.label-codigo').text('Código');
    $nuevo.find('.label-precio-lista').text('Precio de Lista');
    $nuevo.find('.label-descuento').text('Descuento');

    // Si el bloque tiene radio, desmarcarlo en el clon y vaciar su value
    $nuevo.find('.proveedor-designado-radio').prop('checked', false).val('');

    // Insertar antes del botón + (el botón no se clona)
    $nuevo.insertBefore('#addProveedor');

    // Inicializar cálculos del bloque
    $nuevo.find('.proveedores').trigger('change');
    $nuevo.find('.precio_lista').trigger('change');

    // Si agregamos un proveedor nuevo, no forzamos selección manual
    actualizarProveedorAsignado();
    actualizarPrecioFinal();
  });

$('.proveedores').each(function () { $(this).trigger('change'); });
$('.precio_lista').each(function () { $(this).trigger('change'); });
actualizarProveedorAsignado();
actualizarPrecioFinal();
});

// =======================================
//  DELEGACIÓN DE EVENTOS PARA BLOQUES DIN.
// =======================================
$(document)
  .off('change.provSel', '.proveedores')
  .on('change.provSel', '.proveedores', function () {
    actualizarProveedor($(this));
    // Recalcular del bloque
    var $wrap = $(this).closest('.proveedor');
    $wrap.find('.precio_lista').trigger('change');
    actualizarProveedorAsignado();
  })
  .off('input change.precioLista', '.precio_lista')
  .on('input change.precioLista', '.precio_lista', function () {
    actualizarPrecio($(this));
  })
  .off('input change.costos', '.costo_neto, .IVA')
  .on('input change.costos', '.costo_neto, .IVA', function () {
    actualizarCostoNeto($(this).closest('.proveedor').find('.costo_neto'));
    actualizarProveedorAsignado();
    actualizarPrecioFinal();
  });

// Al cambiar utilidad recalculamos
$('#utilidad').off('input change.util').on('input change.util', function () {
  actualizarPrecioFinal();
});

// ===============================
//  ELECCIÓN MANUAL DEL PROVEEDOR
// ===============================
$(document)
  .off('change.provRadio', '.proveedor-designado-radio')
  .on('change.provRadio', '.proveedor-designado-radio', function () {
    // Marca selección manual y sincroniza el hidden con el proveedor_id
    window.__seleccionManualProveedor__ = true;
    var proveedorId = $(this).val(); // ESTE es el proveedor_id
    $('#proveedor_designado').val(proveedorId);

    // Refrescar el nombre mostrado
    var nombre = $(this).closest('.proveedor').find('.nombre_proveedor').text() || '';
    $('#proveedorAsignado').text(nombre);
  });

// ===============================
//  LÓGICA DE CÁLCULOS POR BLOQUE
// ===============================
function actualizarProveedor($select) {
  var $wrap = $select.closest('.proveedor');
  var $opt = $select.find('option:selected');

  var nombreProveedor = $opt.text() || '';
  var descuento = parseFloat($opt.data('descuento'));
  if (isNaN(descuento)) descuento = 0;

  $wrap.find('.nombre_proveedor').text(nombreProveedor);

  // *** IMPORTANTE: que el radio de este bloque tenga como value el proveedor_id seleccionado
  $wrap.find('.proveedor-designado-radio').val($select.val());

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
  if ($lblPL.length) $lblPL.text('Precio de Lista' + suf);
  if ($lblDesc.length) $lblDesc.text('Descuento' + suf);
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

// =======================================
//  SELECCIÓN DEL PROVEEDOR ASIGNADO
// =======================================
function getProveedorConCostoIvaMasBajo() {
  var $ganador = null;
  var costoIvaMasBajo = Infinity;

  $('.proveedor').each(function () {
    var $wrap = $(this);
    var val = $wrap.find('.costo_iva').val();
    var costoIva = parseFloat(val);
    if (!isNaN(costoIva) && costoIva < costoIvaMasBajo) {
      costoIvaMasBajo = costoIva;
      $ganador = $wrap;
    }
  });

  return $ganador;
}

function actualizarProveedorAsignado() {
  // Si el usuario eligió manualmente, NO sobreescribimos su elección
  var $radioChecked = $('.proveedor-designado-radio:checked');
  if (window.__seleccionManualProveedor__ && $radioChecked.length) {
    var nombreManual = $radioChecked.closest('.proveedor').find('.nombre_proveedor').text() || '';
    $('#proveedorAsignado').text(nombreManual);
    // Asegurar hidden con el proveedor_id actual
    $('#proveedor_designado').val($radioChecked.val());
    return;
  }

  // Auto: elegir el más barato
  var $proveedor = getProveedorConCostoIvaMasBajo();
  var nombre = '';

  // Desmarcar todos para volver a marcar solo el auto si no hay manual
  $('.proveedor-designado-radio').prop('checked', false);

  if ($proveedor && $proveedor.length) {
    nombre = $proveedor.find('.nombre_proveedor').text() || '';
    var $radio = $proveedor.find('.proveedor-designado-radio');
    if ($radio.length) {
      $radio.prop('checked', true);
      $('#proveedor_designado').val($radio.val()); // proveedor_id
    } else {
      // Si no hay radio, al menos setear hidden con el proveedor seleccionado en el <select>
      var provIdSel = $proveedor.find('.proveedores').val();
      if (provIdSel) $('#proveedor_designado').val(provIdSel);
    }
  } else {
    $('#proveedor_designado').val('');
  }

  var cont = document.querySelector('#proveedorAsignado');
  if (cont) cont.textContent = nombre;
}

// ===============================
//  PRECIO FINAL (UTILIDAD GLOBAL)
// ===============================
function actualizarPrecioFinal() {
  var $proveedor;

  // Si hay selección manual, usar ese bloque para el cálculo de precio final
  var $radioChecked = $('.proveedor-designado-radio:checked');
  if (window.__seleccionManualProveedor__ && $radioChecked.length) {
    $proveedor = $radioChecked.closest('.proveedor');
  } else {
    $proveedor = getProveedorConCostoIvaMasBajo();
  }

  if (!$proveedor || !$proveedor.length) return;

  var costoConIVA = parseFloat($proveedor.find('.costo_iva').val());
  if (isNaN(costoConIVA)) return;

  var utilidad = parseFloat($('#utilidad').val());
  if (isNaN(utilidad)) utilidad = 0;

  var precioFinal = costoConIVA + (costoConIVA * utilidad / 100);
  precioFinal = Math.ceil(precioFinal / 10) * 10; // múltiplos de 10 arriba

  $('#precio_venta').val(precioFinal);

  // refrescar asignado por si cambió
  actualizarProveedorAsignado();
}

// Recalcular precio final al cambiar costo/IVA o utilidad
$('.costo_iva, #utilidad').off('change.recalc').on('change.recalc', actualizarPrecioFinal);
