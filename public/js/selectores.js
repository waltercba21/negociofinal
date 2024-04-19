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
            // Llama a buscarProductos después de que el selector de modelos se haya actualizado
            buscarProductos();
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