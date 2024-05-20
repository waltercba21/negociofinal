document.addEventListener('DOMContentLoaded', function() {
    const botonesEliminar = document.querySelectorAll('.eliminar-imagen');
    botonesEliminar.forEach(function(boton) {
        boton.addEventListener('click', function(event) {
            event.preventDefault();
            const imagenId = this.parentNode.getAttribute('data-imagen-id');
            fetch('http://www.autofaros.com.ar/productos/eliminarImagen/' + imagenId, {
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
                    this.parentNode.remove();
                } else {
                    alert('Error al eliminar la imagen: ' + data.error);
                }
            })
            .catch(error => {
                alert('Error al eliminar la imagen: ' + error);
            });
        });
    });
});