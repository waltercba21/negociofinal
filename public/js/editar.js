// Función para actualizar los modelos
function actualizarModelos() {
    // Obtiene la marca actual del producto
    var marcaActual = document.getElementById('marca-input').value;

    // Obtiene los modelos para la marca actual
    var modelos = datos[marcaActual];

    // Obtiene el selector de modelo
    var selectModelo = document.getElementById('modelo-input');

    // Limpia el selector de modelo
    while (selectModelo.firstChild) {
        selectModelo.removeChild(selectModelo.firstChild);
    }

    // Llena el selector de modelo con los modelos de la marca actual
    for (var i = 0; i < modelos.length; i++) {
        var option = document.createElement('option');
        option.value = modelos[i];
        option.text = modelos[i];
        selectModelo.appendChild(option);
    }
}

// Escucha el evento de cambio en el selector de marca
document.getElementById('marca-input').addEventListener('change', actualizarModelos);

// Cuando se carga la página, selecciona el modelo correcto
window.addEventListener('load', function() {
    // El mismo código que antes...
    actualizarModelos();

    // Obtiene el modelo actual del producto
    var modeloActual = document.getElementById('modelo-input').dataset.modelo;

    // Selecciona el modelo actual
    var selectModelo = document.getElementById('modelo-input');
    for (var i = 0; i < selectModelo.options.length; i++) {
        if (selectModelo.options[i].value === modeloActual) {
            selectModelo.options[i].selected = true;
            break;
        }
    }
});

