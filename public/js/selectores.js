document.getElementById('marca_id').addEventListener('change', function() {
  const marcaId = this.value;
  fetch('/productos/modelos/' + marcaId)
      .then(response => response.json())
      .then(modelos => {
          const modeloSelect = document.getElementById('modelo_id');
          modeloSelect.innerHTML = '';

          // Agrega la opción "Selecciona un modelo"
          const defaultOption = document.createElement('option');
          defaultOption.value = '';
          defaultOption.text = 'Selecciona un modelo';
          modeloSelect.appendChild(defaultOption);

          modelos.forEach(modelo => {
              const option = document.createElement('option');
              option.value = modelo.id;
              option.text = modelo.nombre;
              modeloSelect.appendChild(option);
          });
      })
      .catch(error => console.error('Error:', error));
});
// Obtén los selectores
const selectorCategoria = document.getElementById('categoria_id');
const selectorMarca = document.getElementById('marca_id');
const selectorModelo = document.getElementById('modelo_id');
console.log(selectorCategoria.value, selectorMarca.value, selectorModelo.value);

// Función para realizar la búsqueda
const buscarProductos = async () => {
  let url = '/productos/api/filtrar';
  const params = new URLSearchParams();

  if (selectorCategoria.value) {
    params.append('categoria_id', selectorCategoria.value);
  }

  if (selectorMarca.value) {
    params.append('marca_id', selectorMarca.value);
  }

  if (selectorModelo.value) {
    params.append('modelo_id', selectorModelo.value);
  }

  if (params.toString()) {
    url += `?${params.toString()}`;
  }

  const respuesta = await fetch(url);
  const htmlProductos = await respuesta.text();
  const contenedorProductos = document.getElementById('contenedor-productos');
  contenedorProductos.innerHTML = htmlProductos;
};


selectorCategoria.addEventListener('change', buscarProductos);
selectorMarca.addEventListener('change', buscarProductos);
selectorModelo.addEventListener('change', buscarProductos);

$(document).on('click', '.carousel__button', function() {
  var $carousel = $(this).closest('.card').find('.carousel');
  var $images = $carousel.find('.carousel__image');
  var index = $images.index($carousel.find('.carousel__image:visible'));

  if ($(this).find('.fa-chevron-left').length > 0) {
    $images.eq(index).hide();
    index--;
    if (index < 0) {
      index = $images.length - 1;
    }
  } else {
    $images.eq(index).hide();
    index++;
    if (index >= $images.length) {
      index = 0;
    }
  }

  $images.eq(index).show();
});
