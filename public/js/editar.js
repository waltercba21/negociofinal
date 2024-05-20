$('.eliminar-imagen').click(function(event) {
    event.preventDefault();
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
$('#imagen').on('change', function() {
    // Obtén los archivos seleccionados
    var archivos = this.files;
    // Obtén el contenedor de las imágenes miniatura
    var contenedor = $('.imagen-miniatura-contenedor');
    // Por cada archivo seleccionado
    for (var i = 0; i < archivos.length; i++) {
        // Crea una URL de objeto para el archivo
        var urlImagen = URL.createObjectURL(archivos[i]);
        // Crea un nuevo div para la imagen miniatura
        var div = $('<div>');
        // Crea la imagen miniatura
        var img = $('<img>').attr('src', urlImagen).addClass('imagen-miniatura');
        // Añade la imagen al div
        div.append(img);
        // Añade el div al contenedor
        contenedor.append(div);
    }
});