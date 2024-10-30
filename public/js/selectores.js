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
  const selectores = document.querySelectorAll('#categoria_id, #marca_id, #modelo_id');
  const contenedorProductos = document.getElementById('contenedor-productos');

  selectores.forEach(selector => {
    selector.addEventListener('change', function() {
      const categoria_id = document.getElementById('categoria_id').value;
      const marca_id = document.getElementById('marca_id').value;
      const modelo_id = document.getElementById('modelo_id').value;

      // Construir la URL solo con los parámetros que tengan valor
      let url = '/productos/api/buscar?';
      if (categoria_id) url += `categoria_id=${categoria_id}&`;
      if (marca_id) url += `marca_id=${marca_id}&`;
      if (modelo_id) url += `modelo_id=${modelo_id}`;

      // Remover cualquier '&' al final de la URL si existe
      url = url.replace(/&$/, '');

      // Validar que hay al menos un criterio de búsqueda
      if (categoria_id || marca_id || modelo_id) {
        console.log('URL de búsqueda:', url);

        fetch(url, { timeout: 10000 }) // Tiempo límite de 10 segundos
          .then(response => {
            if (!response.ok) {
              throw new Error('Network response was not ok');
            }
            return response.json();
          })
          .then(productos => {
            renderizarProductos(productos, contenedorProductos, false);
          })
          .catch(error => {
            console.error('Error:', error);
          });
      } else {
        console.log("Seleccione al menos una categoría, marca o modelo para realizar la búsqueda.");
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

