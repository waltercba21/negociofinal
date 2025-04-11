let timer;
let ultimaBusqueda = "";

// Captura el evento de entrada en el buscador
document.getElementById("entradaBusqueda").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
        let busqueda = e.target.value.trim().toLowerCase();
        const contenedorProductos = document.getElementById("contenedor-productos");

        if (!busqueda) {
            mostrarProductos(productosOriginales.slice(0, 12));
            return;
        }

        if (busqueda === ultimaBusqueda) return; // Evitar búsquedas duplicadas
        ultimaBusqueda = busqueda;

        contenedorProductos.innerHTML = '<p class="loading">Cargando productos...</p>';

        try {
            const respuesta = await fetch(`/productos/api/buscar?q=${encodeURIComponent(busqueda)}`);
            if (!respuesta.ok) throw new Error("Error en la búsqueda");
            const productos = await respuesta.json();

            contenedorProductos.innerHTML = "";
            mostrarProductos(productos);
        } catch (error) {
            contenedorProductos.innerHTML = '<p class="error">Error al cargar los productos</p>';
            console.error("Error en la búsqueda de productos:", error);
        }
    }, 300);
});

// Función para renderizar los productos
function mostrarProductos(productos) {
    const contenedorProductos = document.getElementById('contenedor-productos');
    contenedorProductos.innerHTML = '';
  
    if (productos.length === 0) {
      contenedorProductos.innerHTML = '<p>No se encontraron productos</p>';
      return;
    }
  
    productos.forEach((producto, index) => {
      const card = document.createElement('div');
      card.classList.add('card');
      if (producto.calidad_original) card.classList.add('calidad-original-fitam');
      if (producto.calidad_vic) card.classList.add('calidad_vic');
      if (producto.oferta) card.classList.add('producto-oferta');
  
      card.innerHTML = `
        <div class="cover-card">
          ${producto.imagenes && producto.imagenes.length > 0 ?
          `
          <div class="carousel-container">
            <button class="carousel__button carousel__button--left" onclick="moverCarrusel(${index}, -1)"><i class="fas fa-chevron-left"></i></button>
            <div class="carousel" id="carousel-${index}">
              ${producto.imagenes.map((img, i) =>
                `<img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${img.imagen}" alt="${producto.nombre}">`
              ).join('')}
            </div>
            <button class="carousel__button carousel__button--right" onclick="moverCarrusel(${index}, 1)"><i class="fas fa-chevron-right"></i></button>
          </div>
          `
          :
          `<img src="/ruta/valida/a/imagen/por/defecto.jpg" alt="${producto.nombre}">`
          }
        </div>
  
        <div class="titulo-producto"><h3 class="nombre">${producto.nombre}</h3></div>
        <hr>
        <div class="categoria-producto"><h6 class="categoria">${producto.categoria_nombre || 'Sin categoría'}</h6></div>
        <div class="precio-producto"><p class="precio">$${Number(producto.precio_venta).toLocaleString('es-AR')}</p></div>
  
        <div class="semaforo-stock">
          <i class="fa-solid fa-thumbs-${producto.stock_actual >= producto.stock_minimo ? 'up' : 'down'} semaforo ${producto.stock_actual >= producto.stock_minimo ? 'verde' : 'rojo'}"></i>
          <span class="texto-semaforo">
            ${producto.stock_actual >= producto.stock_minimo ? "PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA" : "PRODUCTO PENDIENTE DE INGRESO O A PEDIDO"}
          </span>
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
        </div>
      `;
  
      contenedorProductos.appendChild(card);
    });
  }
  

function agregarEventosCarrusel(tarjetaProducto) {
    const leftButton = tarjetaProducto.querySelector(".carousel__button--left");
    const rightButton = tarjetaProducto.querySelector(".carousel__button--right");
    const images = tarjetaProducto.querySelectorAll(".carousel__image");
    let currentIndex = 0;

    if (leftButton && rightButton) {
        leftButton.addEventListener("click", () => {
            images[currentIndex].classList.add("hidden");
            currentIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
            images[currentIndex].classList.remove("hidden");
        });

        rightButton.addEventListener("click", () => {
            images[currentIndex].classList.add("hidden");
            currentIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
            images[currentIndex].classList.remove("hidden");
        });
    }
}
document.querySelectorAll('.flecha-izquierda, .flecha-derecha').forEach(boton => {
    boton.addEventListener('click', function () {
        const card = this.closest('.card-producto');
        const imagen = card.querySelector('.imagen-producto');
        const imagenes = JSON.parse(card.dataset.imagenes);
        let indice = parseInt(card.dataset.indiceImagen);

        if (this.classList.contains('flecha-izquierda')) {
            indice = (indice - 1 + imagenes.length) % imagenes.length;
        } else {
            indice = (indice + 1) % imagenes.length;
        }

        card.dataset.indiceImagen = indice;
        imagen.src = `/uploads/productos/${imagenes[indice]}`;
    });
});
