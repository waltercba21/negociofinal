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
//AGREGAR PROVEEDORES
var proveedorTemplate = `
    <div class="form-group-crear">
        <label for="proveedores">Proveedores:</label>
        <select class="proveedores" name="proveedores[]" multiple>
            <!-- Aquí se agregarán las opciones de proveedores con JavaScript -->
        </select>
    </div>
    <div class="form-group-crear">
        <label for="codigo">Código:</label>
        <input class="codigo" type="text" name="codigo">
    </div>
    <div class="form-group-crear">
    <label for="descuento">Descuento:</label>
    <input class="descuento" class="form-control" type="number" name="descuento[]" readonly>
</div>
<div class="form-group-crear">
    <label for="costo">Costo Proveedor:</label>
    <input class="costo" class="form-control" type="number" name="costo[]" readonly>
</div>
`;
$('#addProveedor').click(function(event) {
    // Prevenir el comportamiento predeterminado del evento de clic
    event.preventDefault();

    var newProveedor = $(proveedorTemplate);
    $('#proveedoresContainer').append(newProveedor);

    // Aquí se agregan las opciones de proveedores al nuevo select
    $('.proveedores:first option').clone().appendTo(newProveedor.find('.proveedores'));

    // Adjuntar el controlador de eventos change a los elementos .proveedores
    newProveedor.find('.proveedores').change(function() {
        var selectedOption = $(this).find('option:selected');
        var descuento = selectedOption.data('descuento');
        $(this).closest('.form-group-crear').nextAll().find('.descuento').val(descuento);
    });
});

$(document).on('change', '.precio_lista', function() {
    var precioLista = parseFloat($(this).val());
    var descuento = parseFloat($(this).closest('.form-group-crear').nextAll().find('.descuento').val());
    var costo = precioLista - (precioLista * descuento / 100);
    $('#costo').val(costo.toFixed(2));
});
$(document).on('change', '.proveedores', function() {
    var selectedOption = $(this).find('option:selected');
    var descuento = selectedOption.data('descuento');
    $(this).closest('.form-group-crear').nextAll().find('.descuento').val(descuento);
    var precioLista = parseFloat($('.precio_lista').val());
    var costo = precioLista - (precioLista * descuento / 100);
    $(this).closest('.form-group-crear').nextAll().find('.costo').val(costo.toFixed(2));
});
$('#utilidad').change(function() {
    var utilidad = parseFloat($(this).val());
    var costo = parseFloat($('#costo').val());
    var precioFinal = costo + (costo * utilidad / 100);
    $('#precio').val(precioFinal.toFixed(2));
});
$(document).on('change', '.precio_lista', function() {
    var precioLista = parseFloat($(this).val());
    var costoMinimo = null;

    $('.costo').each(function() {
        var descuento = parseFloat($(this).closest('.form-group-crear').prevAll().find('.descuento').val());
        var costo = precioLista - (precioLista * descuento / 100);

        if (costoMinimo === null || costo < costoMinimo) {
            costoMinimo = costo;
        }
    });

    $('#costo').val(costoMinimo.toFixed(2));
});