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
        <input class="codigo" type="text" name="codigo[]">
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
});
$(document).on('change', '.precio_lista', function() {
    var precioLista = $(this).val();
    var descuento = $(this).closest('.form-group-crear').nextAll().find('.descuento').val();
    var costo = precioLista - (precioLista * descuento / 100);
    $(this).closest('.form-group-crear').nextAll().find('.costo').val(costo);
});
$(document).on('change', '.proveedores', function() {
    var selectedOption = $(this).find('option:selected');
    var descuento = selectedOption.data('descuento');
    $(this).closest('.form-group-crear').nextAll().find('.descuento').val(descuento);
});