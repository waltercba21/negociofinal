document.getElementById('marca_id').addEventListener('change', function() {
  const marcaId = this.value;
  fetch('/productos/modelos/' + marcaId)
      .then(response => response.json())
      .then(modelos => {
          const modeloSelect = document.getElementById('modelo_id');
          modeloSelect.innerHTML = '';

          // Agrega la opción "Selecciona un modelo"
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

const categoriaSelect = document.getElementById('categoria_id');
const marcaSelect = document.getElementById('marca_id');
const modeloSelect = document.getElementById('modelo_id');

marcaSelect.addEventListener('change', function() {
  const marcaId = this.value;
  fetch('/productos/modelos/' + marcaId)
      .then(response => response.json())
      .then(modelos => {
          const modeloSelect = document.getElementById('modelo_id');
          modeloSelect.innerHTML = '';

          // Agrega la opción "Selecciona un modelo"
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
function actualizarProductos() {
  const categoria = categoriaSelect.value;
  const marca = marcaSelect.value;
  const modelo = modeloSelect.value;

  // Construye la URL con los parámetros de consulta
  let url = '/productos/?';
  if (categoria) url += 'categoria=' + categoria + '&';
  if (marca) url += 'marca=' + marca + '&';
  if (modelo) url += 'modelo=' + modelo;

  fetch(url)
    .then(response => response.json())
    .then(productos => {
      const contenedorProductos = document.getElementById('contenedor-productos');
      contenedorProductos.innerHTML = '';

      productos.forEach(producto => {
        const card = document.createElement('div');
        card.className = 'card';

        // Agrega las imágenes del producto
        if (producto.imagenes && producto.imagenes.length > 0) {
          const coverCard = document.createElement('div');
          coverCard.className = 'cover__card';
          const carousel = document.createElement('div');
          carousel.className = 'carousel';
          producto.imagenes.forEach((imagen, index) => {
            const img = document.createElement('img');
            img.className = 'carousel__image' + (index !== 0 ? ' hidden' : '');
            img.src = '../../uploads/productos/' + imagen.imagen;
            img.alt = 'Imagen de ' + producto.nombre;
            carousel.appendChild(img);
          });
          coverCard.appendChild(carousel);
          card.appendChild(coverCard);
        } else {
          const img = document.createElement('img');
          img.src = '/ruta/valida/a/imagen/por/defecto.jpg';
          img.alt = 'Imagen de ' + producto.nombre;
          card.appendChild(img);
        }

        // Agrega el nombre del producto
        const tituloProducto = document.createElement('div');
        tituloProducto.className = 'titulo-producto';
        const h3 = document.createElement('h3');
        h3.className = 'nombre';
        h3.textContent = producto.nombre;
        tituloProducto.appendChild(h3);
        card.appendChild(tituloProducto);

        // Agrega la categoría del producto
        const categoriaProducto = document.createElement('div');
        categoriaProducto.className = 'categoria-producto';
        const h6 = document.createElement('h6');
        h6.className = 'categoria';
        h6.textContent = producto.categoria;
        categoriaProducto.appendChild(h6);
        card.appendChild(categoriaProducto);

        // Agrega la descripción del producto
        const descripcion = document.createElement('div');
        descripcion.className = 'descripcion';
        descripcion.style.display = 'none';
        descripcion.textContent = producto.descripcion;
        card.appendChild(descripcion);

        // Agrega el precio del producto
        const precioProducto = document.createElement('div');
        precioProducto.className = 'precio-producto';
        const p = document.createElement('p');
        p.className = 'precio';
        p.textContent = '$' + (typeof producto.precio_venta === 'number' ? Math.floor(producto.precio_venta).toLocaleString('de-DE') : producto.precio_venta);
        precioProducto.appendChild(p);
        card.appendChild(precioProducto);

        // Agrega el enlace a los detalles del producto
        const cantidadProducto = document.createElement('div');
        cantidadProducto.className = 'cantidad-producto';
        const a = document.createElement('a');
        a.href = '/productos/' + producto.id;
        a.className = 'card-link';
        a.textContent = 'Ver detalles';
        cantidadProducto.appendChild(a);
        card.appendChild(cantidadProducto);

        contenedorProductos.appendChild(card);
      });
    })
    .catch(error => console.error('Error:', error));
}
categoriaSelect.addEventListener('change', actualizarProductos);
marcaSelect.addEventListener('change', actualizarProductos);
modeloSelect.addEventListener('change', actualizarProductos);