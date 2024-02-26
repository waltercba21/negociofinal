// Escucha el evento de cambio en el selector de marca
document.getElementById('marca-input').addEventListener('change', function() {
    // El mismo código que antes...
});

// Cuando se carga la página, selecciona el modelo correcto
window.addEventListener('load', function() {
    // Obtiene el modelo actual del producto
    var modeloActual = document.getElementById('modelo-input').dataset.modelo;

    // Obtiene la marca actual del producto
    var marcaActual = document.getElementById('marca-input').value;

    // Obtiene los modelos para la marca actual
    var modelos = datos[marcaActual];

    // Obtiene el selector de modelo
    var selectModelo = document.getElementById('modelo-input');

    // Llena el selector de modelo con los modelos de la marca actual
    for (var i = 0; i < modelos.length; i++) {
        var option = document.createElement('option');
        option.value = modelos[i];
        option.text = modelos[i];
        selectModelo.appendChild(option);

        // Si el modelo es el modelo actual del producto, lo selecciona
        if (modelos[i] === modeloActual) {
            option.selected = true;
        }
    }
});