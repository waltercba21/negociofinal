document.addEventListener('DOMContentLoaded', function() {
    const entrada = document.querySelector('#entradaBusqueda');
    const contenedorProductos = document.querySelector('#contenedor-productos');
    const categoriaSelector = document.querySelector('#categoria_id');
    const marcaSelector = document.querySelector('#id_marca');
    const modeloSelector = document.querySelector('#modelo_id');
  
    function obtenerProductosFiltrados() {
      const categoria = categoriaSelector.value;
      const marca = marcaSelector.value;
      const modelo = modeloSelector.value;
      const consulta = entrada.value;
  
      let url = 'http://www.autofaros.com.ar/productos/api/buscar';
      let params = new URLSearchParams();
      if (consulta) {
        params.append('query', consulta);
      }
      if (categoria) {
        params.append('categoria', categoria);
      }
      if (marca) {
        params.append('marca', marca);
      }
      if (modelo) {
        params.append('modelo', modelo);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      fetch(url, {mode:'cors', credentials:'include'})
      .then(response => {
        if (!response.ok) {
          throw new Error('Error HTTP: ' + response.status);
        }
        return response.json();
      })
      .then(datos => {
        mostrarProductos(datos.productos);
      })
      .catch(error => {
        console.error('Hubo un problema con la solicitud: ' + error);
      });
    }
  
    function mostrarProductos(productos) {
      contenedorProductos.innerHTML = '';
      if (productos.length === 0) {
        contenedorProductos.innerHTML = '<p>No se encontraron productos que coincidan con los criterios seleccionados.</p>';
      } else {
        productos.forEach(producto => {
          let imagenes = '';
          if (producto.imagenes && producto.imagenes.length > 0) {
            producto.imagenes.forEach((imagen, i) => {
              imagenes += `<img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="../../uploads/productos/${imagen.imagen}" alt="Imagen de ${producto.nombre}">`;
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
          const precio_venta = producto.precio_venta ? `$${Math.floor(producto.precio_venta).toLocaleString('es-AR')}` : 'Precio no disponible';
          const tarjetaProducto = `
            <div class="card"> 
              ${imagenes}
              <div class="titulo-producto">
                <h3 class="nombre">${producto.nombre}</h3>
              </div>
              <hr>
              <div class="categoria-producto">
                <h6 class="categoria">${producto.categoria}</h6>
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
      $('.carousel').each(function() {
        var $carousel = $(this);
        var $images = $carousel.find('.carousel__image');
        var $prevButton = $carousel.closest('.card').find('.carousel__button:has(.fa-chevron-left)');
        var $nextButton = $carousel.closest('.card').find('.carousel__button:has(.fa-chevron-right)');
        var index = 0;
    
        $prevButton.click(function() {
          $images.eq(index).hide();
          index--;
          if (index < 0) {
            index = $images.length - 1;
          }
          $images.eq(index).show();
        });
    
        $nextButton.click(function() {
          $images.eq(index).hide();
          index++;
          if (index >= $images.length) {
            index = 0;
          }
          $images.eq(index).show();
        });
      });
    }
    categoriaSelector.addEventListener('change', obtenerProductosFiltrados);

marcaSelector.addEventListener('change', function() {
  modeloSelector.innerHTML = '';
  let defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.text = 'Seleccione un modelo'; 
  modeloSelector.appendChild(defaultOption);
  fetch(`/productos/modelos/${marcaSelector.value}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Error HTTP: ' + response.status);
      }
      return response.json();
    })
    .then(modelos => {
      modelos.forEach(modelo => {
        let option = document.createElement('option');
        option.value = modelo.id;
        option.text = modelo.nombre; 
        modeloSelector.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Hubo un problema con la solicitud: ' + error);
    });
});
    modeloSelector.addEventListener('change', obtenerProductosFiltrados);
    entrada.addEventListener('input', obtenerProductosFiltrados);
  });