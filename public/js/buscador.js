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
    const contenedorProductos = document.getElementById("contenedor-productos");
    const isUserLoggedIn = document.body.dataset.isUserLoggedIn === "true";
    const isAdminUser = document.body.dataset.isAdminUser === "true";

    contenedorProductos.innerHTML = "";

    productos.forEach((producto) => {
        let imagenes = "";

        // Generar el carrusel de imágenes
        if (producto.imagenes?.length > 0) {
            producto.imagenes.forEach((imagenObj, i) => {
                imagenes += `<img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${imagenObj.imagen}" alt="Imagen de ${producto.nombre}">`;
            });
            imagenes = `
                <div class="cover__card">
                    <div class="carousel">${imagenes}</div>
                </div>
                <div class="carousel__buttons">
                    <button class="carousel__button carousel__button--left"><i class="fas fa-chevron-left"></i></button>
                    <button class="carousel__button carousel__button--right"><i class="fas fa-chevron-right"></i></button>
                </div>`;
        } else {
            imagenes = `<img src="/ruta/valida/a/imagen/por/defecto.jpg" alt="Imagen de ${producto.nombre}">`;
        }

        // Formatear el precio
        const precio_venta = producto.precio_venta
            ? `$${Math.floor(producto.precio_venta).toLocaleString("de-DE")}`
            : "Precio no disponible";

        // Iniciar la tarjeta del producto
        let html = `
            <div class="card 
                ${producto.calidad_original ? 'calidad-original-fitam' : ''} 
                ${producto.calidad_vic ? 'calidad_vic' : ''} 
                ${producto.oferta ? 'producto-oferta' : ''}">
                
                ${imagenes}
                <div class="titulo-producto">
                    <h3 class="nombre">${producto.nombre}</h3>
                </div>
                <hr>
                <div class="precio-producto">
                    <p class="precio">${precio_venta}</p>
                </div>`;

        // Si el usuario está logueado
        if (isUserLoggedIn) {
            if (isAdminUser) {
                // 🔹 Si es administrador, mostrar enlace de detalles + stock disponible
                html += `
                    <div class="cantidad-producto">
                        <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
                    </div>
                    <div class="stock-producto ${producto.stock_actual < producto.stock_minimo ? 'bajo-stock' : 'suficiente-stock'}">
                        <p>Stock Disponible: ${producto.stock_actual !== undefined ? producto.stock_actual : "No disponible"}</p>
                    </div>`;
            } else {
                // 🔹 Si es usuario normal, mostrar semáforo de stock + carrito
                html += `
                    <div class="semaforo-stock">
                    ${producto.stock_actual >= producto.stock_minimo
                        ? '<i class="fa-solid fa-thumbs-up semaforo verde"></i> <span class="texto-semaforo">PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA</span>'
                        : '<i class="fa-solid fa-thumbs-down semaforo rojo"></i> <span class="texto-semaforo">PRODUCTO PENDIENTE DE INGRESO O A PEDIDO</span>'}
                      
                    </div>

                    <div class="cantidad-producto">
                        <input type="number" class="cantidad-input" value="1" min="1">
                        <button class="agregar-carrito" data-id="${producto.id}" data-nombre="${producto.nombre}" data-precio="${producto.precio_venta}">Agregar al carrito</button>
                        <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
                    </div>`;
            }
        } else {
            // 🔹 Si no está logueado, solo mostrar enlace de detalles
            html += `<div class="cantidad-producto"><a href="/productos/${producto.id}" class="card-link">Ver detalles</a></div>`;
        }

        html += `</div>`; // Cerrar tarjeta de producto

        // Crear y agregar la tarjeta al DOM
        const tarjetaProducto = document.createElement("div");
        tarjetaProducto.innerHTML = html;
        contenedorProductos.appendChild(tarjetaProducto);

        // Asegurar eventos del carrusel
        agregarEventosCarrusel(tarjetaProducto);
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
