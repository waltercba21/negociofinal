let productosOriginales = [];
let timer;

window.onload = async () => {
  try {
    console.log("Cargando productos desde la API...");
    const respuesta = await fetch('/productos/api/buscar');
    if (!respuesta.ok) throw new Error("Error al cargar los productos.");
    productosOriginales = await respuesta.json();
    console.log("Productos cargados correctamente:", productosOriginales);
    mostrarProductos(productosOriginales.slice(0, 12));
  } catch (error) {
    console.error("Error en la carga inicial:", error);
  }
};

document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value.trim();
    console.log("Busqueda ingresada:", busqueda);
    try {
      const contenedorProductos = document.getElementById('contenedor-productos');
      contenedorProductos.innerHTML = ''; // Limpiar productos actuales
      let productos = [];
      if (!busqueda) {
        productos = productosOriginales.slice(0, 12);
        console.log("Mostrando productos originales:", productos);
      } else {
        const url = `/productos/api/buscar?q=${encodeURIComponent(busqueda)}`;
        console.log("URL de búsqueda:", url);
        const respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error("Error al buscar productos.");
        productos = await respuesta.json();
        console.log("Productos encontrados:", productos);
      }
      mostrarProductos(productos);
    } catch (error) {
      console.error("Error durante la búsqueda:", error);
    }
  }, 300); // Esperar 300ms para evitar múltiples solicitudes
});

function mostrarProductos(productos) {
  const contenedorProductos = document.getElementById('contenedor-productos');
  const isUserLoggedIn = document.body.dataset.isUserLoggedIn === 'true';
  const isAdminUser = document.body.dataset.isAdminUser === 'true';

  console.log("Usuario logueado:", isUserLoggedIn, "Usuario administrador:", isAdminUser);
  console.log("Productos a mostrar:", productos);

  contenedorProductos.innerHTML = ''; // Limpiar antes de agregar nuevos productos

  productos.forEach((producto) => {
    console.log("Procesando producto:", producto);

    // Crear imágenes del carrusel
    let imagenes = '';
    if (producto.imagenes && producto.imagenes.length > 0) {
      producto.imagenes.forEach((imagenObj, i) => {
        imagenes += `<img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${imagenObj.imagen}" alt="Imagen de ${producto.nombre}">`;
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
      imagenes = `<img src="/ruta/valida/a/imagen/por/defecto.jpg" alt="Imagen de ${producto.nombre}">`;
    }

    // Crear tarjeta del producto
    const tarjetaProducto = document.createElement('div');
    tarjetaProducto.classList.add('card');
    if (producto.calidad_original) tarjetaProducto.classList.add('calidad-original-fitam');
    if (producto.calidad_vic) tarjetaProducto.classList.add('calidad_vic');

    // Lógica de contenido
    let html = `
      ${imagenes}
      <div class="titulo-producto">
        <h3 class="nombre">${producto.nombre}</h3>
      </div>
      <hr>
      <div class="precio-producto">
        <p class="precio">${producto.precio_venta ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}` : 'Precio no disponible'}</p>
      </div>
    `;

    // Semáforo y stock
    if (isUserLoggedIn) {
      html += `
        <div class="semaforo-stock">
          ${producto.stock_actual >= producto.stock_minimo ?
            '<span class="semaforo verde"></span> PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA' :
            '<span class="semaforo rojo"></span> PRODUCTO PENDIENTE DE INGRESO O A PEDIDO'}
        </div>
      `;
    }

    if (isAdminUser) {
      html += `
        <div class="stock-producto ${producto.stock_actual < producto.stock_minimo ? 'bajo-stock' : 'suficiente-stock'}">
          <p>Stock Disponible: ${producto.stock_actual}</p>
        </div>
      `;
    }

    html += `
      <div class="cantidad-producto">
        <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
      </div>
    `;

    tarjetaProducto.innerHTML = html;
    contenedorProductos.appendChild(tarjetaProducto);

    // Lógica del carrusel
    const leftButton = tarjetaProducto.querySelector('.carousel__button--left');
    const rightButton = tarjetaProducto.querySelector('.carousel__button--right');
    const images = tarjetaProducto.querySelectorAll('.carousel__image');
    let currentIndex = 0;

    if (leftButton && rightButton && images.length > 1) {
      leftButton.addEventListener('click', () => {
        images[currentIndex].classList.add('hidden');
        currentIndex = (currentIndex === 0) ? images.length - 1 : currentIndex - 1;
        images[currentIndex].classList.remove('hidden');
      });

      rightButton.addEventListener('click', () => {
        images[currentIndex].classList.add('hidden');
        currentIndex = (currentIndex === images.length - 1) ? 0 : currentIndex + 1;
        images[currentIndex].classList.remove('hidden');
      });
    }
  });
}
