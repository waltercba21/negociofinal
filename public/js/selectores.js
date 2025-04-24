document.addEventListener("DOMContentLoaded", function () {
  const categoriaSelect = document.getElementById("categoria_id");
  const marcaSelect = document.getElementById("marca_id");
  const modeloSelect = document.getElementById("modelo_id");
  const contenedorProductos = document.getElementById("contenedor-productos");

  const isUserLoggedIn = document.body.dataset.isUserLoggedIn === "true";
  const isAdminUser = document.body.dataset.isAdminUser === "true";

  // Cargar modelos al cambiar marca
  marcaSelect.addEventListener("change", function () {
    const marcaId = this.value;
    fetch("/productos/modelos/" + marcaId)
      .then((res) => res.json())
      .then((modelos) => {
        modeloSelect.innerHTML = "";
        const option = document.createElement("option");
        option.value = "";
        option.text = "Selecciona un modelo";
        modeloSelect.appendChild(option);

        modelos.forEach((modelo) => {
          const opt = document.createElement("option");
          opt.value = modelo.id;
          opt.text = modelo.nombre;
          modeloSelect.appendChild(opt);
        });
      })
      .catch((err) => console.error("Error al cargar modelos:", err));
  });

  [categoriaSelect, marcaSelect, modeloSelect].forEach((selector) => {
    selector.addEventListener("change", async () => {
      const categoria_id = categoriaSelect.value;
      const marca_id = marcaSelect.value;
      const modelo_id = modeloSelect.value;

      contenedorProductos.innerHTML = "<p>Cargando productos...</p>";

      try {
        const response = await fetch(`/productos/api/buscar?categoria_id=${categoria_id}&marca_id=${marca_id}&modelo_id=${modelo_id}`);
        if (!response.ok) throw new Error("Error al obtener productos");

        const productos = await response.json();
        mostrarProductos(productos);
      } catch (error) {
        console.error("Error:", error);
        contenedorProductos.innerHTML = "<p>Error al cargar productos.</p>";
      }
    });
  });

  function mostrarProductos(productos) {
    contenedorProductos.innerHTML = "";
  
    if (productos.length === 0) {
      const contenedorVacio = document.createElement("div");
      contenedorVacio.className = "no-result";
      contenedorVacio.innerHTML = `
        <img src="/images/noEncontrado.png" alt="Producto no encontrado" class="imagen-no-result">
        <p>No se encontraron productos. Probá con otros filtros o palabras clave.</p>
      `;
      contenedorProductos.appendChild(contenedorVacio);
      return;
    }
  
    productos.forEach((producto, index) => {
      const card = document.createElement("div");
      card.className = `
        card 
        ${producto.calidad_original ? "calidad-original-fitam" : ""} 
        ${producto.calidad_vic ? "calidad_vic" : ""} 
        ${producto.oferta ? "producto-oferta" : ""}
      `;
      card.setAttribute("data-label", producto.oferta ? "OFERTA" : producto.calidad_original ? "CALIDAD FITAM" : producto.calidad_vic ? "CALIDAD VIC" : "");
  
      const imagenesHTML = producto.imagenes.map((img, i) => `
        <img class="carousel__image ${i !== 0 ? "hidden" : ""}" src="/uploads/productos/${img.imagen}" alt="${producto.nombre}">
      `).join("");
  
      const stockHTML = isUserLoggedIn
        ? isAdminUser
          ? `
            <div class="stock-producto ${producto.stock_actual >= producto.stock_minimo ? "suficiente-stock" : "bajo-stock"}">
              <p>Stock Disponible: ${producto.stock_actual}</p>
            </div>
            <div class="cantidad-producto">
              <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
            </div>
          `
          : `
            <div class="semaforo-stock">
              <i class="fa-solid fa-thumbs-${producto.stock_actual >= producto.stock_minimo ? "up verde" : "down rojo"}"></i>
              <span class="texto-semaforo">
                ${producto.stock_actual >= producto.stock_minimo
                  ? "PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA"
                  : "PRODUCTO PENDIENTE DE INGRESO O A PEDIDO"}
              </span>
            </div>
            <div class="cantidad-producto">
              <input type="number" class="cantidad-input" value="0" min="0" id="input-cantidad-${producto.id}">
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
          `
        : `<div class="cantidad-producto"><a href="/productos/${producto.id}" class="card-link">Ver detalles</a></div>`;
  
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
        <div class="categoria-producto"><h6 class="categoria">${producto.categoria_nombre || "Sin categoría"}</h6></div>
        <div class="precio-producto"><p class="precio">$${formatearNumero(producto.precio_venta || 0)}</p></div>
        ${stockHTML}
        <div class="acciones-compartir">
          <a href="https://wa.me/543513820440?text=QUIERO CONSULTAR POR ESTE PRODUCTO: https://www.autofaros.com.ar/productos/${producto.id}" class="whatsapp" target="_blank">
            <i class="fab fa-whatsapp"></i>
          </a>
          <a href="https://www.facebook.com/profile.php?id=100063665395970" class="facebook" target="_blank">
            <i class="fab fa-facebook"></i>
          </a>
          <a href="https://www.instagram.com/autofaros_cordoba" class="instagram" target="_blank">
            <i class="fab fa-instagram"></i>
          </a>
        </div>
      `;
  
      contenedorProductos.appendChild(card);
  
      if (!isAdminUser && isUserLoggedIn) {
        const botonAgregar = card.querySelector('.agregar-carrito');
        const inputCantidad = card.querySelector('.cantidad-input');
  
        botonAgregar.addEventListener('click', (e) => {
          e.preventDefault();
          const cantidad = parseInt(inputCantidad.value);
          const stockDisponible = parseInt(producto.stock_actual);
  
          if (!cantidad || cantidad <= 0 || isNaN(cantidad)) {
            Swal.fire({ icon: 'error', title: 'Cantidad inválida', text: 'Debes ingresar una cantidad mayor a 0.' });
            return;
          }
  
          if (cantidad > stockDisponible) {
            Swal.fire({ icon: 'warning', title: 'Cantidades no disponibles', text: 'Si deseas más unidades comunicate con nosotros 3513820440' });
            inputCantidad.value = stockDisponible;
            return;
          }
  
          const eventoAgregar = new CustomEvent("agregarAlCarritoDesdeBuscador", {
            detail: {
              id: producto.id,
              nombre: producto.nombre,
              precio: producto.precio_venta,
              cantidad: cantidad
            }
          });
  
          document.dispatchEvent(eventoAgregar);
        });
      }
    });
  }
  

  function moverCarrusel(index, direccion) {
    const carousel = document.getElementById(`carousel-${index}`);
    const imagenes = carousel.querySelectorAll(".carousel__image");
    let activa = [...imagenes].findIndex(img => !img.classList.contains("hidden"));
    imagenes[activa].classList.add("hidden");
    activa = (activa + direccion + imagenes.length) % imagenes.length;
    imagenes[activa].classList.remove("hidden");
  }

  function formatearNumero(num) {
    return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
});
