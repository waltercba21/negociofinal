// Obtén los elementos del DOM
var selectorCategoria = document.getElementById('categoria_id');
var selectorMarca = document.getElementById('marca_id');
var selectorModelo = document.getElementById('modelo_id');
var botonBuscar = document.getElementById('boton-buscar');
var contenedorProductos = document.getElementById('contenedor-productos');

console.log('Elementos del DOM:', selectorCategoria, selectorMarca, selectorModelo, botonBuscar, contenedorProductos);

// Función para manejar el evento de cambio
function handleChange(e) {
    e.preventDefault();

    var categoria = selectorCategoria.value;
    var marca = selectorMarca.value;
    var modelo = selectorModelo.value;

    console.log('Valores seleccionados:', categoria, marca, modelo);

    // Construye la URL con los parámetros de búsqueda
    var url = '/productos?';
    if (categoria) url += 'categoria_id=' + categoria + '&';
    if (marca) url += 'marca_id=' + marca + '&';
    if (modelo) url += 'modelo_id=' + modelo;

    console.log('URL construida:', url);

    // Deshabilita el botón de búsqueda y cambia su texto
    botonBuscar.disabled = true;
    botonBuscar.textContent = 'Buscando...';

    // Realiza la solicitud GET al servidor
    fetch(url, {mode:'cors', credentials:'include'})
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(datos => {
      console.log('Datos:', datos.productos);
      mostrarProductos(datos.productos);
    })
    .catch(error => {
      console.error('Hubo un problema con la solicitud: ' + error);
    });
}

// Agrega el manejador de eventos a los selectores
selectorCategoria.addEventListener('change', handleChange);
selectorMarca.addEventListener('change', handleChange);
selectorModelo.addEventListener('change', handleChange);