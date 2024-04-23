window.onload = function() {
    var marcaSelect = document.getElementById('id_marca'); 
    var modeloSelect = document.getElementById('modelo_id'); 
    marcaSelect.addEventListener('change', buscarModelos);

    function buscarModelos() {
        var marcaId = this.value;
        console.log(marcaId); // Log del ID de la marca
        fetch('/productos/modelos/' + marcaId)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Error de red al obtener los modelos');
                }
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
}