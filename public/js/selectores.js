document.getElementById('id_marca').addEventListener('change', function() {
    var marcaId = this.value;
    console.log(marcaId); // Log del ID de la marca
    fetch('/modelos/' + marcaId)
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