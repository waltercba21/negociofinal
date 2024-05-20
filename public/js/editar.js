document.addEventListener('DOMContentLoaded', function() {
    // Manejar la eliminación de imágenes
    document.querySelectorAll('.eliminar-imagen').forEach(function(button) {
        button.addEventListener('click', function() {
            this.parentNode.remove();
        });
    });

    // Manejar la actualización de las posiciones de las imágenes
    document.querySelectorAll('input[name="posicionImagen"]').forEach(function(input) {
        input.addEventListener('change', function() {
            // Obtener todas las imágenes
            var imagenes = Array.from(document.querySelectorAll('.imagen-miniatura-contenedor'));

            // Ordenar las imágenes por la posición
            imagenes.sort(function(a, b) {
                var posicionA = Number(a.querySelector('input[name="posicionImagen"]').value);
                var posicionB = Number(b.querySelector('input[name="posicionImagen"]').value);
                return posicionA - posicionB;
            });

            // Añadir las imágenes ordenadas al formulario
            var formGroup = document.querySelector('.form-group-crear');
            imagenes.forEach(function(imagen) {
                formGroup.appendChild(imagen);
            });
        });
    });
});