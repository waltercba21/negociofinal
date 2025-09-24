// ===============================
//  PREVIEW DE IMÁGENES + SORTABLE
// ===============================
document.getElementById('imagen')?.addEventListener('change', function (e) {
  var preview = document.getElementById('preview');
  if (preview) {
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
      console.error('Sortable no está definido. Por favor, asegúrate de importar la librería.');
    }
  } else {
    console.error('El elemento con id "preview" no existe.');
  }
});

// ===============================
//  MARCA → CARGA DE MODELOS
// ===============================
$('#marca').on('change', function () {
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
//  DOC READY: HANDLERS GENERALES
// ===============================
$(document).ready(function () {
  // Evitar submit con Enter
  $('form').on('keypress', function (e) {
    if (e.keyCode === 13) e.preventDefault();
  });

  // Agregar proveedor (clon seguro)
  $('#addProveedor').on('click', function (e) {
    e.preventDefault();

    var $base = $('.proveedor').first();
    if ($base.length === 0) return;

    var $nuevo = $base.clone(true);

    // Limpiar valores del clon
    $nuevo.find('input:not(.IVA)').val('');
    $nuevo.find('select').prop('selectedIndex', 0);
    $nuevo.find('.nombre_proveedor').text('');

    // Evitar duplicar IDs/for (muy importante si hay label[for="..."])
    $nuevo.find('[id]').removeAttr('id');
    $nuevo.find('label[for]').removeAttr('for');

    // Si usás labels con clases, dejamos los textos "base"
    $nuevo.find('.label-codigo').text('Código');
    $nuevo.find('.label-precio-lista').text('Precio de Lista');
    $nuevo.find('.label-descuento').text('Descuento');

    // Insertar y disparar eventos para inicializar el bloque
    $nuevo.insertBefore('#addProveedor');
    $nuevo.find('.proveedores').trigger('change');
    $nuevo.find('.precio_lista').trigger('change');
  });
});

// =======================================
//  DELEGACIÓN DE EVENTOS PARA BLOQUES DIN.
// =======================================
$(document)
  .on('change', '.proveedores', function () {
    actualizarProveedor($(this));
    actualizarProveedorAsignado();
  })
  .on('input change', '.precio_lista', function () {
    actualizarPrecio($(this));
  })
  .on('input change', '.costo_neto, .IVA', function () {
    // Recalcular costo IVA del bloque
    actualizarCostoNeto($(this).closest('.proveedor').find('.costo_neto'));
    actualizarProveedorAsignado();
  });

$('#utilidad').on('input change', function () {
  actualizarPrecioFinal();
});

// ===============================
//  LÓGICA DE CÁLCULOS POR BLOQUE
// ===============================
function actualizarProveedor($select) {
  var $wrap = $select.closest('.proveedor');
  var $opt = $select.find('option:selected');

  var nombreProveedor = $opt.text() || '';
  var descuento = parseFloat($opt.data('descuento')) || 0;

  // Mostrar nombre del proveedor elegido en el bloque
  $wrap.find('.nombre_proveedor').text(nombreProveedor);

  // Guardar descuento en hidden si existe, sino lo creamos para consistencia
  var $hiddenDesc = $wrap.find('.descuentos_proveedor_id');
  if ($hiddenDesc.length === 0) {
    $hiddenDesc = $('<input>', { type: 'hidden', class: 'descuentos_proveedor_id', name: 'descuentos_proveedor_id[]', value: 0 });
    $wrap.append($hiddenDesc);
  }
  $hiddenDesc.val(descuento);

  // Actualizar labels (preferimos clases; si no existen, fallback a label[for])
  var nombre = nombreProveedor ? ' (' + nombreProveedor + ')' : '';
  var $lblCodigo = $wrap.find('.label-codigo');
  var $lblPL = $wrap.find('.label-precio-lista');
  var $lblDesc = $wrap.find('.label-descuento');

  if ($lblCodigo.length) $lblCodigo.text('Código' + nombre);
  else $wrap.find('label[for="codigo"]').text('Código' + nombre);

  if ($lblPL.length) $lblPL.text('Precio de Lista' + nombre);
  else $wrap.find('label[for="precio_lista"]').text('Precio de Lista' + nombre);

  if ($lblDesc.length) $lblDesc.text('Descuento' + nombre);
  else $wrap.find('label[for="descuentos_proveedor_id"]').text('Descuento' + nombre);
}

function actualizarPrecio($precioLista) {
  var $wrap = $precioLista.closest('.proveedor');

  var pl = parseFloat($precioLista.val()) || 0;

  // Tomamos el descuento del hidden si existe; si no, desde el option seleccionado
  var desc = parseFloat($wrap.find('.descuentos_proveedor_id').val());
  if (isNaN(desc)) {
    desc = parseFloat($wrap.find('.proveedores option:selected').data('descuento')) || 0;
  }

  // Costo neto
  var costoNeto = pl - (pl * desc / 100);
  var $costoNeto = $wrap.find('.costo_neto');
  if ($costoNeto.length === 0) {
    $costoNeto = $('<input>', { type: 'hidden', class: 'costo_neto', name: 'costo_neto[]', value: 0 });
    $wrap.append($costoNeto);
  }
  $costoNeto.val(Math.ceil(costoNeto));

  // IVA (si no existe el input oculto, lo creamos; default 21)
  var $iva = $wrap.find('.IVA');
  if ($iva.length === 0) {
    $iva = $('<input>', { type: 'hidden', class: 'IVA', name: 'IVA[]', value: 21 });
    $wrap.append($iva);
  }
  var iva = parseFloat($iva.val()) || 0;

  // Costo con IVA
  var costoConIVA = costoNeto + (costoNeto * iva / 100);
  var $costoIVA = $wrap.find('.costo_iva');
  if ($costoIVA.length === 0) {
    $costoIVA = $('<input>', { type: 'hidden', class: 'costo_iva', name: 'costo_iva[]', value: 0 });
    $wrap.append($costoIVA);
  }
  $costoIVA.val(Math.ceil(costoConIVA));

  // Actualizar indicadores globales
  actualizarProveedorAsignado();
  actualizarPrecioFinal();
}

function actualizarCostoNeto($costoNeto) {
  if (!$costoNeto || !$costoNeto.length) return;

  var $wrap = $costoNeto.closest('.proveedor');
  var cn = parseFloat($costoNeto.val()) || 0;

  var $iva = $wrap.find('.IVA');
  if ($iva.length === 0) {
    $iva = $('<input>', { type: 'hidden', class: 'IVA', name: 'IVA[]', value: 21 });
    $wrap.append($iva);
  }
  var iva = parseFloat($iva.val()) || 0;

  var cIVA = cn + (cn * iva / 100);
  var $costoIVA = $wrap.find('.costo_iva');
  if ($costoIVA.length === 0) {
    $costoIVA = $('<input>', { type: 'hidden', class: 'costo_iva', name: 'costo_iva[]', value: 0 });
    $wrap.append($costoIVA);
  }
  $costoIVA.val(Math.ceil(cIVA));
}

// =======================================
//  SELECCIÓN DEL PROVEEDOR MÁS ECONÓMICO
// =======================================
function getProveedorConCostoIvaMasBajo() {
  var proveedorConCostoIvaMasBajo = null;
  var costoIvaMasBajo = Infinity;

  $('.proveedor').each(function () {
    var val = $(this).find('.costo_iva').val();
    var costoIva = parseFloat(val);
    if (!isNaN(costoIva) && costoIva < costoIvaMasBajo) {
      costoIvaMasBajo = costoIva;
      proveedorConCostoIvaMasBajo = $(this);
    }
  });

  return proveedorConCostoIvaMasBajo;
}

// ===============================
//  PRECIO FINAL (UTILIDAD GLOBAL)
// ===============================
function actualizarPrecioFinal() {
  var $proveedor = getProveedorConCostoIvaMasBajo();
  if (!$proveedor || $proveedor.length === 0) return;

  var costoConIVA = parseFloat($proveedor.find('.costo_iva').val());
  if (isNaN(costoConIVA)) return;

  var utilidad = parseFloat($('#utilidad').val());
  if (isNaN(utilidad)) utilidad = 0;

  var precioFinal = costoConIVA + (costoConIVA * utilidad / 100);
  // redondeo al múltiplo de 10 superior
  precioFinal = Math.ceil(precioFinal / 10) * 10;

  $('#precio_venta').val(precioFinal);

  // cada vez que recalculamos precio final, refrescamos el “asignado”
  actualizarProveedorAsignado();
}

$('.costo_iva, #utilidad').on('change', actualizarPrecioFinal);

// =======================================
//  MOSTRAR PROVEEDOR ASIGNADO (MÁS BARATO)
// =======================================
function actualizarProveedorAsignado() {
  var costosConIva = document.querySelectorAll('.costo_iva');
  var costoMasBajo = Infinity;
  var proveedorMasBarato = '';

  costosConIva.forEach(function (costoConIva) {
    var costoActual = parseFloat(costoConIva.value);
    if (isNaN(costoActual)) return;

    var wrap = costoConIva.closest('.proveedor');
    var proveedorActual = '';
    if (wrap) {
      var el = wrap.querySelector('.nombre_proveedor');
      proveedorActual = el ? el.textContent : '';
    }

    if (costoActual < costoMasBajo) {
      costoMasBajo = costoActual;
      proveedorMasBarato = proveedorActual;
    }
  });

  var divProveedorAsignado = document.querySelector('#proveedorAsignado');
  if (divProveedorAsignado) {
    divProveedorAsignado.textContent = proveedorMasBarato || '';
  }
}

// Disparos iniciales por si hay un primer bloque cargado
$(function () {
  $('.proveedores').first().trigger('change');
  $('.precio_lista').first().trigger('change');
  actualizarProveedorAsignado();
  actualizarPrecioFinal();
});
