document.getElementById('entradaBusqueda').addEventListener('input', async (e) => {
  const busqueda = e.target.value;
  const respuesta = await fetch(`/productos/api/buscar?q=${busqueda}`);
  const productos = await respuesta.json();

  const contenedorProductos = document.getElementById('contenedor-productos');
  contenedorProductos.innerHTML = '';

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

});$(document).ready(function() {
  $('.carousel').each(function() {
    var $carousel = $(this);
    var $images = $carousel.find('.carousel__image');
    var $prevButton = $carousel.closest('.card').find('.carousel__button:has(.fa-chevron-left)');
    var $nextButton = $carousel.closest('.card').find('.carousel__button:has(.fa-chevron-right)');
    var index = 0;

    $prevButton.click(function() {
      $images.eq(index).hide();
      index--;
      if (index < 0) {
        index = $images.length - 1;
      }
      $images.eq(index).show();
    });

    $nextButton.click(function() {
      $images.eq(index).hide();
      index++;
      if (index >= $images.length) {
        index = 0;
      }
      $images.eq(index).show();
    });
  });
});