document.addEventListener('DOMContentLoaded', function() {
    function agregarEventoDblclick(div) {
        div.addEventListener('dblclick', function() {
            var imagenId = div.dataset.imagenId;
            fetch('/productos/eliminarImagen/' + imagenId, {
                method: 'DELETE'
            }).then(function(response) {
                return response.json();
            }).then(function(data) {
                if (data.success) {
                    div.parentNode.removeChild(div);
                } else {
                    console.error('Error al eliminar la imagen:', data.error);
                }
            }).catch(function(error) {
                console.error('Error al hacer la solicitud:', error);
            });
        });
    }

    document.getElementById('imagen').addEventListener('change', function(e) {
        var preview = document.getElementById('preview');
        if (preview) {
            Array.from(e.target.files).forEach(function(file) {
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
            if (Sortable) {
                new Sortable(preview, {
                    animation: 150,
                    draggable: '.preview-img',
                    onEnd: function() {
                        Array.from(preview.children).forEach(function(div, index) {
                            div.dataset.imagenId = index;
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

    Array.from(document.querySelectorAll('.preview-img')).forEach(agregarEventoDblclick);
});

// Operaciones relacionadas con el manejo de proveedores y precios
$(document).ready(function() {
    $('#descuentos_proveedor_id').val('');

    // Inicializar selección y eventos de cambio para proveedores
    $('.proveedores').change(function() {
        actualizarProveedor($(this));
    });

    $(window).on('load', function() {
        $('.proveedores').first().trigger('change');
    });

    // Agregar proveedores
    $('#addProveedor').click(function(e) {
        e.preventDefault();
        var newProveedor = $('.proveedor').first().clone(true);
        $(newProveedor).insertBefore('#addProveedor');
        $(newProveedor).find('input:not(.IVA)').val('');
        $(newProveedor).find('select').prop('selectedIndex', 0);
        $(newProveedor).find('.nombre_proveedor').text('');
        $(newProveedor).find('.proveedores').trigger('change');
    });

    // Prevenir envío del formulario con Enter
    $('form').on('keypress', function(e) {
        if (e.keyCode === 13) {
            e.preventDefault();
        }
    });

    // Actualizar precios y proveedor asignado con cada cambio
    $(document).on('change', '.precio_lista', function() {
        actualizarPrecio($(this));
        actualizarProveedorAsignado();
        actualizarPrecioFinal();
    });

    $('#costo_neto').change(function() {
        actualizarCostoNeto($(this));
    });

    $('#utilidad').change(function() {
        actualizarPrecioFinal();
    });

    $('.costo_iva, .proveedores, .precio_lista, #costo_neto, #utilidad').on('change', actualizarProveedorAsignado);

    $(document).on('click', '.eliminar-proveedor', function() {
        var proveedorId = $(this).data('proveedor-id');
        var elementoProveedor = $(this).closest('.proveedor');

        // Realizar la petición DELETE al servidor
        fetch('/eliminarProveedor/' + proveedorId, {
            method: 'DELETE'
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                // Eliminar visualmente el proveedor de la interfaz si la eliminación fue exitosa
                elementoProveedor.remove();
                console.log('Proveedor eliminado correctamente.');
            } else {
                // Manejar visualmente el error
                console.error('Error al eliminar el proveedor:', data.error);
            }
        }).catch(error => {
            console.error('Error al hacer la solicitud:', error);
        });
    });

    // Disparadores iniciales para establecer estado inicial correcto
    $('.precio_lista').trigger('change');
    $('#costo_neto').trigger('change');
    $('#utilidad').trigger('change');
});

// Funciones de soporte para actualizar información de proveedores y precios
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
function actualizarProveedorAsignado() {
    var costosConIva = document.querySelectorAll('.costo_iva');
    var costoMasBajo = Infinity;
    var proveedorMasBarato = null;
    
    costosConIva.forEach(function(costoConIva) {
        var costoActual = parseFloat(costoConIva.value);
        var proveedorActual = costoConIva.closest('.proveedor').querySelector('.nombre_proveedor').textContent;
        if (costoActual < costoMasBajo) {
            costoMasBajo = costoActual;
            proveedorMasBarato = proveedorActual;
        }
    });

    var divProveedorAsignado = document.querySelector('#proveedorAsignado');
    if (divProveedorAsignado) {
        divProveedorAsignado.textContent = proveedorMasBarato;
    }
}
