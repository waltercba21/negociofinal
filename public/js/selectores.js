document.addEventListener('DOMContentLoaded', function() {
  let marcaSelect = document.querySelector('#id_marca');
  let modeloSelect = document.querySelector('#modelo_id');
  let contenedorProductos = document.querySelector('#contenedor-productos');

  if (!marcaSelect || !modeloSelect || !contenedorProductos) {
    return;
  }

  marcaSelect.addEventListener('change', function() {
    modeloSelect.innerHTML = '';

    fetch(`/productos/modelos/${marcaSelect.value}`)
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
          modeloSelect.appendChild(option);
        });
      })
      .catch(error => {
        console.error('Hubo un problema con la solicitud: ' + error);
      });
  });

  modeloSelect.addEventListener('change', buscarProductos);

  function buscarProductos() {
    const url = `/productos/api/buscar?marca=${marcaSelect.value}&modelo=${modeloSelect.value}`;
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error('Error HTTP: ' + response.status);
        }
        return response.json();
      })
      .then(data => { 
        if (!data || !Array.isArray(data.productos)) {
          console.error('La respuesta del servidor no tiene la forma esperada');
        }
        contenedorProductos.innerHTML = '';

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