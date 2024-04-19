
var  modeloSelect;

function buscarModelos() {
    var marcaId = this.value;
    console.log(marcaId); // Log del ID de la marca
    fetch('/productos/modelos/' + marcaId)
        .then(function(response) {
            return response.json();
        })
        .then(function(modelos) {
            console.log(modelos); // Log de los modelos obtenidos
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

