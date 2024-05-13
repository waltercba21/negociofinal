//OBTENER LOS MODELOS POR MARCA 
$('#marca-input').change(function() {
    var marcaId = $(this).val();
    $('#modelo-input').empty();
    $('#modelo-input').append('<option value="">Selecciona un modelo...</option>');
    $.get('/productos/modelos/' + marcaId, function(modelosPorMarca) {
        modelosPorMarca.forEach(function(modelo) {
            $('#modelo-input').append('<option value="' + modelo.id + '">' + modelo.nombre + '</option>');
        });
    });
});
$(document).ready(function() {
    // Adjuntar el controlador de eventos change a los elementos .proveedores
    $('.proveedores').change(function() {
        var selectedOption = $(this).find('option:selected');
        var descuento = Math.ceil(selectedOption.data('descuento'));
        var nombreProveedor = selectedOption.text();
        var closestFormGroup = $(this).closest('.form-group-crear');
        closestFormGroup.find('.nombre_proveedor').text(nombreProveedor);
        closestFormGroup.nextAll().find('.descuento').val(descuento);
        closestFormGroup.nextAll().find('label[for="codigo"]').text('Código (' + nombreProveedor + ')');
        closestFormGroup.nextAll().find('label[for="precio_lista"]').text('Precio de Lista (' + nombreProveedor + ')');
        closestFormGroup.nextAll().find('label[for="descuento"]').text('Descuento (' + nombreProveedor + ')');
        $('label[for="costo"]').text('Costo Proveedor (' + nombreProveedor + ')'); // Línea modificada
    });
    
    $(window).on('load', function() {
        $('.proveedores').first().trigger('change');
    });
});

$(document).on('change', '.precio_lista, .descuentos_proveedor_id', function() {
    var precioLista = parseFloat($(this).val());
    var descuento = parseFloat($(this).closest('.form-group-crear').nextAll().find('.descuentos_proveedor_id').val());
    var costoNeto = precioLista - (precioLista * descuento / 100);
    $(this).closest('.form-group-crear').nextAll().find('.costo_neto').val(parseInt(Math.ceil(costoNeto))); 

    // Calcular el 'Costo Neto Con IVA'
    var IVA = parseFloat($(this).closest('.form-group-crear').nextAll().find('.IVA').val());
    var costoIVA = costoNeto + (costoNeto * IVA / 100);
    $(this).closest('.form-group-crear').nextAll().find('.costo_iva').val(parseInt(Math.ceil(costoIVA)));

    // Disparar el evento de cambio para #utilidad
    $('#utilidad').trigger('change');
}); 

//AGREGAR PROVEEDORES
var proveedorCount = 0; // Añadir un contador para los proveedores
var proveedorTemplate = function(id) {
    return `
    <div class="proveedor">
        <div class="form-group-crear">
            <label for="proveedores${id}">Proveedores: <span class="nombre_proveedor"></span></label>
            <select class="proveedores" id="proveedores${id}" name="proveedores[]" multiple>
                <!-- Aquí se agregarán las opciones de proveedores con JavaScript -->
            </select>
        </div>
        <div class="form-group-crear">
            <label for="codigo${id}">Código:</label>
            <input class="codigo" id="codigo${id}" type="text" name="codigo">
        </div>
        <div class="form-group-crear">
            <label for="precio_lista${id}">Precio de Lista:</label>
            <input class="precio_lista form-control" id="precio_lista${id}" type="number" name="precio_lista[]">
        </div>
        <div class="form-group-crear">
            <label for="descuentos_proveedor_id${id}">Descuentos Proveedor:</label>
            <input class="descuentos_proveedor_id form-control" id="descuentos_proveedor_id${id}" type="text" name="descuentos_proveedor_id[]" readonly>
        </div>
        <div class="form-group-crear">
            <label for="costo_neto${id}">Costo Neto:</label>
            <input class="costo_neto form-control" id="costo_neto${id}" type="number" name="costo_neto[]" readonly>
        </div>
        <div class="form-group-crear">
            <label for="IVA${id}">IVA:</label>
            <input class="IVA form-control" id="IVA${id}" type="number" name="IVA[]" value="21" readonly>
        </div>
        <div class="form-group-crear">
            <label for="costo_iva${id}">Costo Neto Con IVA :</label>
            <input class="costo_iva form-control" id="costo_iva${id}" type="number" name="costo_iva[]">
        </div>
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
    $(this).closest('.form-group-crear').nextAll().find('.descuentos_proveedor_id').val(descuento); // Línea modificada
    $(this).closest('.form-group-crear').nextAll().find('label').each(function() {
        var forAttr = $(this).attr('for');
        $(this).text($(this).text().replace(/\(.*\)/, '') + ' (' + nombreProveedor + ')');
    });
});

newProveedor.find('.precio_lista').change(function() {
    var precioLista = parseFloat($(this).val());
    // Buscar el valor del descuento en un elemento con la clase .descuentos_proveedor_id
    var descuento = parseFloat($(this).closest('.form-group-crear').nextAll().find('.descuentos_proveedor_id').val());
    var costo = precioLista - (precioLista * descuento / 100);
    $(this).closest('.form-group-crear').nextAll().find('.costo').val(costo.toFixed(2));
});

    newProveedor.find('.proveedores').first().trigger('change');

    proveedorCount++; // Incrementar el contador de proveedores
});


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
    $('#precio_venta').val(Math.ceil(precioFinal));
}


$('#utilidad').change(function() {
    var utilidad = parseFloat($(this).val());
    var costo = Math.min.apply(null, $('.costo').map(function() {
        return parseFloat($(this).val());
    }).get());
    var precioFinal = costo + (costo * utilidad / 100);
    $('#precio').val(Math.ceil(precioFinal));
});
