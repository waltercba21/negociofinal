document.getElementById('marca_id').addEventListener('change', function() {
  const marcaId = this.value;
  console.log('Marca seleccionada:', marcaId); // Agregar este log
  fetch('/productos/modelos/' + marcaId)
      .then(response => response.json())
      .then(modelos => {
          console.log('Modelos recibidos:', modelos); // Agregar este log
          modelos.sort(function(a, b) {
              return a.nombre.localeCompare(b.nombre);
          });
          const modeloSelect = document.getElementById('modelo_id');
          modeloSelect.innerHTML = '';
          const defaultOption = document.createElement('option');
          defaultOption.value = '';
          defaultOption.text = 'Selecciona un modelo';
          modeloSelect.appendChild(defaultOption);
          modelos.forEach(modelo => {
              const option = document.createElement('option');
              option.value = modelo.id;
              option.text = modelo.nombre;
              modeloSelect.appendChild(option);
          });
      })
      .catch(error => console.error('Error al obtener modelos:', error));
});

document.addEventListener("DOMContentLoaded", function () {
  const marcaSelect = document.getElementById("marca_id");
  if (marcaSelect) {
    marcaSelect.addEventListener("change", function () {
      const marcaId = this.value;
      console.log("Marca seleccionada:", marcaId);

      fetch("/productos/modelos/" + marcaId)
        .then((response) => response.json())
        .then((modelos) => {
          console.log("Modelos recibidos:", modelos);
          modelos.sort((a, b) => a.nombre.localeCompare(b.nombre));

          const modeloSelect = document.getElementById("modelo_id");
          modeloSelect.innerHTML = "";
          const defaultOption = document.createElement("option");
          defaultOption.value = "";
          defaultOption.text = "Selecciona un modelo";
          modeloSelect.appendChild(defaultOption);

          modelos.forEach((modelo) => {
            const option = document.createElement("option");
            option.value = modelo.id;
            option.text = modelo.nombre;
            modeloSelect.appendChild(option);
          });
        })
        .catch((error) => console.error("Error al obtener modelos:", error));
    });
  } else {
    console.error('Elemento con id="marca_id" no encontrado.');
  }

  // Variables para verificar si el usuario está logueado y si es administrador
  const isUserLoggedIn = document.body.dataset.isUserLoggedIn === "true";
  const isAdminUser = document.body.dataset.isAdminUser === "true";

  console.log("isUserLoggedIn:", isUserLoggedIn);
  console.log("isAdminUser:", isAdminUser);

  const selectores = document.querySelectorAll("#categoria_id, #marca_id, #modelo_id");
  const contenedorProductos = document.getElementById("contenedor-productos");

  selectores.forEach((selector) => {
    selector.addEventListener("change", function () {
      const categoria_id = document.getElementById("categoria_id").value;
      const marca_id = document.getElementById("marca_id").value;
      const modelo_id = document.getElementById("modelo_id").value;

      if (categoria_id === "" && marca_id === "" && modelo_id === "") {
        contenedorProductos.innerHTML = "";
        return;
      }

      console.log("Valores seleccionados - Categoría:", categoria_id, "Marca:", marca_id, "Modelo:", modelo_id);
      contenedorProductos.innerHTML = "<p>Cargando productos...</p>";

      fetch(`/productos/api/buscar?categoria_id=${categoria_id}&marca_id=${marca_id}&modelo_id=${modelo_id}`)
        .then((response) => {
          if (!response.ok) throw new Error("Error en la respuesta de la API");
          return response.json();
        })
        .then((productos) => {
          console.log("Productos devueltos de la API:", productos);
          renderizarProductos(productos);
        })
        .catch((error) => {
          console.error("Error al buscar productos:", error);
          contenedorProductos.innerHTML = "<p>Error al cargar los productos. Intenta nuevamente.</p>";
        });
    });
  });

  function renderizarProductos(productos) {
    contenedorProductos.innerHTML = "";

    if (productos.length === 0) {
      contenedorProductos.innerHTML = "<p>No se encontraron productos.</p>";
      return;
    }

    productos.forEach((producto) => {
      let imagenes = "";
      if (producto.imagenes && producto.imagenes.length > 0) {
        producto.imagenes.forEach((imagenObj, i) => {
          imagenes += `<img class="carousel__image ${i !== 0 ? "hidden" : ""}" src="/uploads/productos/${imagenObj.imagen}" alt="Imagen de ${producto.nombre}">`;
        });
        imagenes = `
          <div class="cover__card">
            <div class="carousel">
              ${imagenes}
            </div>
          </div>
          <div class="carousel__buttons">
            <button class="carousel__button carousel__button--left"><i class="fas fa-chevron-left"></i></button>
            <button class="carousel__button carousel__button--right"><i class="fas fa-chevron-right"></i></button>
          </div>
        `;
      } else {
        imagenes = '<img src="/ruta/valida/a/imagen/por/defecto.jpg" alt="Imagen no disponible">';
      }

      const precio_venta = producto.precio_venta
        ? `$${Math.floor(producto.precio_venta).toLocaleString("de-DE")}`
        : "Precio no disponible";

      let html = `<div class="card">${imagenes}
        <div class="titulo-producto"><h3 class="nombre">${producto.nombre}</h3></div>
        <hr>
        <div class="precio-producto"><p class="precio">${precio_venta}</p></div>`;

      if (isUserLoggedIn) {
        if (!isAdminUser) {
          html += `
            <div class="semaforo-stock">
              ${producto.stock_actual >= producto.stock_minimo
                ? '<i class="fa-solid fa-thumbs-up semaforo verde"></i> PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA'
                : '<i class="fa-solid fa-thumbs-up semaforo rojo"></i> PRODUCTO PENDIENTE DE INGRESO O A PEDIDO'}
            </div>
            <div class="cantidad-producto">
              <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
              <input type="number" id="cantidad" value="1" min="1">
              <button class="agregar-carrito">Agregar al carrito</button>
            </div>
          `;
        } else {
          html += `
            <div class="cantidad-producto">
              <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
            </div>
            <div class="stock-producto ${producto.stock_actual < producto.stock_minimo ? "bajo-stock" : "suficiente-stock"}">
              <p>Stock Disponible: ${producto.stock_actual !== undefined ? producto.stock_actual : "No disponible"}</p>
            </div>
          `;
        }
      } else {
        html += `<div class="cantidad-producto"><a href="/productos/${producto.id}" class="card-link">Ver detalles</a></div>`;
      }

      html += `</div>`;
      const tarjetaProducto = document.createElement("div");
      tarjetaProducto.innerHTML = html;
      contenedorProductos.appendChild(tarjetaProducto);
    });

    agregarEventosCarrusel(contenedorProductos);
  }

  function agregarEventosCarrusel(contenedor) {
    contenedor.querySelectorAll(".card").forEach((tarjeta) => {
      const leftButton = tarjeta.querySelector(".carousel__button--left");
      const rightButton = tarjeta.querySelector(".carousel__button--right");
      const images = tarjeta.querySelectorAll(".carousel__image");
      let currentIndex = 0;

      if (leftButton && rightButton && images.length > 1) {
        leftButton.addEventListener("click", () => {
          images[currentIndex].classList.add("hidden");
          currentIndex = (currentIndex === 0) ? images.length - 1 : currentIndex - 1;
          images[currentIndex].classList.remove("hidden");
        });

        rightButton.addEventListener("click", () => {
          images[currentIndex].classList.add("hidden");
          currentIndex = (currentIndex === images.length - 1) ? 0 : currentIndex + 1;
          images[currentIndex].classList.remove("hidden");
        });
      }
    });
  }
});

  // Lógica para el carrusel
  $(document).on('click', '.carousel__button', function() {
      var $carousel = $(this).closest('.card').find('.carousel');
      var $images = $carousel.find('.carousel__image');
      var index = $images.index($carousel.find('.carousel__image:visible'));

      if ($(this).find('.fa-chevron-left').length > 0) {
          $images.eq(index).hide();
          index--;
          if (index < 0) {
              index = $images.length - 1;
          }
      } else {
          $images.eq(index).hide();
          index++;
          if (index >= $images.length) {
              index = 0;
          }
      }

      $images.eq(index).show();
  });

