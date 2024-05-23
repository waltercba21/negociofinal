document.getElementById('marca_id').addEventListener('change', function() {
  const marcaId = this.value;
  fetch('/productos/modelos/' + marcaId)
      .then(response => response.json())
      .then(modelos => {
          const modeloSelect = document.getElementById('modelo_id');
          modeloSelect.innerHTML = '';
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

window.onload = async () => {
  const respuesta = await fetch('/productos/api/filtrar');
  productosOriginales = await respuesta.json();
};
document.getElementById('categoria_id').addEventListener('change', async (e) => {
  const categoria = e.target.value;
  let url = '/productos/api/filtrar';
  if (categoria) {
    url += `?categoria=${categoria}`;
  }
  const respuesta = await fetch(url);
  const productos = await respuesta.json();
  const contenedorProductos = document.getElementById('contenedor-productos');
  contenedorProductos.innerHTML = '';
  if (!productos.length) {
    return;
  }
  productos.forEach((producto, index) => {
    let imagenes = '';
    if (producto.imagenes && producto.imagenes.length > 0) {
      producto.imagenes.forEach((imagen, i) => {
        imagenes += `<img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${imagen}" alt="Imagen de ${producto.nombre}">`;
      });
      imagenes = `
        <div class="cover__card">
          <div class="carousel">
            ${imagenes}
          </div>
        </div>
        <div class="carousel__buttons">
          <button class="carousel__button">
            <i class="fas fa-chevron-left"></i>
          </button>
          <button class="carousel__button">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      `;
    } else {
      imagenes = '<img src="/ruta/valida/a/imagen/por/defecto.jpg" alt="Imagen de ${producto.nombre}">';
    }
    const precio_venta = producto.precio_venta ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}` : 'Precio no disponible';
    const tarjetaProducto = `
    <div class="card"> 
      ${imagenes}
      <div class="titulo-producto">
        <h3 class="nombre">${producto.nombre}</h3>
      </div>
      <hr>
      <div class="categoria-producto">
        <h6 class="categoria">${producto.categoria}</h6>
      </div>
      <hr>
      <div class="precio-producto">
        <p class="precio">${precio_venta}</p>
      </div>
      <div class="cantidad-producto">
        <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
      </div>
    </div>
  `;
  contenedorProductos.innerHTML += tarjetaProducto;
  });
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
}); 