$(document).ready(function() {
    // Disparar el evento 'change' para '.proveedores' después de que el DOM esté completamente cargado
    $('.proveedores').trigger('change');
});

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
    <label for="precio_lista">Precio de Lista:</label>
    <input class="precio_lista" type="number" name="precio_lista">
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

    // Obtener la lista de proveedores del DOM
    var proveedores = $('.proveedores option').map(function() {
        return {
            id: $(this).val(),
            nombre: $(this).text(),
            descuento: $(this).data().descuento
        };
    }).get();

    var newProveedor = $(proveedorTemplate);
    $('#proveedoresContainer').append(newProveedor);

    // Agregar las opciones al nuevo select de proveedores
    proveedores.forEach(function(proveedor) {
        newProveedor.find('.proveedores').append('<option value="' + proveedor.id + '" data-descuento="' + proveedor.descuento + '">' + proveedor.nombre + '</option>');
    });

  // Adjuntar el controlador de eventos change a los elementos .proveedores
  newProveedor.find('.proveedores').change(function() {
    var selectedOption = $(this).find('option:selected');
    var descuento = selectedOption.data('descuento'); // Cambio aquí
    $(this).closest('.form-group-crear').find('.descuento').val(descuento);
});
});

$(document).on('change', '.precio_lista', function() {
    var precioLista = parseFloat($(this).val());
    var descuento = parseFloat($(this).closest('.form-group-crear').nextAll().find('.descuento').val());
    var costo = precioLista - (precioLista * descuento / 100);
    $(this).closest('.form-group-crear').nextAll().find('.costo').val(costo.toFixed(2));
});

$(document).on('change', '.proveedores', function() {
    var selectedOption = $(this).find('option:selected');
    var descuentos = selectedOption.map(function() {
        return $(this).data().descuento;
    }).get();
    // Aquí puedes decidir qué hacer con los descuentos. Por ejemplo, podrías calcular el promedio.
    var descuentoPromedio = descuentos.reduce(function(a, b) { return a + b; }) / descuentos.length;

    $(this).closest('.form-group-crear').find('.descuento').val(descuentoPromedio);
    var nombreProveedor = selectedOption.text();
    var precioLista = parseFloat($(this).closest('.form-group-crear').find('.precio_lista').val());
    var costo = precioLista - (precioLista * descuentoPromedio / 100); // Aquí usamos descuentoPromedio en lugar de descuento

    // Actualiza las etiquetas con el nombre del proveedor
    $(this).closest('.form-group-crear').find('label[for="codigo"]').text('Código (' + nombreProveedor + '):');
    $(this).closest('.form-group-crear').find('label[for="precio_lista"]').text('Precio de Lista (' + nombreProveedor + '):');
    $(this).closest('.form-group-crear').find('label[for="descuento"]').text('Descuento (' + nombreProveedor + '):');
    $(this).closest('.form-group-crear').find('label[for="costo"]').text('Costo Proveedor (' + nombreProveedor + '):');

    $(this).closest('.form-group-crear').find('.costo').val(costo.toFixed(2));
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