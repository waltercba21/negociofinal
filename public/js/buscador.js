let productosOriginales = [];
let timer;
let ultimaBusqueda = ""; // Almacena la última búsqueda para evitar consultas innecesarias

document.getElementById("entradaBusqueda").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
        let busqueda = e.target.value.trim().toLowerCase(); // Convertimos a minúsculas y eliminamos espacios

        // Si la búsqueda es la misma que la última, no hacer otra consulta
        if (busqueda === ultimaBusqueda) return;
        ultimaBusqueda = busqueda; // Guardamos la nueva búsqueda

        const contenedorProductos = document.getElementById("contenedor-productos");
        contenedorProductos.innerHTML = '<p class="loading">Cargando productos...</p>'; // Muestra un mensaje de carga

        let productos = [];

        // Si la búsqueda está vacía, mostrar productos originales (primeros 12)
        if (!busqueda) {
            mostrarProductos(productosOriginales.slice(0, 12));
            return;
        }

        try {
            const url = `/productos/api/buscar?q=${encodeURIComponent(busqueda)}`;
            const respuesta = await fetch(url);
            productos = await respuesta.json();

            // Filtrar resultados en el frontend para mayor precisión (opcional si MySQL ya hace un buen filtrado)
            const palabrasClave = busqueda.split(" ");
            productos = productos.filter(producto =>
                palabrasClave.every(palabra => producto.nombre.toLowerCase().includes(palabra))
            );

        } catch (error) {
            console.error("Error al buscar productos:", error);
            contenedorProductos.innerHTML = '<p class="error">Error al cargar los productos</p>';
            return;
        }

        contenedorProductos.innerHTML = ""; // Limpiar antes de mostrar nuevos productos
        mostrarProductos(productos); // Mostrar resultados
    }, 300); // Espera de 300 ms antes de procesar la búsqueda
});

function mostrarProductos(productos) {
  const contenedorProductos = document.getElementById('contenedor-productos');
  contenedorProductos.innerHTML = ''; // Evita la duplicación limpiando antes de agregar
  
  const isUserLoggedIn = document.body.dataset.isUserLoggedIn === 'true';
  const isAdminUser = document.body.dataset.isAdminUser === 'true';

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
