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
        $(newProveedor).find('input:not(.IVA)').val('');
        $(newProveedor).find('select').prop('selectedIndex', 0);
        $(newProveedor).find('.nombre_proveedor').text('');
        // Disparar el evento change en el selector de proveedores
        $(newProveedor).find('.proveedores').trigger('change');
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
    var closestFormGroup = proveedor.closest('.proveedor'); // Cambiado aquí
    closestFormGroup.find('.nombre_proveedor').text(nombreProveedor);
    closestFormGroup.find('.descuentos_proveedor_id').val(descuento); // Cambiado aquí
    closestFormGroup.find('label[for="codigo"]').text('Código (' + nombreProveedor + ')'); // Cambiado aquí
    closestFormGroup.find('label[for="precio_lista"]').text('Precio de Lista (' + nombreProveedor + ')'); // Cambiado aquí
    closestFormGroup.find('label[for="descuentos_proveedor_id"]').text('Descuento (' + nombreProveedor + ')'); // Cambiado aquí
}
$('.proveedores').on('change', function() {
    actualizarProveedor($(this));
});

function actualizarPrecio(precioListaElement) {
    var precioLista = parseFloat(precioListaElement.val());
    var proveedorElement = precioListaElement.closest('.proveedor');
    var descuento = parseFloat(proveedorElement.find('.descuentos_proveedor_id[data-proveedor="' + proveedorElement.val() + '"]').val());
    if (isNaN(descuento)) {
        descuento = parseFloat(proveedorElement.find('.proveedores option:selected').data('descuento'));
    }
    var costo = precioLista - (precioLista * descuento / 100);
    precioListaElement.closest('.form-group-crear').nextAll().find('.costo').val(costo.toFixed(2)); 
    var costoNeto = precioLista - (precioLista * descuento / 100); 
    var costoNetoElement = proveedorElement.find('.costo_neto');
    costoNetoElement.val(costoNeto.toFixed(2)); 
    actualizarCostoNeto(costoNetoElement); 
    proveedorElement.find('.utilidad').trigger('change');
    proveedorElement.find('.costo_neto').trigger('change');
}

function actualizarCostoNeto(costoNetoElement) {
    var costoNeto = parseFloat(costoNetoElement.val());
    var IVA = parseFloat(costoNetoElement.closest('.proveedor').find('.IVA').val());
    var costoConIVA = costoNeto + (costoNeto * IVA / 100);
    costoNetoElement.closest('.proveedor').find('.costo_iva').val(costoConIVA.toFixed(2));
}
function getProveedorConCostoIvaMasBajo() {
    var proveedorConCostoIvaMasBajo = null;
    var costoIvaMasBajo = Infinity;

    $('.proveedor').each(function() {
        var costoIva = parseFloat($(this).find('.costo_iva').val());
        if (costoIva < costoIvaMasBajo) {
            costoIvaMasBajo = costoIva;
            proveedorConCostoIvaMasBajo = $(this);
        }
    });

    return proveedorConCostoIvaMasBajo;
}

function actualizarPrecioFinal() {
    var proveedor = getProveedorConCostoIvaMasBajo();
    var costoConIVA = parseFloat(proveedor.find('.costo_iva').val());
    var utilidad = parseFloat($('#utilidad').val());
    var precioFinal = costoConIVA + (costoConIVA * utilidad / 100);
    $('#precio_venta').val(precioFinal.toFixed(2));
}
$('.costo_iva, #utilidad').on('change', actualizarPrecioFinal);

