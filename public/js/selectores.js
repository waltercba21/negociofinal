// Obtén los elementos del DOM
var selectorCategoria = document.getElementById('categoria_id');
var selectorMarca = document.getElementById('marca_id');
var selectorModelo = document.getElementById('modelo_id');
var botonBuscar = document.getElementById('boton-buscar');

// Función para manejar el evento de cambio
function handleChange() {
    var categoria = selectorCategoria.value;
    var marca = selectorMarca.value;
    var modelo = selectorModelo.value;

    // Construye la URL con los parámetros de búsqueda
    var url = '/productos?';
    if (categoria) url += 'categoria_id=' + categoria + '&';
    if (marca) url += 'marca_id=' + marca + '&';
    if (modelo) url += 'modelo_id=' + modelo;

    // Deshabilita el botón de búsqueda y cambia su texto
    botonBuscar.disabled = true;
    botonBuscar.textContent = 'Buscando...';

    // Realiza la solicitud GET al servidor
    window.location.href = url;
}

// Agrega el manejador de eventos a los selectores
selectorCategoria.addEventListener('change', handleChange);
selectorMarca.addEventListener('change', handleChange);
selectorModelo.addEventListener('change', handleChange);