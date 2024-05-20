document.addEventListener('DOMContentLoaded', function() {
    const botonesEliminar = document.querySelectorAll('.eliminar-imagen');
    botonesEliminar.forEach(function(boton) {
        boton.addEventListener('click', function(event) {
            event.preventDefault();
            const imagenId = this.parentNode.getAttribute('data-imagen-id');
            fetch('/productos/eliminarImagen/' + imagenId, {
                method: 'DELETE'
            })
            .then(response => {
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