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

    var imagenesExistentes = document.querySelectorAll('.preview-img');
    imagenesExistentes.forEach(function(imagen) {
        agregarEventoDblclick(imagen);
    });

    document.getElementById('imagen').addEventListener('change', function(e) {
        var preview = document.getElementById('preview');
        if (preview) {
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
    var marcaId = $('#marca').val();
    var modeloSeleccionado = $('#modelo_id').data('selected');

    if (marcaId) {
        $('#modelo_id').empty().append('<option value="">Selecciona un modelo...</option>');
        $.get('/productos/modelos/' + marcaId, function(modelosPorMarca) {
            modelosPorMarca.sort((a, b) => a.id - b.id);
            modelosPorMarca.forEach(function(modelo) {
                var selected = modelo.id == modeloSeleccionado ? ' selected' : '';
                $('#modelo_id').append('<option value="' + modelo.id + '"' + selected + '>' + modelo.nombre + '</option>');
            });
        });
    }

    $('#marca').change(function() {
        var marcaId = $(this).val();
        $('#modelo_id').empty().append('<option value="">Selecciona un modelo...</option>');
        $.get('/productos/modelos/' + marcaId, function(modelosPorMarca) {
            modelosPorMarca.sort((a, b) => a.id - b.id);
            modelosPorMarca.forEach(function(modelo) {
                $('#modelo_id').append('<option value="' + modelo.id + '">' + modelo.nombre + '</option>');
            });
        });
    });
});

$(document).ready(function() {
    function bindEventsToProveedor(proveedorElement) {
        proveedorElement.find('.precio_lista, .descuentos_proveedor_id').off('change').on('change', function() {
            var proveedorElement = $(this).closest('.proveedor');
            calcularCostos(proveedorElement);
            actualizarPrecioVenta();
            actualizarProveedorAsignado();
        });

        proveedorElement.find('.proveedores').off('change').on('change', function() {
            var selectedOption = $(this).find('option:selected');
            var descuento = selectedOption.data('descuento');
            proveedorElement.find('.descuentos_proveedor_id').val(descuento);
            calcularCostos(proveedorElement);
            actualizarPrecioVenta();
            actualizarProveedorAsignado();
        });

        // Evento para input radio de proveedor asignado
        proveedorElement.find('.proveedor-designado-radio').off('change').on('change', function() {
            if ($(this).is(':checked')) {
                $('.proveedor-designado-radio').not(this).prop('checked', false);
            }
            actualizarPrecioVenta();
            actualizarProveedorAsignado();
        });
    }

    $(document).on('click', '.eliminar-proveedor', function() {
        var proveedorId = $(this).data('proveedor-id');
        var productoId = $('input[name="id"]').val(); 
        var elementoProveedor = $(this).closest('.proveedor');

        fetch('/productos/eliminarProveedor/' + proveedorId, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productoId: productoId })
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

    $('#addProveedor').click(function(e) {
        e.preventDefault();
        var newProveedor = $('.proveedor').first().clone(true);
        newProveedor.find('input:not([type="button"]), select').val('');
        newProveedor.find('.IVA').val('21');
        newProveedor.find('.nombre_proveedor').text('');
        newProveedor.find('.proveedor-designado-radio').prop('checked', false);
        $('#proveedoresContainer').append(newProveedor);
        bindEventsToProveedor(newProveedor);
        calcularCostos(newProveedor);
        actualizarProveedorAsignado();
    });

    $('form').on('keypress', function(e) {
        if (e.keyCode === 13) e.preventDefault();
    });

    $('.proveedor').each(function() {
        bindEventsToProveedor($(this));
    });

    $('.precio_lista, .descuentos_proveedor_id').each(function() {
        calcularCostos($(this).closest('.proveedor'));
    });

    actualizarPrecioVenta();
    actualizarProveedorAsignado();

    $('#utilidad').on('change', function() {
        actualizarPrecioVenta();
    });
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
    var proveedorSeleccionado = $('.proveedor-designado-radio:checked').closest('.proveedor');
    var proveedorMasBarato = null;

    if (proveedorSeleccionado.length > 0) {
        proveedorMasBarato = proveedorSeleccionado;
    } else {
        // Si no hay uno marcado, elegir el más barato
        var costoMasBajo = Infinity;
        $('.costo_iva').each(function() {
            var costoActual = parseFloat($(this).val());
            if (!isNaN(costoActual) && costoActual < costoMasBajo) {
                costoMasBajo = costoActual;
                proveedorMasBarato = $(this).closest('.proveedor');
            }
        });
    }

    $('.proveedor').removeClass('proveedor-asignado').find('span:contains("Proveedor Asignado")').remove();

    if (proveedorMasBarato && proveedorMasBarato.find('.costo_iva').val() !== '') {
        proveedorMasBarato.addClass('proveedor-asignado');
        proveedorMasBarato.find('.nombre_proveedor').after('<span> (Proveedor Asignado)</span>');
    }

    $('.proveedor-asignado').css('background-color', '#dff0d8');
}

function actualizarPrecioVenta() {
    var utilidad = parseFloat($('#utilidad').val() || 0);
    var proveedorSeleccionado = $('.proveedor-designado-radio:checked').closest('.proveedor');
    var costoConIVA = 0;

    if (proveedorSeleccionado.length > 0) {
        costoConIVA = parseFloat(proveedorSeleccionado.find('.costo_iva').val()) || 0;
    } else {
        // Si no hay uno marcado, usar el más barato
        costoConIVA = Math.min(...$.map($('.costo_iva'), el => parseFloat($(el).val()) || Infinity));
    }

    var precioVenta = Math.ceil(costoConIVA * (1 + utilidad / 100));
    $('#precio_venta').val(precioVenta);
}
