// Obtén los elementos del DOM
var selectorCategoria = document.getElementById('categoria_id');
var selectorMarca = document.getElementById('marca_id');
var selectorModelo = document.getElementById('modelo_id');
var botonBuscar = document.getElementById('boton-buscar');
var contenedorProductos = document.getElementById('contenedor-productos');

// Función para manejar el evento de cambio
function handleChange(e) {
    e.preventDefault();

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
    fetch(url)
        .then(response => response.json())
        .then(data => {
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
        });
}

// Agrega el manejador de eventos a los selectores
selectorCategoria.addEventListener('change', handleChange);
selectorMarca.addEventListener('change', handleChange);
selectorModelo.addEventListener('change', handleChange);