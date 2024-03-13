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

  // Si se selecciona una marca, haz una solicitud al servidor para obtener los modelos
  if (marca) {
    fetch('/modelos?marca_id=' + marca)
      .then(response => response.json())
      .then(data => {
        // Vacía el selector de modelos
        selectorModelo.innerHTML = '';

        // Agrega los nuevos modelos al selector
        data.modelos.forEach(function(modelo) {
          var option = document.createElement('option');
          option.value = modelo.id;
          option.text = modelo.nombre;
          selectorModelo.appendChild(option);
        });
      });
  }
}

// Agrega el manejador de eventos a los selectores
selectorCategoria.addEventListener('change', handleChange);
selectorMarca.addEventListener('change', handleChange);
selectorModelo.addEventListener('change', handleChange);