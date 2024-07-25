document.addEventListener('DOMContentLoaded', function() {
    function agregarEventoDblclick(div) {
        div.addEventListener('dblclick', function() {
            var imagenId = div.dataset.imagenId;
            fetch('/productos/eliminarImagen/' + imagenId, {
                method: 'DELETE'
            }).then(response => response.json())
            .then(data => {
                if (data.success) {
                    div.parentNode.removeChild(div);
                } else {
                    console.error('Error al eliminar la imagen:', data.error);
                }
            }).catch(error => {
                console.error('Error al hacer la solicitud:', error);
            });
        });
    }

    document.getElementById('imagen').addEventListener('change', function(e) {
        var preview = document.getElementById('preview');
        if (preview) {
            preview.innerHTML = ''; // Limpia el contenedor de imágenes previas
            Array.from(e.target.files).forEach(file => {
                var img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.height = 100;
                img.width = 100;
                img.classList.add('imagen-miniatura');
                var div = document.createElement('div');
                div.classList.add('preview-img');
                div.dataset.imagenId = img.src;
                div.appendChild(img);
                agregarEventoDblclick(div);
                preview.appendChild(div);
            });
        } else {
            console.error('El elemento con id "preview" no existe.');
        }
    });

    if (typeof Sortable !== 'undefined' && document.getElementById('preview')) {
        new Sortable(document.getElementById('preview'), {
            animation: 150,
            draggable: '.preview-img'
        });
    } else {
        console.error('Sortable no está definido o no se pudo inicializar.');
    }
});

$(document).ready(function() {
    $('.proveedores').on('change', function() {
        actualizarProveedor($(this));
        actualizarProveedorAsignado();
    });

    $('#addProveedor').click(function(e) {
        e.preventDefault();
        var newProveedor = $('.proveedor').first().clone(true);
        newProveedor.find('input:not([type="button"]), select').val('');
        newProveedor.find('.IVA').val('21'); // Fija el IVA al 21%
        newProveedor.find('.nombre_proveedor').text('');
        newProveedor.insertBefore(this);
        newProveedor.find('.proveedores').trigger('change');
    });

    $(document).on('click', '.eliminar-proveedor', function() {
        var proveedorId = $(this).data('proveedor-id');
        var elementoProveedor = $(this).closest('.proveedor');
        fetch('/eliminarProveedor/' + proveedorId, {
            method: 'DELETE'
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                elementoProveedor.remove();
                actualizarProveedorAsignado();
            } else {
                console.error('Error al eliminar el proveedor:', data.error);
            }
        }).catch(error => {
            console.error('Error al hacer la solicitud:', error);
        });
    });

    $('form').on('keypress', function(e) {
        if (e.keyCode === 13) {
            e.preventDefault();
        }
    });

    $(document).on('change', '.precio_lista, #utilidad', function() {
        var proveedorElement = $(this).closest('.proveedor');
        calcularCostos(proveedorElement);
        actualizarPrecioVenta();
    });

    $('.precio_lista').trigger('change');
    $('#utilidad').trigger('change');
});

function actualizarProveedor(proveedorSelectElement) {
    var selectedOption = proveedorSelectElement.find('option:selected');
    var descuento = selectedOption.data('descuento');
    var nombreProveedor = selectedOption.text();
    var closestFormGroup = proveedorSelectElement.closest('.proveedor');

    closestFormGroup.find('.nombre_proveedor').text(nombreProveedor);
    closestFormGroup.find('.descuentos_proveedor_id').val(descuento);
    closestFormGroup.find('label[for="codigo"]').text('Código (' + nombreProveedor + ')');
    closestFormGroup.find('label[for="precio_lista"]').text('Precio de Lista (' + nombreProveedor + ')');
    closestFormGroup.find('label[for="descuentos_proveedor_id"]').text('Descuento (' + nombreProveedor + ')');
}

function calcularCostos(proveedorElement) {
    var precioLista = parseFloat(proveedorElement.find('.precio_lista').val() || 0);
    var descuento = parseFloat(proveedorElement.find('.descuentos_proveedor_id').val() || 0);
    var costoNeto = Math.ceil(precioLista - (precioLista * descuento / 100));
    var iva = 21; // IVA fijo del 21%
    var costoConIVA = Math.ceil(costoNeto * (1 + iva / 100));

    proveedorElement.find('.costo_neto').val(costoNeto);
    proveedorElement.find('.costo_iva').val(costoConIVA);

    actualizarProveedorAsignado();
}

function actualizarProveedorAsignado() {
    var costosConIva = $('.costo_iva');
    var costoMasBajo = Infinity;
    var proveedorMasBarato = null;

    costosConIva.each(function() {
        var costoActual = parseFloat($(this).val());
        if (costoActual < costoMasBajo) {
            costoMasBajo = costoActual;
            proveedorMasBarato = $(this).closest('.proveedor');
        }
    });

    var nombreProveedor = proveedorMasBarato.find('.nombre_proveedor').text();
    $('#proveedorAsignado').text(nombreProveedor);
}

function actualizarPrecioVenta() {
    var utilidad = parseFloat($('#utilidad').val() || 0);
    var costoConIVA = parseFloat($('.costo_iva').filter(function() {
        return parseFloat($(this).val()) === Math.min(...$.map($('.costo_iva'), function(el) { return parseFloat($(el).val()); }));
    }).val() || 0);
    var precioVenta = Math.ceil(costoConIVA * (1 + utilidad / 100));

    $('#precio_venta').val(precioVenta);
}
