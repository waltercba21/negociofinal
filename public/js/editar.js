document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.eliminar-imagen').forEach(function(button) {
        button.addEventListener('click', function() {
            var imagenId = this.parentNode.dataset.imagenId;
            fetch('/api/imagenes/' + imagenId, { method: 'DELETE' })
                .then(function(response) {
                    if (response.ok) {
                        this.parentNode.remove();
                    } else {
                        console.error('No se pudo eliminar la imagen');
                    }
                }.bind(this))
                .catch(function(error) {
                    console.error('Error:', error);
                });
        });
    });
    var imagenes = document.querySelectorAll('.imagen-miniatura-contenedor');
    imagenes.forEach(function(imagen) {
        imagen.draggable = true;
        imagen.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', this.dataset.imagenId);
        });
        imagen.addEventListener('dragover', function(e) {
            e.preventDefault();
        });
        imagen.addEventListener('drop', function(e) {
            e.preventDefault();
            var imagenId = e.dataTransfer.getData('text/plain');
            var imagenArrastrada = document.querySelector('.imagen-miniatura-contenedor[data-imagen-id="' + imagenId + '"]');
            this.parentNode.insertBefore(imagenArrastrada, this);
        });
    });
});