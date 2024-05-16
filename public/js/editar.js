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
    $('.proveedores').change(function() {
        var selectedOption = $(this).find('option:selected');
        var descuento = Math.ceil(selectedOption.data('descuento'));
        var nombreProveedor = selectedOption.text();
        var closestProveedor = $(this).closest('.proveedor');
        closestProveedor.find('.nombre_proveedor').text(nombreProveedor);
        closestProveedor.find('.descuentos_proveedor_id').val(descuento);
        closestProveedor.find('label[for="codigo"]').text('Código (' + nombreProveedor + ')');
        closestProveedor.find('label[for="precio_lista"]').text('Precio de Lista (' + nombreProveedor + ')');
        closestProveedor.find('label[for="descuentos_proveedor_id"]').text('Descuento (' + nombreProveedor + ')');
        $('label[for="costo"]').text('Costo Proveedor (' + nombreProveedor + ')'); 
    });
    $(window).on('load', function() {
        $('.proveedores').each(function() {
            $(this).trigger('change');
        });
        $('.precio_lista, .descuentos_proveedor_id').each(function() {
            $(this).trigger('change');
        });
    });
});
$(document).on('change', '.precio_lista, .descuentos_proveedor_id', function() {
    var closestProveedor = $(this).closest('.proveedor');
    var precioLista = parseFloat(closestProveedor.find('.precio_lista').val()) || 0;
    var descuento = parseFloat(closestProveedor.find('.descuentos_proveedor_id').val()) || 0;
    var costoNeto = precioLista - (precioLista * descuento / 100);
    closestProveedor.find('.costo_neto').val(Math.floor(costoNeto)); 
    var IVA = parseFloat(closestProveedor.find('.IVA').val()) || 0;
    var costoIVA = costoNeto + (costoNeto * IVA / 100);
    closestProveedor.find('.costo_iva').val(Math.floor(costoIVA));
    $('#utilidad').trigger('change');
});
var proveedorCount = 0; 
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
    event.preventDefault();
    var proveedores = $('.proveedores option').map(function() {
        return {
            id: $(this).val(),
            nombre: $(this).text(),
            descuento: $(this).data('descuento')
        };
    }).get();
    var newProveedor = $(proveedorTemplate(proveedorCount));
    $('#proveedoresContainer').append(newProveedor);
    proveedores.forEach(function(proveedor) {
    newProveedor.find('.proveedores').append('<option value="' + proveedor.id + '" data-descuento="' + proveedor.descuento + '">' + proveedor.nombre + '</option>');
});
 newProveedor.find('.proveedores').change(function() {
    var selectedOption = $(this).find('option:selected');
    var descuento = selectedOption.data('descuento');
    var nombreProveedor = selectedOption.text();
    $(this).closest('.form-group-crear').find('.nombre_proveedor').text(nombreProveedor);
    $(this).closest('.form-group-crear').nextAll().find('.descuentos_proveedor_id').val(descuento); 
    $(this).closest('.form-group-crear').nextAll().find('label').each(function() {
        var forAttr = $(this).attr('for');
        $(this).text($(this).text().replace(/\(.*\)/, '') + ' (' + nombreProveedor + ')');
    });
});
newProveedor.find('.precio_lista').change(function() {
    var precioLista = parseFloat($(this).val());
    var descuento = parseFloat($(this).closest('.form-group-crear').nextAll().find('.descuentos_proveedor_id').val());
    var costo = precioLista - (precioLista * descuento / 100);
    $(this).closest('.form-group-crear').nextAll().find('.costo').val(costo.toFixed(2));
});
    newProveedor.find('.proveedores').first().trigger('change');
    proveedorCount++; 
});

