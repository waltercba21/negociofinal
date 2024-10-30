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

// Escucha el cambio en los selectores de categoría, marca y modelo
document.addEventListener('DOMContentLoaded', function() {
  const selectores = document.querySelectorAll('#categoria_id, #marca_id, #modelo_id');
  const contenedorProductos = document.getElementById('contenedor-productos');
  
  selectores.forEach(selector => {
      selector.addEventListener('change', function() {
          // Obtener los valores seleccionados de los selectores
          const categoria_id = document.getElementById('categoria_id').value;
          const marca_id = document.getElementById('marca_id').value;
          const modelo_id = document.getElementById('modelo_id').value;

          // Log para depuración
          console.log('Valores seleccionados - Categoría:', categoria_id, 'Marca:', marca_id, 'Modelo:', modelo_id);

          // Mostrar un mensaje de carga
          contenedorProductos.innerHTML = '<p>Cargando productos...</p>';

          // Hacer la solicitud a la API para buscar productos
          fetch(`/productos/api/buscar?categoria_id=${categoria_id}&marca_id=${marca_id}&modelo_id=${modelo_id}`)
              .then(response => {
                  if (!response.ok) {
                      console.error('Error en la respuesta de la API:', response.status);
                      throw new Error('Error en la respuesta de la API');
                  }
                  return response.json();
              })
              .then(productos => {
                  console.log('Productos devueltos de la API:', productos); // Log de productos devueltos
                  renderizarProductos(productos); // Llamada a la función para renderizar productos
              })
              .catch(error => {
                  console.error('Error al buscar productos:', error);
                  contenedorProductos.innerHTML = '<p>Error al cargar los productos. Intenta nuevamente.</p>'; // Mensaje de error
              });
      });
  });

  // Función para renderizar los productos
  function renderizarProductos(productos) {
      console.log('Productos a renderizar:', productos);
      contenedorProductos.innerHTML = ''; // Limpiar contenedor antes de agregar nuevos productos

      // Comprobar si hay productos
      if (productos.length === 0) {
          contenedorProductos.innerHTML = '<p>No se encontraron productos.</p>';
          return;
      }

      productos.forEach(producto => {
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
                      <button class="carousel__button">
                          <i class="fas fa-chevron-left"></i>
                      </button>
                      <button class="carousel__button">
                          <i class="fas fa-chevron-right"></i>
                      </button>
                  </div>
              `;
          } else {
              imagenes = '<img src="/ruta/valida/a/imagen/por/defecto.jpg" alt="Imagen de ${producto.nombre}">';
          }

          const precio_venta = producto.precio_venta ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}` : 'Precio no disponible';
          let tarjetaProducto = `
              <div class="card"> 
                  ${imagenes}
                  <div class="titulo-producto">
                      <h3 class="nombre">${producto.nombre}</h3>
                  </div>
                  <hr>
                  <div class="precio-producto">
                      <p class="precio">${precio_venta}</p>
                  </div>
                  <div class="cantidad-producto">
                      <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
                  </div>
          `;
          tarjetaProducto += '</div>'; // Cerrar tarjeta
          contenedorProductos.innerHTML += tarjetaProducto; // Agregar tarjeta al contenedor
      });
  }

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
});
