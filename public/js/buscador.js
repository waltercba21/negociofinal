let productosOriginales = [];

window.onload = async () => {
  const respuesta = await fetch('/productos/api/buscar');
  productosOriginales = await respuesta.json();
  console.log('Productos originales:', productosOriginales); // Agregar console.log aquí
};

document.getElementById('entradaBusqueda').addEventListener('input', async (e) => {
  const busqueda = e.target.value;
  console.log(`Buscando: ${busqueda}`);
  const contenedorProductos = document.getElementById('contenedor-productos');
  contenedorProductos.innerHTML = '';

  if (!busqueda.trim()) {
    return;
  }

  let url = '/productos/api/buscar?q=' + busqueda;
  const respuesta = await fetch(url);
  const productos = await respuesta.json();
  console.log('Productos de la búsqueda:', productos); // Agregar console.log aquí

  productos.forEach((producto, index) => {
    console.log('Procesando producto:', producto)
    let imagenes = '';
    if (producto.imagenes && producto.imagenes.length > 0) {
      producto.imagenes.forEach((imagenObj, i) => {
        const imagen = imagenObj.imagen;
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


  // Ahora que las tarjetas de productos se han agregado al DOM, puedes agregar los controladores de eventos a los botones del carrusel
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