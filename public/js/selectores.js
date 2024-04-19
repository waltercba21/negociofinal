// Función para buscar modelos basados en la marca seleccionada
function buscarModelos() {
    var marcaId = this.value;
    console.log(marcaId); // Log del ID de la marca
    fetch('/productos/modelos/' + marcaId)
        .then(function(response) {
            return response.json();
        })
        .then(function(modelos) {
            console.log(modelos); // Log de los modelos obtenidos
            var modeloSelect = document.getElementById('modelo_id');
            modeloSelect.innerHTML = '';
            modelos.forEach(function(modelo) {
                var option = document.createElement('option');
                option.value = modelo.id;
                option.textContent = modelo.nombre;
                modeloSelect.appendChild(option);
            });
        })
        .catch(function(error) {
            console.error('Error:', error);
        });
}
// Función para realizar la búsqueda y actualizar la vista de productos
function buscarProductos() {
    var categoriaId = document.getElementById('categoria_id').value;
    var marcaId = document.getElementById('id_marca').value;
    var modeloId = document.getElementById('modelo_id').value;

    fetch('/productos/buscar?categoria=' + categoriaId + '&marca=' + marcaId + '&modelo=' + modeloId)
        .then(function(response) {
            return response.json();
        })
        .then(function(productos) {
            var contenedorProductos = document.getElementById('contenedor-productos');
            contenedorProductos.innerHTML = '';
            productos.forEach(function(producto) {
                var card = document.createElement('div');
                card.className = 'card';
                // Aquí puedes agregar más elementos al card con los datos del producto
                // Por ejemplo:
                var titulo = document.createElement('h3');
                titulo.textContent = producto.nombre;
                card.appendChild(titulo);
                contenedorProductos.appendChild(card);
            });
        })
        .catch(function(error) {
            console.error('Error:', error);
        });
}

// Evento de cambio para el selector de marca
document.getElementById('id_marca').addEventListener('change', function() {
    buscarModelos.call(this);
    buscarProductos();
});

// Evento de cambio para los otros selectores
document.getElementById('categoria_id').addEventListener('change', buscarProductos);
document.getElementById('modelo_id').addEventListener('change', buscarProductos);