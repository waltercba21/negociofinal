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

          fetch(`/productos/api/buscar?categoria_id=${categoria_id}&marca_id=${marca_id}&modelo_id=${modelo_id}`)
          .then(response => {
              if (response.status === 502) {
                  console.error('Error 502: Bad Gateway');
                  throw new Error('Bad Gateway');
              }
              if (!response.ok) {
                  console.error('Response status:', response.status);
                  return response.text().then(text => {
                      console.error('Response text:', text);
                      throw new Error('Network response was not ok');
                  });
              }
              return response.json();
          })
          .then(productos => {
              console.log(productos); 
              renderizarProductos(productos);
          })
          .catch(error => console.error('Error:', error));
      });
  });
  function renderizarProductos(productos) {
      contenedorProductos.innerHTML = '';
      productos.forEach((producto, index) => {
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
        const tarjetaProducto = `
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
        </div>
      `;
      contenedorProductos.innerHTML += tarjetaProducto;
      });
  }

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
