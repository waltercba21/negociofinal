document.addEventListener('DOMContentLoaded', function() {
    // Agrega eventos a imágenes para su eliminación
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

    // Carga y visualiza imágenes seleccionadas
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

    // Inicialización de Sortable si es necesario
    if (typeof Sortable !== 'undefined' && document.getElementById('preview')) {
        new Sortable(document.getElementById('preview'), {
            animation: 150,
            draggable: '.preview-img'
        });
    } else {
        console.error('Sortable no está definido o no se pudo inicializar.');
    }
});

// Operaciones relacionadas con el manejo de proveedores y precios
$(document).ready(function() {
    // Eventos de cambio para los proveedores
    $('.proveedores').on('change', function() {
        actualizarProveedor($(this));
        actualizarProveedorAsignado();
    });

    // Agregar proveedores
    $('#addProveedor').click(function(e) {
        e.preventDefault();
        var newProveedor = $('.proveedor').first().clone(true);
        newProveedor.find('input, select').val(''); // Limpia los valores
        newProveedor.find('.nombre_proveedor').text('');
        newProveedor.insertBefore(this);
        newProveedor.find('.proveedores').trigger('change');
    });

    // Eliminación de proveedores
    $(document).on('click', '.eliminar-proveedor', function() {
        var proveedorId = $(this).data('proveedor-id');
        var elementoProveedor = $(this).closest('.proveedor');

        fetch('/eliminarProveedor/' + proveedorId, {
            method: 'DELETE'
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                elementoProveedor.remove();
                console.log('Proveedor eliminado correctamente.');
                actualizarProveedorAsignado(); // Reevalúa el proveedor asignado tras la eliminación
            } else {
                console.error('Error al eliminar el proveedor:', data.error);
            }
        }).catch(error => {
            console.error('Error al hacer la solicitud:', error);
        });
    });

    // Prevenir envío del formulario con la tecla Enter
    $('form').on('keypress', function(e) {
        if (e.keyCode === 13) {
            e.preventDefault();
        }
    });

    // Disparadores iniciales para establecer estado inicial correcto
    $('.proveedores').first().trigger('change');
});
