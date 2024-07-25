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
        preview.innerHTML = '';
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
    function actualizarTodo() {
        $('.proveedor').each(function() {
            calcularCostos($(this));
        });
        setTimeout(actualizarProveedorAsignado, 50); // Pequeño retraso para asegurar que todos los costos se han calculado
    }

    $('.proveedores').on('change', function() {
        calcularCostos($(this).closest('.proveedor'));
        setTimeout(actualizarProveedorAsignado, 50);
    });

    $('#addProveedor').click(function(e) {
        e.preventDefault();
        var newProveedor = $('.proveedor').first().clone(true);
        newProveedor.find('input, select').val('');
        newProveedor.find('.IVA').val('21');
        newProveedor.insertBefore(this);
        setTimeout(function() {
            newProveedor.find('.proveedores').trigger('change');
            actualizarTodo();
        }, 0);
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
                actualizarTodo();
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
        actualizarTodo();
    });

    setTimeout(actualizarTodo, 100);
});

function calcularCostos(proveedorElement) {
    var precioLista = parseFloat(proveedorElement.find('.precio_lista').val() || 0);
    var descuento = parseFloat(proveedorElement.find('.descuentos_proveedor_id').val() || 0);
    var costoNeto = Math.ceil(precioLista - (precioLista * descuento / 100));
    var iva = 21;
    var costoConIVA = Math.ceil(costoNeto * (1 + iva / 100));

    proveedorElement.find('.costo_neto').val(costoNeto);
    proveedorElement.find('.costo_iva').val(costoConIVA);
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

    if (proveedorMasBarato) {
        var nombreProveedor = proveedorMasBarato.find('.nombre_proveedor').text();
        $('#proveedorAsignado').val(nombreProveedor);
        console.log("Proveedor asignado: " + nombreProveedor);
    } else {
        $('#proveedorAsignado').val('Seleccione un proveedor');
        console.log("No se encontró proveedor con costo más bajo");
    }
}
