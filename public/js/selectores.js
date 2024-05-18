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
            let card = document.createElement('div');
            card.className = 'card';
      
            let cover = document.createElement('div');
            cover.className = 'cover__card';
            let img = document.createElement('img');
            img.src = `../../uploads/productos/${producto.imagen}`;
            img.alt = `Imagen de ${producto.nombre}`;
            cover.appendChild(img);
      
            let titulo = document.createElement('div');
            titulo.className = 'titulo-producto';
            let h3 = document.createElement('h3');
            h3.className = 'nombre';
            h3.textContent = producto.nombre;
            titulo.appendChild(h3);
      
            let categoria = document.createElement('div');
            categoria.className = 'categoria-producto';
            let h6 = document.createElement('h6');
            h6.className = 'categoria';
            h6.textContent = producto.categoria;
            categoria.appendChild(h6);
      
            let precio = document.createElement('div');
            precio.className = 'precio-producto';
            let p = document.createElement('p');
            p.className = 'precio_venta';
            p.textContent = `$${Math.floor(producto.precio_venta).toLocaleString('es-AR')}`;
            precio.appendChild(p);
      
            let cantidad = document.createElement('div');
            cantidad.className = 'cantidad-producto';
            let a = document.createElement('a');
            a.href = `/productos/carrito/agregar/${producto.id}`;
            a.className = 'agregar-carrito';
            a.textContent = 'Agregar al carrito';
            cantidad.appendChild(a);
      
            card.appendChild(cover);
            card.appendChild(titulo);
            card.appendChild(document.createElement('hr'));
            card.appendChild(categoria);
            card.appendChild(document.createElement('hr'));
            card.appendChild(precio);
            card.appendChild(cantidad);
      
            contenedorProductos.appendChild(card);
          });
        }
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