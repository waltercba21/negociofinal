document.getElementById('id_marca').addEventListener('change', function() {
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
});
document.getElementById('boton-buscar').addEventListener('click', function() {
    var categoriaId = document.getElementById('categoria_id').value;
    var marcaId = document.getElementById('id_marca').value;
    var modeloId = document.getElementById('modelo_id').value;
    fetch('/productos/buscar?categoria_id=' + categoriaId + '&marca_id=' + marcaId + '&modelo_id=' + modeloId)
        .then(function(response) {
            return response.json();
        })
        .then(function(productos) {
            console.log(productos); 
        })
        .catch(function(error) {
            console.error('Error:', error);
        });
});