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
$('#marca').off('change').on('change', function () {
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
  $('form').on('keypress', function (e) {
    if (e.keyCode === 13) e.preventDefault();
  });

  // Botón Agregar Proveedor (prevenir handlers duplicados)
  $('#addProveedor').off('click').on('click', function (e) {
    e.preventDefault();

    var $base = $('.proveedor').first();               // plantilla
    if ($base.length === 0) return;

    // Clon sin eventos (evita duplicaciones y “crecimientos” extra)
    var $nuevo = $base.clone(false);

    // Limpiar valores del clon
    $nuevo.find('input:not(.IVA)').val('');
    $nuevo.find('select').prop('selectedIndex', 0);
    $nuevo.find('.nombre_proveedor').text('');

    // Eliminar ids/for duplicados
    $nuevo.find('[id]').removeAttr('id');
    $nuevo.find('label[for]').removeAttr('for');

    // Reset labels de bloque
    $nuevo.find('.label-codigo').text('Código');
    $nuevo.find('.label-precio-lista').text('Precio de Lista');
    $nuevo.find('.label-descuento').text('Descuento');

    // Insertar antes del botón + (el botón no se clona)
    $nuevo.insertBefore('#addProveedor');

    // Disparar cambios para inicializar cálculos del bloque
    $nuevo.find('.proveedores').trigger('change');
    $nuevo.find('.precio_lista').trigger('change');
    actualizarProveedorAsignado();
    actualizarPrecioFinal();
  });

  // Disparos iniciales
  $('.proveedores').first().trigger('change');
  $('.precio_lista').first().trigger('change');
  actualizarProveedorAsignado();
  actualizarPrecioFinal();
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
    actualizarCostoNeto($(this).closest('.proveedor').find('.costo_neto'));
    actualizarProveedorAsignado();
  });

$('#utilidad').off('input change').on('input change', function () {
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

  $wrap.find('.nombre_proveedor').text(nombreProveedor);

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

  var pl = parseFloat($precioLista.val()) || 0;
  var desc = parseFloat($wrap.find('.descuentos_proveedor_id').val());
  if (isNaN(desc)) {
    desc = parseFloat($wrap.find('.proveedores option:selected').data('descuento')) || 0;
  }

  var $costoNeto = asegurarHidden($wrap, 'costo_neto', 'costo_neto[]', 0);
  var $iva      = asegurarHidden($wrap, 'IVA', 'IVA[]', 21);
  var $costoIVA = asegurarHidden($wrap, 'costo_iva', 'costo_iva[]', 0);

  var costoNeto = pl - (pl * desc / 100);
  $costoNeto.val(Math.ceil(costoNeto));

  var iva = parseFloat($iva.val()) || 0;
  var costoConIVA = costoNeto + (costoNeto * iva / 100);
  $costoIVA.val(Math.ceil(costoConIVA));

  actualizarProveedorAsignado();
  actualizarPrecioFinal();
}

function actualizarCostoNeto($costoNeto) {
  if (!$costoNeto || !$costoNeto.length) return;

  var $wrap = $costoNeto.closest('.proveedor');
  var cn = parseFloat($costoNeto.val()) || 0;
  var $iva = asegurarHidden($wrap, 'IVA', 'IVA[]', 21);
  var $costoIVA = asegurarHidden($wrap, 'costo_iva', 'costo_iva[]', 0);

  var iva = parseFloat($iva.val()) || 0;
  var cIVA = cn + (cn * iva / 100);
  $costoIVA.val(Math.ceil(cIVA));
}

// =======================================
//  SELECCIÓN DEL PROVEEDOR MÁS ECONÓMICO
//  (checkea el radio y muestra nombre)
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
  var $proveedor = getProveedorConCostoIvaMasBajo();
  var nombre = '';

  // marcar radio del más barato
  $('.proveedor-designado-radio').prop('checked', false);

  if ($proveedor && $proveedor.length) {
    var elNombre = $proveedor.find('.nombre_proveedor').text();
    nombre = elNombre || '';

    // si este bloque tiene un radio asociado, marcarlo
    var $radio = $proveedor.find('.proveedor-designado-radio');
    if ($radio.length) $radio.prop('checked', true);
  }

  var cont = document.querySelector('#proveedorAsignado');
  if (cont) cont.textContent = nombre;
}

// ===============================
//  PRECIO FINAL (UTILIDAD GLOBAL)
// ===============================
function actualizarPrecioFinal() {
  var $proveedor = getProveedorConCostoIvaMasBajo();
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
$('.costo_iva, #utilidad').off('change').on('change', actualizarPrecioFinal);
