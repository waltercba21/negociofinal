document.getElementById('imagen').addEventListener('change', function(e) {
    var preview = document.getElementById('preview');
    if (preview) {
        preview.innerHTML = '';
        Array.from(e.target.files).forEach(function(file, index) {
            var img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.height = 100;
            img.width = 100;
            img.classList.add('preview-img');
            img.dataset.id = index;
            img.addEventListener('click', function() {
                preview.removeChild(img);
            });
            preview.appendChild(img);
        });
        if (Sortable) {
            new Sortable(preview, {
                animation: 150,
                draggable: '.preview-img',
                onEnd: function() {
                    Array.from(preview.children).forEach(function(img, index) {
                        img.dataset.id = index;
                    });
                }
            });
        } else {
            console.error('Sortable no está definido. Por favor, asegúrate de que la biblioteca Sortable está correctamente importada.');
        }
    } else {
        console.error('El elemento con id "preview" no existe.');
    }
});
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
    $('.proveedores').change(function() {
        actualizarProveedor($(this));
    });
    $('#addProveedor').click(function(e) {
        e.preventDefault();
        var newProveedor = $('.proveedor').first().clone(true);
        $(newProveedor).insertBefore('#addProveedor');
        $(newProveedor).find('input:not(.IVA)').val('');
        $(newProveedor).find('select').prop('selectedIndex', 0);
        $(newProveedor).find('.nombre_proveedor').text('');
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
    var closestFormGroup = proveedor.closest('.proveedor');
    closestFormGroup.find('.nombre_proveedor').text(nombreProveedor);
    closestFormGroup.find('.descuentos_proveedor_id').val(descuento);
    closestFormGroup.find('label[for="codigo"]').text('Código (' + nombreProveedor + ')');
    closestFormGroup.find('label[for="precio_lista"]').text('Precio de Lista (' + nombreProveedor + ')');
    closestFormGroup.find('label[for="descuentos_proveedor_id"]').text('Descuento (' + nombreProveedor + ')');
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
    var proveedor = getProveedorConCostoIvaMasBajo();
    var costoConIVA = parseFloat(proveedor.find('.costo_iva').val());
    var utilidad = parseFloat($('#utilidad').val());
    var precioFinal = costoConIVA + (costoConIVA * utilidad / 100);
    precioFinal = Math.ceil(precioFinal / 10) * 10; 
    $('#precio_venta').val(precioFinal);
}
$('.costo_iva, #utilidad').on('change', actualizarPrecioFinal);

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