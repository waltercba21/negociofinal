//OBTENER LOS MODELOS POR MARCA 
$('#marca').change(function() {
    var marcaId = $(this).val();
    $('#modelo_id').empty();
    $('#modelo_id').append('<option value="">Selecciona un modelo...</option>');
    $.get('/productos/modelos/' + marcaId, function(modelosPorMarca) {
        modelosPorMarca.forEach(function(modelo) {
            $('#modelo_id').append('<option value="' + modelo.id + '">' + modelo.nombre + '</option>');
        });
    });
});

$(document).ready(function() {
    $('#descuentos_proveedor_id').val('');
    $('.proveedores').change(function() {
        actualizarProveedor($(this));
    });
    $(window).on('load', function() {
        $('.proveedores').first().trigger('change');
    });
    $('#addProveedor').click(function(e) {
        e.preventDefault();
        var newProveedor = $('.proveedor').first().clone(true);
        $(newProveedor).insertBefore('#addProveedor');
       // Limpiar los campos del nuevo contenedor
       $(newProveedor).find('input').val('');
       $(newProveedor).find('select').prop('selectedIndex', 0);
       $(newProveedor).find('.nombre_proveedor').text('');
   });
});

$(document).on('change', '.precio_lista', function() {
    actualizarPrecio($(this));
});
$('#costo_neto').change(function() {
    actualizarCostoNeto($(this));
});
$('#utilidad').change(function() {
    actualizarPrecioFinal();
});
function actualizarProveedor(proveedor) {
    var selectedOption = proveedor.find('option:selected');
    var descuento = selectedOption.data('descuento');
    var nombreProveedor = selectedOption.text();
    var closestFormGroup = proveedor.closest('.form-group-crear');
    closestFormGroup.find('.nombre_proveedor').text(nombreProveedor);
    // Establecer el valor del descuento solo cuando se selecciona un proveedor
    $('#descuentos_proveedor_id').val(descuento);
    closestFormGroup.nextAll().find('label[for="codigo"]').text('Código (' + nombreProveedor + ')');
    closestFormGroup.nextAll().find('label[for="precio_lista"]').text('Precio de Lista (' + nombreProveedor + ')');
    closestFormGroup.nextAll().find('label[for="descuento"]').text('Descuento (' + nombreProveedor + ')');
    $('label[for="costo"]').text('Costo Proveedor (' + nombreProveedor + ')'); 
}

function actualizarPrecio(precioListaElement) {
    var precioLista = parseFloat(precioListaElement.val());
    var proveedorElement = precioListaElement.closest('.proveedor');
    var descuento = parseFloat($('#descuentos_proveedor_id').val());
    // Si descuento es NaN, intentar obtenerlo del atributo de datos de la opción seleccionada
    if (isNaN(descuento)) {
        descuento = parseFloat(proveedorElement.find('.proveedores option:selected').data('descuento'));
    }
    var costo = precioLista - (precioLista * descuento / 100);
    precioListaElement.closest('.form-group-crear').nextAll().find('.costo').val(costo.toFixed(2)); 

    var costoNeto = precioLista - (precioLista * descuento / 100); 
    precioListaElement.closest('.proveedor').find('#costo_neto').val(costoNeto.toFixed(2)); 
    precioListaElement.closest('.proveedor').find('.utilidad').trigger('change');
    precioListaElement.closest('.proveedor').find('#costo_neto').trigger('change');
}

function actualizarCostoNeto(costoNetoElement) {
    var costoNeto = parseFloat(costoNetoElement.val());
    var IVA = parseFloat(costoNetoElement.closest('.proveedor').find('.IVA').val());
    var costoConIVA = costoNeto + (costoNeto * IVA / 100);
    costoNetoElement.closest('.proveedor').find('.costo_iva').val(costoConIVA.toFixed(2));
}

function actualizarPrecioFinal() {
    var costoConIVA = parseFloat($('#costo_iva').val());
    var utilidad = parseFloat($('#utilidad').val());
    var precioFinal = costoConIVA + (costoConIVA * utilidad / 100);
    $('#precio_venta').val(precioFinal.toFixed(2));
}


