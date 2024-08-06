let productosOriginales = [];
let timer;

window.onload = async () => {
  const respuesta = await fetch('/productos/api/buscar');
  productosOriginales = await respuesta.json();
};

document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value;
    const contenedorProductos = document.getElementById('contenedor-productos');
    contenedorProductos.innerHTML = '';
    let productos = [];
    if (!busqueda.trim()) {
      productos = productosOriginales.slice(0, 12); 
    } else {
      let url = '/productos/api/buscar?q=' + busqueda;
      const respuesta = await fetch(url);
      productos = await respuesta.json();
    }
    productos.forEach((producto, index) => {
      let imagenes = '';
      if (producto.imagenes && producto.imagenes.length > 0) {
        producto.imagenes.forEach((imagenObj, i) => {
          const imagen = imagenObj.imagen;
          imagenes += `<img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${imagen}" alt="Imagen de ${producto.nombre}">`;
        });
        
        let botonesCarrusel = '';
        if (producto.imagenes.length > 1) {
          botonesCarrusel = `
            <div class="carousel__buttons">
              <button class="carousel__button">
                <i class="fas fa-chevron-left"></i>
              </button>
              <button class="carousel__button">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          `;
        }

        imagenes = `
          <div class="cover__card">
            <div class="carousel">
              ${imagenes}
            </div>
          </div>
          ${botonesCarrusel}
        `;
      } else {
        imagenes = '<img src="/ruta/valida/a/imagen/por/defecto.jpg" alt="Imagen de ${producto.nombre}">';
      }
      
      const precio_venta = producto.precio_venta ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}` : 'Precio no disponible';
      const tarjetaProducto = document.createElement('div');
      tarjetaProducto.innerHTML = `
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
      contenedorProductos.appendChild(tarjetaProducto);
    });
  }, 300); 
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
