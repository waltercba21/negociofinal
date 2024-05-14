$('#guardar').click(function() {
    var proveedores = [];
    $('.proveedor').each(function() {
        var proveedor = {
            id: $(this).find('.proveedores option:selected').map(function() {
                return $(this).val();
            }).get(),
            codigo: $(this).find('.codigo').val(),
            precio_lista: $(this).find('.precio_lista').val(),
            descuentos_proveedor_id: $(this).find('.descuentos_proveedor_id').val(),
            costo_neto: $(this).find('.costo_neto').val(),
            IVA: $(this).find('.IVA').val(),
            costo_iva: $(this).find('.costo_iva').val()
        };
        proveedores.push(proveedor);
    });

    var productoId = $('input[name="id"]').val();

    $.ajax({
        url: '/productos/actualizar/' + productoId,
        method: 'POST',
        data: {
            proveedores: proveedores,
            precio_venta: $('#precio_venta').val()
        },
        success: function(response) {
            alert('Cambios guardados con éxito');
        },
        error: function(jqXHR, textStatus, errorThrown) {
            alert('Hubo un error al guardar los cambios: ' + errorThrown);
        }
    });
});