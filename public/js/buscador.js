let productosOriginales = [];
let timer;

window.onload = async () => {
  try {
    console.log("Cargando productos desde la API...");
    const respuesta = await fetch('/productos/api/buscar');
    productosOriginales = await respuesta.json();
    console.log("Productos cargados correctamente:", productosOriginales);
    mostrarProductos(productosOriginales.slice(0, 12)); // Mostrar los primeros 12 productos por defecto
  } catch (error) {
    console.error("Error al cargar los productos:", error);
  }
};

document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value;
    const contenedorProductos = document.getElementById('contenedor-productos');
    contenedorProductos.innerHTML = ''; 
    let productos = [];

    if (!busqueda.trim()) {
      productos = productosOriginales.slice(0, 12); // Mostrar los primeros 12 productos si no hay búsqueda
    } else {
      const url = '/productos/api/buscar?q=' + encodeURIComponent(busqueda);
      try {
        const respuesta = await fetch(url);
        productos = await respuesta.json();
      } catch (error) {
        console.error("Error al buscar productos:", error);
      }
    }

    mostrarProductos(productos);
  }, 300); // Espera de 300 ms antes de procesar la búsqueda
});

function mostrarProductos(productos) {
  const contenedorProductos = document.getElementById('contenedor-productos');
  const isUserLoggedIn = document.body.dataset.isUserLoggedIn === 'true';
  const isAdminUser = document.body.dataset.isAdminUser === 'true';

  contenedorProductos.innerHTML = ''; // Limpiar el contenedor antes de agregar nuevos productos

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
      imagenes = `<img src="/ruta/valida/a/imagen/por/defecto.jpg" alt="Imagen de ${producto.nombre}">`;
    }

    const precio_venta = producto.precio_venta
      ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}`
      : 'Precio no disponible';

    const tarjetaProducto = document.createElement('div');
    tarjetaProducto.classList.add('card');
    if (producto.calidad_original) {
      tarjetaProducto.classList.add('calidad-original-fitam');
    }
    if (producto.calidad_vic) {
      tarjetaProducto.classList.add('calidad_vic');
    }

    let html = `
      ${imagenes}
      <div class="titulo-producto">
        <h3 class="nombre">${producto.nombre}</h3>
      </div>
      <hr>
      <div class="precio-producto">
        <p class="precio">${precio_venta}</p>
      </div>
    `;

    // Lógica del semáforo
    if (isUserLoggedIn) {
      html += `
        <div class="semaforo-stock">
          ${producto.stock_actual >= producto.stock_minimo
            ? '<span class="semaforo verde"></span> PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA'
            : '<span class="semaforo rojo"></span> PRODUCTO PENDIENTE DE INGRESO O A PEDIDO'}
        </div>
      `;
    }

    // Información adicional para administradores
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

    if (leftButton && rightButton) {
      leftButton.addEventListener('click', () => {
        images[currentIndex].classList.add('hidden');
        currentIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
        images[currentIndex].classList.remove('hidden');
      });

      rightButton.addEventListener('click', () => {
        images[currentIndex].classList.add('hidden');
        currentIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
        images[currentIndex].classList.remove('hidden');
      });
    }
  });
}
