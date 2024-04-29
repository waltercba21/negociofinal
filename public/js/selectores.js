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
          const tarjetaProducto = `
          <div class="card"> 
          <div class="cover__card">
            <img src="../../uploads/productos/${producto.imagen}" alt="Imagen de ${producto.nombre}">
          </div>
          <div class="titulo-producto">
            <h3 class="nombre">${producto.nombre}</h3>
          </div>
          <hr>
          <div class="categoria-producto">
            <h6 class="categoria">${producto.categoria_nombre}</h6>
          </div>
          <hr>
          <div class="precio-producto">
            <p class="precio">$${producto.precio}</p>
          </div>
          <div class="cantidad-producto">
            <a href="/productos/carrito/agregar/${producto.id}" class="agregar-carrito">Agregar al carrito</a>
          </div>
        </div>
      `;
          contenedorProductos.innerHTML += tarjetaProducto;
        });
      }
    }
  
    categoriaSelector.addEventListener('change', obtenerProductosFiltrados);
    marcaSelector.addEventListener('change', function() {
      modeloSelector.innerHTML = '';
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
          obtenerProductosFiltrados();
        })
        .catch(error => {
          console.error('Hubo un problema con la solicitud: ' + error);
        });
    });
    modeloSelector.addEventListener('change', obtenerProductosFiltrados);
    entrada.addEventListener('input', obtenerProductosFiltrados);
  });