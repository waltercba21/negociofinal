document.addEventListener('DOMContentLoaded', function() {
  const selectores = document.querySelectorAll('#categoria_id, #marca_id, #modelo_id');
  const contenedorProductos = document.getElementById('contenedor-productos');
  const productosPorPagina = 20; // Definir el número de productos a mostrar por página

  selectores.forEach(selector => {
    selector.addEventListener('change', function() {
      const categoria_id = document.getElementById('categoria_id').value;
      const marca_id = document.getElementById('marca_id').value;
      const modelo_id = document.getElementById('modelo_id').value;

      // Construir la URL con los parámetros que tengan valor
      let url = `/productos/api/buscar?pagina=1&limite=${productosPorPagina}&`;
      if (categoria_id) url += `categoria_id=${categoria_id}&`;
      if (marca_id) url += `marca_id=${marca_id}&`;
      if (modelo_id) url += `modelo_id=${modelo_id}`;

      // Remover cualquier '&' al final de la URL si existe
      url = url.replace(/&$/, '');

      if (categoria_id || marca_id || modelo_id) {
        fetch(url)
          .then(response => response.json())
          .then(data => {
            const productos = data.productos || [];
            if (productos.length === 0) {
              contenedorProductos.innerHTML = '<p>No se encontraron productos. Refinar la búsqueda.</p>';
            } else {
              renderizarProductos(productos, contenedorProductos, false);
            }
          })
          .catch(error => {
            console.error('Error:', error);
          });
      } else {
        contenedorProductos.innerHTML = "<p>Seleccione al menos una categoría, marca o modelo para realizar la búsqueda.</p>";
      }
    });
  });

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
});


  function realizarBusqueda() {
      const categoria_id = categoriaSelect.value;
      const marca_id = marcaSelect.value;
      const modelo_id = modeloSelect.value;

      let url = `/productos/api/buscar?`;
      if (categoria_id) url += `categoria_id=${categoria_id}&`;
      if (marca_id) url += `marca_id=${marca_id}&`;
      if (modelo_id) url += `modelo_id=${modelo_id}`;

      url = url.replace(/&$/, ''); 
      if (categoria_id || marca_id || modelo_id) {
          fetch(url)
              .then(response => {
                  if (!response.ok) throw new Error('Error en la red');
                  return response.json();
              })
              .then(productos => {
                  renderizarProductos(productos, contenedorProductos, false);
              })
              .catch(error => console.error('Error:', error));
      } else {
          console.log("Seleccione al menos una categoría, marca o modelo.");
      }
  }

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
