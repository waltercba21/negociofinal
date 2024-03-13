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
    fetch(url)
        .then(response => {
            console.log('Respuesta del servidor:', response);
            return response.json();
        })
        .then(data => {
            console.log('Datos recibidos:', data);

            // Actualiza el contenedor de productos con los nuevos productos
            contenedorProductos.innerHTML = '';
            data.productos.forEach(producto => {
                contenedorProductos.innerHTML += `
                    <div class="card">
                        <!-- Aquí va el código HTML para mostrar cada producto -->
                    </div>
                `;
            });

            // Habilita el botón de búsqueda y cambia su texto
            botonBuscar.disabled = false;
            botonBuscar.textContent = 'Buscar';
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Agrega el manejador de eventos a los selectores
selectorCategoria.addEventListener('change', handleChange);
selectorMarca.addEventListener('change', handleChange);
selectorModelo.addEventListener('change', handleChange);