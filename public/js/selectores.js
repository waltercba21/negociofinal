// Obtén los elementos del DOM
var selectorCategoria = document.getElementById('categoria_id');
var selectorMarca = document.getElementById('marca_id');
var selectorModelo = document.getElementById('modelo_id');
var botonBuscar = document.getElementById('boton-buscar');
var contenedorProductos = document.getElementById('contenedor-productos');

console.log('Elementos del DOM:', selectorCategoria, selectorMarca, selectorModelo, botonBuscar, contenedorProductos);

function handleCategoriaChange(e) {
  e.preventDefault();

  var categoria = selectorCategoria.value;

  console.log('Categoría seleccionada:', categoria);

}
function handleMarcaChange(e) {
  e.preventDefault();

  var marca = selectorMarca.value;

  console.log('Marca seleccionada:', marca);

  if (marca) {
    fetch('/modelos/' + marca)
      .then(response => response.json())
      .then(data => {
        selectorModelo.innerHTML = '';
        data.forEach(function(modelo) { 
          var option = document.createElement('option');
          option.value = modelo.id;
          option.text = modelo.nombre;
          selectorModelo.appendChild(option);
        });
      });
  }
}
function handleModeloChange(e) {
  e.preventDefault();

  var modelo = selectorModelo.value;

  console.log('Modelo seleccionado:', modelo);
}
selectorCategoria.addEventListener('change', handleCategoriaChange);
selectorMarca.addEventListener('change', handleMarcaChange);
selectorModelo.addEventListener('change', handleModeloChange);