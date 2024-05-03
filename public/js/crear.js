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

// AGREGAR PROVEEDOR AL PRODUCTO 
$(document).ready(function() {
    var proveedorTemplate = `
    <div class="form-group-crear">
        <label for="proveedores">Proveedores:</label>
        <select class="proveedores" name="proveedores[]" multiple>
            <% proveedores.forEach(function(proveedor) { %>
                <option value="<%= proveedor.id %>" data-descuento="<%= proveedor.descuento %>"><%= proveedor.nombre %></option>
            <% }); %>
        </select>
    </div>
    <div class="form-group-crear">
        <label for="codigo">Código:</label>
        <input class="codigo" type="text" name="codigo[]">
    </div>
    <div class="form-group-crear">
        <label for="precio_lista">Precio de Lista:</label>
        <input class="precio_lista" class="form-control" type="number" name="precio_lista[]">
    </div>
    <div class="form-group-crear">
        <label for="descuento">Descuento:</label>
        <input class="descuento" class="form-control" type="number" name="descuento[]">
    </div>
`;
$('#addProveedor').click(function() {
    $('#proveedoresContainer').append(proveedorTemplate);
});

    // ACTUALIZAR DINÁMICAMENTE EL DESCUENTO
    $(document).on('change', '.proveedores', function() {
        var selectedOption = $(this).find('option:selected');
        var descuento = selectedOption.data('descuento');
        $(this).closest('.form-group-crear').find('.descuento').val(descuento);
    });
});