let productosOriginales = [];
let timer;

const entradaBusqueda = document.getElementById('entradaBusqueda');
const contenedorProductos = document.getElementById('contenedor-productos');
const isAdminUser = document.body.getAttribute('data-is-admin-user') === 'true';
const isUserLoggedIn = document.body.getAttribute('data-is-user-logged-in') === 'true';

window.onload = async () => {
  const respuesta = await fetch('/productos/api/buscar');
  productosOriginales = await respuesta.json();
};

entradaBusqueda.addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value.trim();
    contenedorProductos.innerHTML = '';

    if (busqueda) {
      const url = `/productos/api/buscar?q=${encodeURIComponent(busqueda)}`;
      const respuesta = await fetch(url);
      const productos = await respuesta.json();

      mostrarProductos(productos);
    }
  }, 300);
});

function mostrarProductos(productos) {
  contenedorProductos.innerHTML = '';

  if (productos.length === 0) {
    contenedorProductos.innerHTML = '<p>No hay productos disponibles.</p>';
    return;
  }

  productos.forEach((producto, index) => {
    const card = document.createElement('div');
    card.className = `
      card 
      ${producto.calidad_original ? 'calidad-original-fitam' : ''} 
      ${producto.calidad_vic ? 'calidad_vic' : ''} 
      ${producto.oferta ? 'producto-oferta' : ''}
    `;
    card.setAttribute('data-label', producto.oferta ? 'OFERTA' : producto.calidad_original ? 'CALIDAD FITAM' : producto.calidad_vic ? 'CALIDAD VIC' : '');

    let imagenesHTML = '';
    producto.imagenes.forEach((imagen, i) => {
      imagenesHTML += `
        <img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${imagen.imagen}" alt="${producto.nombre}">
      `;
    });

    let stockInfo = '';

    if (isUserLoggedIn) {
      if (isAdminUser) {
        stockInfo = `
          <div class="stock-producto ${producto.stock_actual >= producto.stock_minimo ? 'suficiente-stock' : 'bajo-stock'}">
            <p>Stock Disponible: ${producto.stock_actual}</p>
          </div>
          <div class="cantidad-producto">
            <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
          </div>
        `;
      } else {
        stockInfo = `
          <div class="semaforo-stock">
            <i class="fa-solid fa-thumbs-${producto.stock_actual >= producto.stock_minimo ? 'up verde' : 'down rojo'}"></i>
            <span class="texto-semaforo">
              ${producto.stock_actual >= producto.stock_minimo ? 'PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA' : 'PRODUCTO PENDIENTE DE INGRESO O A PEDIDO'}
            </span>
          </div>
          <div class="cantidad-producto">
            <input type="number" class="cantidad-input" value="0" min="0" 
              data-stock="${producto.stock_actual}" 
              id="input-cantidad-${producto.id}">
            <button class="agregar-carrito" 
              data-id="${producto.id}" 
              data-nombre="${producto.nombre}" 
              data-precio="${producto.precio_venta}" 
              data-stock="${producto.stock_actual}" 
              data-stockmin="${producto.stock_minimo}">
              Agregar al carrito
            </button>
            <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
          </div>
        `;
      }
    }

    card.innerHTML = `
      <div class="cover-card">
        <div class="carousel-container">
          <button class="carousel__button carousel__button--left" onclick="moverCarrusel('${index}', -1)">
            <i class="fas fa-chevron-left"></i>
          </button>
          <div class="carousel-wrapper">
            <div class="carousel" id="carousel-${index}">
              ${imagenesHTML}
            </div>
          </div>
          <button class="carousel__button carousel__button--right" onclick="moverCarrusel('${index}', 1)">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>

      <div class="titulo-producto"><h3 class="nombre">${producto.nombre}</h3></div>
      <hr>
      <div class="categoria-producto"><h6 class="categoria">${producto.categoria_nombre || 'Sin categoría'}</h6></div>
      <div class="precio-producto"><p class="precio">$${formatearNumero(producto.precio_venta || 0)}</p></div>
      ${stockInfo}
    `;

    contenedorProductos.appendChild(card);

// ⛔️ Validaciones para evitar agregar productos sin cantidad válida
if (!isAdminUser && isUserLoggedIn) {
  const botonAgregar = card.querySelector('.agregar-carrito');
  const inputCantidad = card.querySelector('.cantidad-input');
  const stockDisponible = parseInt(producto.stock_actual);

  botonAgregar.addEventListener('click', (e) => {
    e.preventDefault();

    const cantidad = parseInt(inputCantidad.value);

    // 🚫 Si el campo está vacío, no es número o menor o igual a cero
    if (!inputCantidad.value || isNaN(cantidad) || cantidad <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Cantidad inválida',
        text: 'Debes ingresar una cantidad mayor a 0 para continuar.',
      });
      return;
    }

    // ⚠️ Si la cantidad supera el stock disponible
    if (cantidad > stockDisponible) {
      Swal.fire({
        icon: 'warning',
        title: 'Cantidades no disponibles',
        text: 'Si deseas más unidades comunicate con nosotros 3513820440',
      });
      inputCantidad.value = stockDisponible;
      return;
    }

    // ✅ Aquí iría tu función real de agregar al carrito (solo si pasa todas las validaciones)
    // agregarAlCarrito(producto.id, cantidad);
  });
}

  });
}

function moverCarrusel(index, direccion) {
  const carousel = document.getElementById(`carousel-${index}`);
  const imagenes = carousel.querySelectorAll('.carousel__image');
  let activa = [...imagenes].findIndex(img => !img.classList.contains('hidden'));

  imagenes[activa].classList.add('hidden');
  activa = (activa + direccion + imagenes.length) % imagenes.length;
  imagenes[activa].classList.remove('hidden');
}

function formatearNumero(num) {
  return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
