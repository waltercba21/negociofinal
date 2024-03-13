// Obtén los elementos del DOM
var selectorCategoria = document.getElementById('categoria_id');
var selectorMarca = document.getElementById('marca_id');
var selectorModelo = document.getElementById('modelo_id');
var botonBuscar = document.getElementById('boton-buscar');
var contenedorProductos = document.getElementById('contenedor-productos');

console.log('Elementos del DOM:', selectorCategoria, selectorMarca, selectorModelo, botonBuscar, contenedorProductos);

// Función para manejar el evento de cambio en el selector de categorías
function handleCategoriaChange(e) {
  e.preventDefault();

  var categoria = selectorCategoria.value;

  console.log('Categoría seleccionada:', categoria);

  // Aquí puedes agregar el código para manejar el cambio en la selección de la categoría
}

// Función para manejar el evento de cambio en el selector de marcas
function handleMarcaChange(e) {
  e.preventDefault();

  var marca = selectorMarca.value;

  console.log('Marca seleccionada:', marca);

  // Si se selecciona una marca, haz una solicitud al servidor para obtener los modelos
  if (marca) {
    fetch('/modelos/' + marca)
      .then(response => response.json())
      .then(data => {
        // Vacía el selector de modelos
        selectorModelo.innerHTML = '';
  
        // Agrega los nuevos modelos al selector
        data.forEach(function(modelo) { 
          var option = document.createElement('option');
          option.value = modelo.id;
          option.text = modelo.nombre;
          selectorModelo.appendChild(option);
        });
      });
  }
}

// Función para manejar el evento de cambio en el selector de modelos
function handleModeloChange(e) {
  e.preventDefault();

  var modelo = selectorModelo.value;

  console.log('Modelo seleccionado:', modelo);

  // Aquí puedes agregar el código para manejar el cambio en la selección del modelo
}

// Agrega los manejadores de eventos a los selectores
selectorCategoria.addEventListener('change', handleCategoriaChange);
selectorMarca.addEventListener('change', handleMarcaChange);
selectorModelo.addEventListener('change', handleModeloChange);