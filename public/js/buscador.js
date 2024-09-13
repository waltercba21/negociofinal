let productosOriginales = [];
let timer;

window.onload = async () => {
  const respuesta = await fetch('/productos/api/buscar');
  const data = await respuesta.json();
  productosOriginales = data.productos;
};

document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value;
    const contenedorProductos = document.getElementById('contenedor-productos');
    contenedorProductos.innerHTML = '';
    let productos = [];
    let isAdminUser = false;

    if (!busqueda.trim()) {
      productos = productosOriginales.slice(0, 12); 
      isAdminUser = productosOriginales.isAdminUser;
    } else {
      let url = '/productos/api/buscar?q=' + encodeURIComponent(busqueda);
      const respuesta = await fetch(url);
      const data = await respuesta.json();
      productos = data.productos;
      isAdminUser = data.isAdminUser;
    }

    // Debug: Verificar los productos obtenidos
    console.log('Productos obtenidos en el cliente:', productos);

    productos.forEach((producto) => {
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
            <button class="carousel__button carousel__button--left">
              <i class="fas fa-chevron-left"></i>
            </button>
            <button class="carousel__button carousel__button--right">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        `;
      } else {
        imagenes = '<img src="/ruta/valida/a/imagen/por/defecto.jpg" alt="Imagen de ${producto.nombre}">';
      }
      const precio_venta = producto.precio_venta ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}` : 'Precio no disponible';
      const tarjetaProducto = document.createElement('div');
      tarjetaProducto.classList.add('card');
      tarjetaProducto.innerHTML = `
        ${imagenes}
        <div class="titulo-producto">
          <h3 class="nombre">${producto.nombre}</h3>
        </div>
        <hr>
        <div class="precio-producto">
          <p class="precio">${precio_venta}</p>
        </div>
        ${isAdminUser ? `
          <div class="stock-producto ${producto.stock_actual < producto.stock_minimo ? 'bajo-stock' : 'suficiente-stock'}">
            <p>Stock Disponible: ${producto.stock_actual}</p>
          </div>
        ` : ''}
        <div class="cantidad-producto">
          <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
        </div>
      `;
      contenedorProductos.appendChild(tarjetaProducto);
    });
  }, 300);
});
