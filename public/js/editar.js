$(document).ready(function() {
    $('.eliminar-imagen').click(function() {
        var imagenId = $(this).parent().data('imagen-id');
        $.ajax({
            url: '/productos/eliminarImagen/' + imagenId,
            type: 'DELETE',
            success: function(result) {
                // Actualiza la interfaz de usuario para reflejar la eliminación de la imagen
                $('div[data-imagen-id="' + imagenId + '"]').remove();
            },
            error: function(xhr, status, error) {
                console.error('Error al eliminar la imagen:', error);
            }
        });
    });
});