const entradaBusqueda = document.getElementById('entradaBusqueda');
const contenedorProductos = document.getElementById('contenedor-productos');
const isAdminUser = document.body.dataset.isAdminUser === 'true';
const isUserLoggedIn = document.body.dataset.isUserLoggedIn === 'true';

entradaBusqueda.addEventListener('input', async function () {
  const busqueda = entradaBusqueda.value.trim();

  if (busqueda.length >= 2) {
    const response = await fetch(`/productos/buscar/${busqueda}`);
    const productos = await response.json();

    renderizarProductos(productos);
  } else {
    contenedorProductos.innerHTML = '<p>Realiza una búsqueda más específica.</p>';
  }
});

function renderizarProductos(productos) {
  if (productos.length === 0) {
    contenedorProductos.innerHTML = '<p>No se encontraron productos.</p>';
    return;
  }

  contenedorProductos.innerHTML = productos.map((producto, index) => `
    <div class="card
      ${producto.oferta ? 'producto-oferta' : producto.calidad_original ? 'calidad-original-fitam' : producto.calidad_vic ? 'calidad_vic' : ''}"
      data-label="${producto.oferta ? 'OFERTA' : producto.calidad_original ? 'CALIDAD FITAM' : producto.calidad_vic ? 'CALIDAD VIC' : ''}">

      <div class="cover-card">
        ${producto.imagenes.length > 0
          ? `<div class="carousel-container">
              <button class="carousel__button" onclick="moverCarrusel(${index}, -1)"><i class="fas fa-chevron-left"></i></button>
              <div class="carousel-wrapper">
                <div class="carousel" id="carousel-${index}">
                  ${producto.imagenes.map((img, i) => `
                    <img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${img.imagen}" alt="${producto.nombre}">
                  `).join('')}
                </div>
              </div>
              <button class="carousel__button" onclick="moverCarrusel(${index}, 1)"><i class="fas fa-chevron-right"></i></button>
            </div>`
          : `<div class="carousel-wrapper"><img class="carousel__image" src="/ruta/valida/a/imagen/por/defecto.jpg" alt="${producto.nombre}"></div>`
        }
      </div>

      <div class="titulo-producto"><h3 class="nombre">${producto.nombre}</h3></div>
      <hr>
      <div class="categoria-producto"><h5 class="categoria">${producto.categoria_nombre || 'Sin categoría'}</h5></div>
      <div class="precio-producto"><p class="precio">${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(producto.precio_venta || 0)}</p></div>

      ${isUserLoggedIn ? 
        isAdminUser ? `
        <div class="cantidad-producto"><a href="/productos/${producto.id}" class="card-link">Ver detalles</a></div>
        <div class="stock-producto ${producto.stock_actual < producto.stock_minimo ? 'bajo-stock' : 'suficiente-stock'}">
          <p>Stock Disponible: ${producto.stock_actual}</p>
        </div>`
        : `
        <div class="semaforo-stock">
          <i class="fa-solid fa-thumbs-${producto.stock_actual >= producto.stock_minimo ? 'up' : 'down'} semaforo ${producto.stock_actual >= producto.stock_minimo ? 'verde' : 'rojo'}"></i>
          <span class="texto-semaforo">${producto.stock_actual >= producto.stock_minimo ? 'PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA' : 'PRODUCTO PENDIENTE DE INGRESO O A PEDIDO'}</span>
        </div>
        <div class="cantidad-producto">
          <input type="number" class="cantidad-input" value="0" min="0">
          <button class="agregar-carrito"
            data-id="${producto.id}"
            data-nombre="${producto.nombre}"
            data-precio="${producto.precio_venta}"
            data-stock="${producto.stock_actual}"
            data-stockmin="${producto.stock_minimo}">
            Agregar al carrito
          </button>
          <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
        </div>` : ''
      }
    </div>
  `).join('');
}

function moverCarrusel(index, direccion) {
  const carrusel = document.getElementById(`carousel-${index}`);
  const imagenes = carrusel.querySelectorAll('.carousel__image');
  let activa = Array.from(imagenes).findIndex(img => !img.classList.contains('hidden'));

  imagenes[activa].classList.add('hidden');
  activa = (activa + direccion + imagenes.length) % imagenes.length;
  imagenes[activa].classList.remove('hidden');
}
