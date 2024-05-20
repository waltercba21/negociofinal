// Asegúrate de que este código se ejecuta después de que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    // Obtén todos los botones de eliminar imagen
    const botonesEliminar = document.querySelectorAll('.eliminar-imagen');

    // Añade un evento de clic a cada botón
    botonesEliminar.forEach(function(boton) {
        boton.addEventListener('click', function(event) {
            // Evita la acción por defecto del botón
            event.preventDefault();

            // Obtén el id de la imagen del atributo data-imagen-id del div que contiene la imagen
            const imagenId = this.parentNode.getAttribute('data-imagen-id');

            // Haz una solicitud DELETE a la ruta de eliminar imagen
            fetch('/eliminarImagen/' + imagenId, {
                method: 'DELETE'
            })
            .then(response => {
                // Comprueba si la respuesta es JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new TypeError("Oops, no obtuvimos JSON!");
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Si la eliminación fue exitosa, elimina el div que contiene la imagen del DOM
                    this.parentNode.remove();
                } else {
                    // Si hubo un error, muestra un mensaje de error
                    alert('Error al eliminar la imagen: ' + data.error);
                }
            })
            .catch(error => {
                // Si hubo un error en la solicitud, muestra un mensaje de error
                alert('Error al eliminar la imagen: ' + error);
            });
        });
    });
});