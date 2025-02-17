window.addEventListener('load', function() {
    let timer;
    let ultimaBusqueda = "";
    const contenedorProductos = document.getElementById('contenedor-productos');
    const isUserLoggedIn = document.body.dataset.isUserLoggedIn === 'true';
    const isAdminUser = document.body.dataset.isAdminUser === 'true';

    // Función para mostrar el semáforo de stock
    function construirSemaforo(producto) {
        if (!isAdminUser) {
            return producto.stock_actual >= producto.stock_minimo
                ? `<div class="semaforo-stock">
                        <i class="fa-solid fa-thumbs-up semaforo verde"></i>
                        <span class="texto-semaforo">PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA</span>
                   </div>`
                : `<div class="semaforo-stock">
                        <i class="fa-solid fa-thumbs-up semaforo rojo"></i>
                        <span class="texto-semaforo">PRODUCTO PENDIENTE DE INGRESO O A PEDIDO</span>
                   </div>`;
        }
        return '';
    }

    // Función para crear las tarjetas de los productos
    function mostrarProductos(productos) {
        contenedorProductos.innerHTML = "";

        productos.forEach((producto) => {
            let imagenes = "";
            if (producto.imagenes && producto.imagenes.length > 0) {
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
                        ${construirSemaforo(producto)}
                        <div class="cantidad-producto">
                            <input type="number" class="cantidad" value="1" min="1">
                            <button class="agregar-carrito">Agregar al carrito</button>
                            <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
                        </div>`;
                } else {
                    html += `
                        <div class="cantidad-producto">
                            <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
                        </div>
                        <div class="stock-producto ${producto.stock_actual < producto.stock_minimo ? 'bajo-stock' : 'suficiente-stock'}">
                            <p>Stock Disponible: ${producto.stock_actual ?? "No disponible"}</p>
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

    // Función para manejar el carrusel
    function agregarEventosCarrusel(tarjetaProducto) {
        const imagenes = tarjetaProducto.querySelectorAll('.carousel__image');
        const botonIzq = tarjetaProducto.querySelector('.carousel__button--left');
        const botonDer = tarjetaProducto.querySelector('.carousel__button--right');

        if (!imagenes.length || !botonIzq || !botonDer) return;

        let indiceActual = 0;

        function mostrarImagen(indice) {
            imagenes.forEach((img, i) => img.classList.toggle('hidden', i !== indice));
        }

        botonIzq.addEventListener('click', () => {
            indiceActual = (indiceActual > 0) ? indiceActual - 1 : imagenes.length - 1;
            mostrarImagen(indiceActual);
        });

        botonDer.addEventListener('click', () => {
            indiceActual = (indiceActual < imagenes.length - 1) ? indiceActual + 1 : 0;
            mostrarImagen(indiceActual);
        });
    }

    // Evento para buscar productos
    document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const busqueda = e.target.value.trim().toLowerCase();

            if (busqueda === ultimaBusqueda) return;
            ultimaBusqueda = busqueda;

            try {
                contenedorProductos.innerHTML = '<p class="loading">Cargando productos...</p>';
                const respuesta = await fetch(`/productos/api/buscar?q=${encodeURIComponent(busqueda)}`);
                const productos = await respuesta.json();
                mostrarProductos(productos);
            } catch (error) {
                console.error("Error al buscar productos:", error);
                contenedorProductos.innerHTML = '<p class="error">Error al cargar los productos</p>';
            }
        }, 300);
    });

    // Evento de paginación
    document.querySelectorAll('.paginacion a').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const pagina = link.textContent.trim();
            window.location.href = `/productos?pagina=${pagina}`;
        });
    });

    // Evento para filtrar productos
    ['#categoria_id', '#marca_id', '#modelo_id'].forEach(id => {
        document.querySelector(id)?.addEventListener('change', () => {
            const categoria = document.querySelector('#categoria_id').value;
            const marca = document.querySelector('#marca_id').value;
            const modelo = document.querySelector('#modelo_id').value;
            window.location.href = `/productos?categoria=${categoria}&marca=${marca}&modelo=${modelo}`;
        });
    });
});
