let timer;
let ultimaBusqueda = "";

// Captura el evento de entrada en el buscador
document.getElementById("entradaBusqueda").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
        let busqueda = e.target.value.trim().toLowerCase();
        const contenedorProductos = document.getElementById("contenedor-productos");

        if (!busqueda) {
            // Si no hay búsqueda, mostrar los productos originales
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

            // Limpiar y mostrar los productos encontrados
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

        const precio_venta = producto.precio_venta
            ? `$${Math.floor(producto.precio_venta).toLocaleString("de-DE")}`
            : "Precio no disponible";

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

        if (isUserLoggedIn) {
            if (!isAdminUser) {
                html += `
                  <div class="semaforo-stock">
                    ${producto.stock_actual >= producto.stock_minimo
                        ? '<i class="fa-solid fa-thumbs-up semaforo verde"></i> <span class="texto-semaforo">PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA</span>'
                        : '<i class="fa-solid fa-thumbs-up semaforo rojo"></i> <span class="texto-semaforo">PRODUCTO PENDIENTE DE INGRESO O A PEDIDO</span>'}
                  </div>

                  <div class="cantidad-producto">
                    <input type="number" class="cantidad-input" value="1" min="1">
                    <button class="agregar-carrito" data-id="${producto.id}" data-nombre="${producto.nombre}" data-precio="${producto.precio_venta}">Agregar al carrito</button>
                    <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
                  </div>`;
            }
        } else {
            html += `<div class="cantidad-producto"><a href="/productos/${producto.id}" class="card-link">Ver detalles</a></div>`;
        }

        html += `</div>`;

        const tarjetaProducto = document.createElement("div");
        tarjetaProducto.innerHTML = html;
        contenedorProductos.appendChild(tarjetaProducto);

        agregarEventosCarrusel(tarjetaProducto);
    });
}

// Delegar evento de "Agregar al carrito"
document.getElementById("contenedor-productos").addEventListener("click", (e) => {
    if (e.target.classList.contains("agregar-carrito")) {
        const tarjetaProducto = e.target.closest(".card");
        const cantidadInput = tarjetaProducto.querySelector(".cantidad-input");
        const cantidad = parseInt(cantidadInput.value) || 1;
        const nombreProducto = e.target.dataset.nombre;
        const idProducto = e.target.dataset.id;
        const precioProducto = e.target.dataset.precio;

        // Enviar la solicitud al servidor para agregar el producto al carrito
        fetch('/carrito/agregar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id_producto: idProducto,
                cantidad: cantidad,
                precio: precioProducto
            }),
        })
        .then(response => response.json())
        .then(data => {
            mostrarNotificacion(`${cantidad} ${nombreProducto} agregado(s) al carrito`);
        })
        .catch(error => {
            console.error('Error al agregar el producto al carrito:', error);
            Swal.fire({
                title: "Error",
                text: "Hubo un problema al agregar el producto al carrito.",
                icon: "error",
                confirmButtonText: "OK",
            });
        });
    }
});

// Función para mostrar la notificación con SweetAlert
function mostrarNotificacion(mensaje) {
    Swal.fire({
        title: "¡Producto agregado!",
        text: mensaje,
        icon: "success",
        confirmButtonText: "OK",
        timer: 3000,
        timerProgressBar: true
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
