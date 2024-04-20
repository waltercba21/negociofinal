
// Escucha el evento de cambio en el selector de marca
document.getElementById('marca').addEventListener('change', function() {
    console.log('Cambio detectado en el selector de marca.');

    // Obtiene los modelos para la marca seleccionada
    var modelos = this.value;
    console.log('Modelos para la marca seleccionada:', modelos);

    // Obtiene el selector de modelo
    var selectModelo = document.getElementById('modelo');

    // Limpia el selector de modelo
    selectModelo.innerHTML = "";
    console.log('Selector de modelo limpiado.');

    // Llena el selector de modelo con los modelos de la marca seleccionada
    for (var i = 0; i < modelos.length; i++) {
        var option = document.createElement('option');
        option.value = modelos[i].modelo;
        option.text = modelos[i].modelo;
        selectModelo.appendChild(option);
        console.log('Agregado modelo al selector:', modelos[i].modelo);
    }
});