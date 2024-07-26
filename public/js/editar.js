document.addEventListener('DOMContentLoaded', function() {
    function agregarEventoDblclick(div) {
        div.addEventListener('dblclick', function() {
            var imagenId = div.dataset.imagenId;
            fetch('/productos/eliminarImagen/' + imagenId, {
                method: 'DELETE'
            }).then(response => response.json())
            .then(data => {
                if (data.success) {
                    div.parentNode.removeChild(div);
                } else {
                    console.error('Error al eliminar la imagen:', data.error);
                }
            }).catch(error => {
                console.error('Error al hacer la solicitud:', error);
            });
        });
    }

    document.getElementById('imagen').addEventListener('change', function(e) {
        var preview = document.getElementById('preview');
        if (preview) {
            preview.innerHTML = ''; // Limpia el contenedor de imágenes previas
            Array.from(e.target.files).forEach(file => {
                var img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.height = 100;
                img.width = 100;
                img.classList.add('imagen-miniatura');
                var div = document.createElement('div');
                div.classList.add('preview-img');
                div.dataset.imagenId = img.src;
                div.appendChild(img);
                agregarEventoDblclick(div);
                preview.appendChild(div);
            });
        } else {
            console.error('El elemento con id "preview" no existe.');
        }
    });

    if (typeof Sortable !== 'undefined' && document.getElementById('preview')) {
        new Sortable(document.getElementById('preview'), {
            animation: 150,
            draggable: '.preview-img'
        });
    } else {
        console.error('Sortable no está definido o no se pudo inicializar.');
    }
});


$(document).ready(function() {
    // Vincular eventos a los elementos originales
    $(document).on('change', '.precio_lista', function() {
      var proveedorElement = $(this).closest('.proveedor');
      calcularCostos(proveedorElement);
      actualizarPrecioVenta();
      if ($(this).val() !== '') {
        actualizarProveedorAsignado();
      }
    });
  
    $(document).on('click', '.eliminar-proveedor', function() {
      var proveedorId = $(this).data('proveedor-id');
      var elementoProveedor = $(this).closest('.proveedor');
      fetch('/eliminarProveedor/' + proveedorId, {
        method: 'DELETE'
      }).then(response => response.json())
      .then(data => {
        if (data.success) {
          elementoProveedor.remove();
          actualizarProveedorAsignado();
        } else {
          console.error('Error al eliminar el proveedor:', data.error);
        }
      }).catch(error => {
        console.error('Error al hacer la solicitud:', error);
      });
    });
  
    $('#addProveedor').click(function(e) {
      e.preventDefault();
      $('.proveedor').removeClass('proveedor-asignado');
      var newProveedor = $('.proveedor').first().clone(true);
  
      // Limpiar los valores de los campos del nuevo proveedor
      newProveedor.find('input:not([type="button"]), select').val('');
      newProveedor.find('.IVA').val('21');
      newProveedor.find('.nombre_proveedor').text('');
  
      // Actualizar eventos para el nuevo proveedor
      newProveedor.off('change', '.precio_lista');
      newProveedor.off('click', '.eliminar-proveedor');
      newProveedor.off('input', '#nombre_producto');
      newProveedor.off('input', '#precio_venta');
  
      newProveedor.insertBefore(this);
      newProveedor.find('.proveedores').trigger('change');
  
      // Actualizar eventos de cambio para los campos de nombre del producto y precio de venta
      newProveedor.find('#nombre_producto').on('input', function() {
        console.log('Nombre del producto cambiado');
      });
  
      newProveedor.find('#precio_venta').on('input', function() {
        console.log('Precio de venta cambiado');
      });
    });
  
    $('form').on('keypress', function(e) {
      if (e.keyCode === 13) {
        e.preventDefault();
      }
    });
  
    $('.precio_lista').trigger('change');
    $('#utilidad').trigger('change');
  });
  
  function actualizarProveedor(proveedorSelectElement) {
    var selectedOption = proveedorSelectElement.find('option:selected');
    var descuento = selectedOption.data('descuento');
    var nombreProveedor = selectedOption.text();
    var closestFormGroup = proveedorSelectElement.closest('.proveedor');
  
    closestFormGroup.find('.nombre_proveedor').text(nombreProveedor);
    closestFormGroup.find('.descuentos_proveedor_id').val(descuento);
    closestFormGroup.find('label[for="codigo"]').text('Código (' + nombreProveedor + ')');
    closestFormGroup.find('label[for="precio_lista"]').text('Precio de Lista (' + nombreProveedor + ')');
    closestFormGroup.find('label[for="descuentos_proveedor_id"]').text('Descuento (' + nombreProveedor + ')');
  }
  
  function calcularCostos(proveedorElement) {
    var precioLista = parseFloat(proveedorElement.find('.precio_lista').val() || 0);
    var descuento = parseFloat(proveedorElement.find('.descuentos_proveedor_id').val() || 0);
    var costoNeto = Math.ceil(precioLista - (precioLista * descuento / 100));
    var iva = 21; // IVA fijo del 21%
    var costoConIVA = Math.ceil(costoNeto * (1 + iva / 100));
  
    proveedorElement.find('.costo_neto').val(costoNeto);
    proveedorElement.find('.costo_iva').val(costoConIVA);
  }
  
  function actualizarProveedorAsignado() {
    var costosConIva = $('.costo_iva');
    var costoMasBajo = Infinity;
    var proveedorMasBarato = null;
    costosConIva.each(function() {
      var costoActual = parseFloat($(this).val());
      if (!isNaN(costoActual) && costoActual < costoMasBajo) {
        costoMasBajo = costoActual;
        proveedorMasBarato = $(this).closest('.proveedor');
      }
    });
    $('.proveedor').removeClass('proveedor-asignado');
    $('.proveedor').find('span:contains("Proveedor Asignado")').remove();
    if (proveedorMasBarato && costoMasBajo !== Infinity && proveedorMasBarato.find('.costo_iva').val() !== '') {
      proveedorMasBarato.addClass('proveedor-asignado');
      proveedorMasBarato.find('.nombre_proveedor').after('<span> (Proveedor Asignado)</span>');
    }
    // Actualizar color de fondo para el proveedor asignado
    $('.proveedor-asignado').css('background-color', '#dff0d8');
  }
  
  function actualizarPrecioVenta() {
    var utilidad = parseFloat($('#utilidad').val() || 0);
    var costoConIVA = parseFloat($('.costo_iva').filter(function() {
      return parseFloat($(this).val()) === Math.min(...$.map($('.costo_iva'), function(el) { return parseFloat($(el).val()); }));
    }).val() || 0);
    var precioVenta = Math.ceil(costoConIVA * (1 + utilidad / 100));
    $('#precio_venta').val(precioVenta);
  }
  