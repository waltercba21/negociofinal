document.addEventListener('DOMContentLoaded', function() {
    let marcaSelect = document.querySelector('#id_marca');
    let modeloSelect = document.querySelector('#modelo_id');
    let contenedorProductos = document.querySelector('#contenedor-productos');
  
    if (!marcaSelect || !modeloSelect || !contenedorProductos) {
      console.error('No se encontraron los elementos necesarios en el DOM');
      return;
    }
  
    marcaSelect.addEventListener('change', function() {
      // Limpia el select de modelos
      modeloSelect.innerHTML = '';
  
      // Obtiene los modelos para la marca seleccionada
      fetch(`/productos/modelos/${marcaSelect.value}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Error HTTP: ' + response.status);
          }
          return response.json();
        })
        .then(modelos => {
          // Añade los modelos al select
          modelos.forEach(modelo => {
            let option = document.createElement('option');
            option.value = modelo.id;
            option.text = modelo.nombre;
            modeloSelect.appendChild(option);
          });
        })
        .catch(error => {
          console.error('Hubo un problema con la solicitud: ' + error);
        });
    });

    // Agrega un evento de cambio al selector de modelo
    modeloSelect.addEventListener('change', buscarProductos);
  
    function buscarProductos() {
        fetch(`/productos/api/buscar?marca=${marcaSelect.value}&modelo=${modeloSelect.value}`)
          .then(response => {
            if (!response.ok) {
              throw new Error('Error HTTP: ' + response.status);
            }
            return response.json();
          })
          .then(data => {
            // Imprime los productos para depuración
            console.log(data.productos);
    
            // Limpia el contenedor de productos
            contenedorProductos.innerHTML = '';
    
            // Añade los productos al contenedor
            data.productos.forEach(producto => {
              let div = document.createElement('div');
              div.className = 'card';
              div.innerHTML = `
                <div class="cover__card">
                  <img src="../../uploads/productos/${producto.imagen}" alt="Imagen de ${producto.nombre}">
                </div>
                <div class="titulo-producto">
                  <h3 class="nombre">${producto.nombre}</h3>
                </div>
                <hr>
                <div class="categoria-producto">
                  <h6 class="categoria">${producto.categoria}</h6>
                </div>
                <div class="descripcion" style="display: none;">
                  ${producto.descripcion}
                </div>
                <div class="precio-producto">
                  <p class="precio">$${producto.precio}</p>
                </div>
                <div class="cantidad-producto">
                  <a href="/productos/carrito/agregar/${producto.id}" class="agregar-carrito">Agregar al carrito</a>
                </div>
              `;
              contenedorProductos.appendChild(div);
            });
          })
          .catch(error => {
            console.error('Hubo un problema con la solicitud: ' + error);
          });
      }
  });