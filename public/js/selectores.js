document.getElementById('marca_id').addEventListener('change', function() {
  const marcaId = this.value;
  fetch('/productos/modelos/' + marcaId)
      .then(response => response.json())
      .then(modelos => {
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
      .catch(error => console.error('Error:', error));
});
document.addEventListener('DOMContentLoaded', function() {
  const contenedorProductos = document.getElementById('contenedor-productos');
  const categoriaSelect = document.getElementById('categoria_id');
  const marcaSelect = document.getElementById('marca_id');
  const modeloSelect = document.getElementById('modelo_id');
  const productosPorPagina = 20; // Número de productos a mostrar por página
  let paginaActual = 1; // Página inicial

  categoriaSelect.addEventListener('change', realizarBusqueda);
  marcaSelect.addEventListener('change', function() {
    const marcaId = this.value;

    // Cargar modelos relacionados a la marca seleccionada
    if (marcaId) {
      fetch(`/productos/modelos/${marcaId}`)
        .then(response => response.json())
        .then(modelos => {
          modelos.sort((a, b) => a.nombre.localeCompare(b.nombre));
          modeloSelect.innerHTML = '<option value="">Selecciona un modelo</option>';
          modelos.forEach(modelo => {
            const option = document.createElement('option');
            option.value = modelo.id;
            option.text = modelo.nombre;
            modeloSelect.appendChild(option);
          });
          realizarBusqueda(); // Ejecuta la búsqueda en caso de que ya haya datos seleccionados
        })
        .catch(error => console.error('Error:', error));
    } else {
      modeloSelect.innerHTML = '<option value="">Selecciona un modelo</option>';
    }
  });
  modeloSelect.addEventListener('change', realizarBusqueda);

  function realizarBusqueda() {
    const categoria_id = categoriaSelect.value;
    const marca_id = marcaSelect.value;
    const modelo_id = modeloSelect.value;

    // Construir la URL con los parámetros y la paginación
    let url = `/productos/api/buscar?limite=${productosPorPagina}&pagina=${paginaActual}&`;
    if (categoria_id) url += `categoria_id=${categoria_id}&`;
    if (marca_id) url += `marca_id=${marca_id}&`;
    if (modelo_id) url += `modelo_id=${modelo_id}`;
    url = url.replace(/&$/, ''); // Remueve '&' extra al final de la URL

    if (categoria_id || marca_id || modelo_id) {
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error('Error en la red');
          return response.json();
        })
        .then(data => {
          const productos = data.productos || [];
          if (productos.length === 0) {
            contenedorProductos.innerHTML = '<p>No se encontraron productos. Refinar la búsqueda.</p>';
          } else {
            renderizarProductos(productos, contenedorProductos, false);
            if (productos.length < productosPorPagina) {
              contenedorProductos.innerHTML += '<p>Mostrando todos los resultados disponibles.</p>';
            }
          }
        })
        .catch(error => console.error('Error:', error));
    } else {
      contenedorProductos.innerHTML = "<p>Seleccione al menos una categoría, marca o modelo para realizar la búsqueda.</p>";
    }
  }

  function renderizarProductos(productos, contenedorProductos, isAdminUser) {
    contenedorProductos.innerHTML = '';
    productos.forEach(producto => {
      const imagenes = producto.imagenes?.map((img, i) => `
        <img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${img.imagen}" alt="Imagen de ${producto.nombre}">
      `).join('') || '<img src="/ruta/a/imagen/defecto.jpg" alt="Imagen no disponible">';

      const precioVenta = producto.precio_venta ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}` : 'Precio no disponible';

      let tarjetaProducto = `
        <div class="card">
          <div class="carousel">
            ${imagenes}
          </div>
          <div class="titulo-producto"><h3 class="nombre">${producto.nombre}</h3></div>
          <hr>
          <div class="precio-producto"><p class="precio">${precioVenta}</p></div>
          <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
        </div>
      `;

      if (isAdminUser) {
        tarjetaProducto += `
          <div class="stock-producto ${producto.stock_actual < producto.stock_minimo ? 'bajo-stock' : 'suficiente-stock'}">
            <p>Stock Disponible: ${producto.stock_actual}</p>
          </div>
        `;
      }

      contenedorProductos.innerHTML += tarjetaProducto;
    });
  }

  // Control de carrusel
  $(document).on('click', '.carousel__button', function() {
    const $carousel = $(this).closest('.card').find('.carousel');
    const $images = $carousel.find('.carousel__image');
    let index = $images.index($carousel.find('.carousel__image:visible'));

    if ($(this).find('.fa-chevron-left').length > 0) {
      $images.eq(index).hide();
      index = (index - 1 + $images.length) % $images.length;
    } else {
      $images.eq(index).hide();
      index = (index + 1) % $images.length;
    }

    $images.eq(index).show();
  });
});
