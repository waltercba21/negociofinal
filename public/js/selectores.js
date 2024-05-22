// Obtén los selectores
const categoriaSelector = document.getElementById('categoria_id');
const marcaSelector = document.getElementById('marca_id');
const modeloSelector = document.getElementById('modelo_id');

async function renderProductos(busqueda) {
  const respuesta = await fetch(`/productos/api/buscar?q=${busqueda}`);
  const productos = await respuesta.json();

  const contenedorProductos = document.getElementById('contenedor-productos');
  contenedorProductos.innerHTML = '';

  productos.forEach((producto, index) => {
    let imagenes = '';
    if (producto.imagenes && producto.imagenes.length > 0) {
      producto.imagenes.forEach((imagen, i) => {
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

  // Ahora que las tarjetas de productos se han agregado al DOM, puedes agregar los controladores de eventos a los botones del carrusel
  $(document).on('click', '.carousel__button', function() {
    // ... el código para manejar los eventos de los botones del carrusel ...
  });
}

// Agrega un evento de cambio al selector de marca
marcaSelector.addEventListener('change', function() {
  // Obtén el id de la marca seleccionada
  const marcaId = this.value;

  // Haz una solicitud AJAX para obtener los modelos de esta marca
  fetch(`/modelos/${marcaId}`)
    .then(response => response.json())
    .then(data => {
      // Limpia el selector de modelos
      modeloSelector.innerHTML = '<option value="" selected>Selecciona un modelo...</option>';

      // Llena el selector de modelos con los nuevos modelos
      data.forEach(modelo => {
        const option = document.createElement('option');
        option.value = modelo.id;
        option.text = modelo.nombre;
        modeloSelector.appendChild(option);
      });
    });
});

// Agrega un evento de cambio a los selectores de categoría, marca y modelo
[categoriaSelector, marcaSelector, modeloSelector].forEach(selector => {
  selector.addEventListener('change', function() {
    // Obtén los valores seleccionados
    const categoriaId = categoriaSelector.value;
    const marcaId = marcaSelector.value;
    const modeloId = modeloSelector.value;

    // Haz una solicitud AJAX para obtener los productos que coinciden con los criterios seleccionados
    const busqueda = `categoria_id=${categoriaId}&marca_id=${marcaId}&modelo_id=${modeloId}`;
    renderProductos(busqueda);
  });
});