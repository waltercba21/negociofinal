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

//OBTENER PROVEEDORES 
$(document).ready(function() {
    // Adjuntar el controlador de eventos change a los elementos .proveedores
    $('.proveedores').change(function() {
        var selectedOption = $(this).find('option:selected');
        var descuento = selectedOption.data('descuento');
        var nombreProveedor = selectedOption.text();
        var closestFormGroup = $(this).closest('.form-group-crear');
        closestFormGroup.find('.nombre_proveedor').text(nombreProveedor);
        closestFormGroup.nextAll().find('.descuento').val(descuento);
        closestFormGroup.nextAll().find('label[for="codigo"]').text('Código (' + nombreProveedor + ')');
        closestFormGroup.nextAll().find('label[for="precio_lista"]').text('Precio de Lista (' + nombreProveedor + ')');
        closestFormGroup.nextAll().find('label[for="descuento"]').text('Descuento (' + nombreProveedor + ')');
        $('label[for="costo"]').text('Costo Proveedor (' + nombreProveedor + ')'); // Línea modificada
    });

    // Disparar el evento 'change' para el primer proveedor después de que el DOM esté completamente cargado
    $(window).on('load', function() {
        $('.proveedores').first().trigger('change');
    });
});
$(document).on('change', '.precio_lista', function() {
    var precioLista = parseFloat($(this).val());
    var descuento = parseFloat($(this).closest('.form-group-crear').nextAll().find('.descuento').val());
    var costo = precioLista - (precioLista * descuento / 100);
    $(this).closest('.form-group-crear').nextAll().find('#costo').val(costo.toFixed(2)); 
});


//AGREGAR PROVEEDORES
var proveedorCount = 0; // Añadir un contador para los proveedores
var proveedorTemplate = function(id) {
    return `
    <div class="form-group-crear">
    <label for="proveedores${id}">Proveedores: <span class="nombre_proveedor"></span></label>
    <select class="proveedores" id="proveedores${id}" name="proveedores[]" multiple>
        <!-- Aquí se agregarán las opciones de proveedores con JavaScript -->
    </select>
    </div>
    <div class="form-group-crear">
        <label for="precio_lista${id}">Precio de Lista:</label>
        <input class="precio_lista" id="precio_lista${id}" type="number" name="precio_lista">
    </div>
    <div class="form-group-crear">
        <label for="codigo${id}">Código:</label>
        <input class="codigo" id="codigo${id}" type="text" name="codigo">
    </div>
    <div class="form-group-crear">
    <label for="descuento${id}">Descuento:</label>
    <input class="descuento" id="descuento${id}" class="form-control" type="number" name="descuento[]" readonly>
    </div>
    <div class="form-group-crear">
    <label for="costo${id}">Costo Proveedor:</label>
    <input class="costo" id="costo${id}" class="form-control" type="number" name="costo[]" readonly>
    </div>
    `;
};

$('#addProveedor').click(function(event) {
    // Prevenir el comportamiento predeterminado del evento de clic
    event.preventDefault();

    // Obtener la lista de proveedores del DOM
    var proveedores = $('.proveedores option').map(function() {
        return {
            id: $(this).val(),
            nombre: $(this).text(),
            descuento: $(this).data('descuento')
        };
    }).get();

    var newProveedor = $(proveedorTemplate(proveedorCount));
    $('#proveedoresContainer').append(newProveedor);

    // Agregar las opciones al nuevo select de proveedores
    proveedores.forEach(function(proveedor) {
        newProveedor.find('.proveedores').append('<option value="' + proveedor.id + '" data-descuento="' + proveedor.descuento + '">' + proveedor.nombre + '</option>');
    });

 // Adjuntar el controlador de eventos change a los elementos .proveedores
 newProveedor.find('.proveedores').change(function() {
    var selectedOption = $(this).find('option:selected');
    var descuento = selectedOption.data('descuento');
    var nombreProveedor = selectedOption.text();
    $(this).closest('.form-group-crear').find('.nombre_proveedor').text(nombreProveedor);
    $(this).closest('.form-group-crear').nextAll().find('.descuento').val(descuento);
    $(this).closest('.form-group-crear').nextAll().find('label').each(function() {
        var forAttr = $(this).attr('for');
        $(this).text($(this).text().replace(/\(.*\)/, '') + ' (' + nombreProveedor + ')');
    });
});

    // Adjuntar el controlador de eventos change al elemento .precio_lista
    newProveedor.find('.precio_lista').change(function() {
        var precioLista = parseFloat($(this).val());
        var descuento = parseFloat($(this).closest('.form-group-crear').nextAll().find('.descuento').val());
        var costo = precioLista - (precioLista * descuento / 100);
        $(this).closest('.form-group-crear').nextAll().find('.costo').val(costo.toFixed(2));
    });

    newProveedor.find('.proveedores').first().trigger('change');

    proveedorCount++; // Incrementar el contador de proveedores
});
// Adjuntar el controlador de eventos change al elemento .precio_lista
newProveedor.find('.precio_lista').change(function() {
    var precioLista = parseFloat($(this).val());
    var descuento = parseFloat($(this).closest('.form-group-crear').nextAll().find('.descuento').val());
    var costo = precioLista - (precioLista * descuento / 100);
    $(this).closest('.form-group-crear').nextAll().find('.costo').val(costo.toFixed(2));

    // Disparar el evento de cambio para el campo de utilidad
    $('#utilidad').trigger('change');
});
$('#utilidad').change(function() {
    var utilidad = parseFloat($(this).val());
    var costo = Math.min.apply(null, $('.costo').map(function() {
        return parseFloat($(this).val());
    }).get());
    var precioFinal = costo + (costo * utilidad / 100);
    $('#precio').val(precioFinal.toFixed(2)); // Cambiado aquí
});