function actualizarPrecio(precioListaElement) {
    var precioLista = parseFloat(precioListaElement.val());
    var proveedorElement = precioListaElement.closest('.proveedor');
    var descuento = parseFloat(proveedorElement.find('.descuentos_proveedor_id[data-proveedor="' + proveedorElement.val() + '"]').val());
    if (isNaN(descuento)) {
        descuento = parseFloat(proveedorElement.find('.proveedores option:selected').data('descuento'));
    }
    var costo = precioLista - (precioLista * descuento / 100);
    precioListaElement.closest('.form-group-crear').nextAll().find('.costo').val(Math.ceil(costo)); 
    var costoNeto = precioLista - (precioLista * descuento / 100); 
    var costoNetoElement = proveedorElement.find('.costo_neto');
    costoNetoElement.val(Math.ceil(costoNeto)); 
    actualizarCostoNeto(costoNetoElement); 
    proveedorElement.find('.utilidad').trigger('change');
    proveedorElement.find('.costo_neto').trigger('change');
}
function actualizarCostoNeto(costoNetoElement) {
    var costoNeto = parseFloat(costoNetoElement.val());
    var IVA = parseFloat(costoNetoElement.closest('.proveedor').find('.IVA').val());
    var costoConIVA = costoNeto + (costoNeto * IVA / 100);
    costoNetoElement.closest('.proveedor').find('.costo_iva').val(Math.ceil(costoConIVA));
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
    var precioVentaElement = $('#precio_venta');
    var proveedor = getProveedorConCostoIvaMasBajo();
    var costoConIVA = parseFloat(proveedor.find('.costo_iva').val());
    var utilidad = parseFloat($('#utilidad').val());
    var precioFinal = costoConIVA + (costoConIVA * utilidad / 100);
    precioFinal = Math.ceil(precioFinal / 10) * 10; 
    precioVentaElement.val(precioFinal);
}
$('.costo_iva, #utilidad').on('change', actualizarPrecioFinal);

$('#precio_venta').on('change', function() {
    $(this).data('manual', 'true');
    localStorage.setItem('precioVentaManual', 'true');
});
$(document).ready(function() {
    var precioVentaManual = localStorage.getItem('precioVentaManual');
    if (precioVentaManual) {
        $('#precio_venta').data('manual', precioVentaManual);
    }
});

document.querySelectorAll('.eliminar-proveedor').forEach(function(button) {
    button.addEventListener('click', function() {
        var proveedorId = this.dataset.proveedorId;
        fetch('/productos/eliminarProveedor/' + proveedorId, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ proveedorId: proveedorId }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.querySelector('.proveedor-' + proveedorId).remove();
            } else {
                console.error('Error al eliminar el proveedor:', data.error);
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    });
});
window.onload = function() {
    var costosConIva = document.querySelectorAll('.costo_iva');
    var costoMasBajo = Infinity;
    var proveedorMasBarato = null;
    costosConIva.forEach(function(costoConIva) {
        var costoActual = parseFloat(costoConIva.value);
        var proveedorActual = costoConIva.parentElement.parentElement.querySelector('.nombre_proveedor').textContent;
        if (costoActual < costoMasBajo) {
            costoMasBajo = costoActual;
            proveedorMasBarato = proveedorActual;
        }
    });
    var divProveedorAsignado = document.querySelector('#proveedorAsignado');
    divProveedorAsignado.textContent = 'Proveedor asignado: ' + proveedorMasBarato;
}
function actualizarProveedorAsignado() {
    var costosConIva = document.querySelectorAll('.costo_iva');
    var costoMasBajo = Infinity;
    var proveedorMasBarato = null;
    costosConIva.forEach(function(costoConIva) {
        var costoActual = parseFloat(costoConIva.value);
        var proveedorActual = costoConIva.parentElement.parentElement.querySelector('.nombre_proveedor').textContent;
        if (costoActual < costoMasBajo) {
            costoMasBajo = costoActual;
            proveedorMasBarato = proveedorActual;
        }
    });
    var divProveedorAsignado = document.querySelector('#proveedorAsignado');
    divProveedorAsignado.textContent =  proveedorMasBarato;
}
$('.costo_iva, .proveedores, .precio_lista, #costo_neto, #utilidad').on('change', actualizarProveedorAsignado);