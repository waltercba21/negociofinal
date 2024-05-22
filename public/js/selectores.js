document.getElementById('id_marca').addEventListener('change', async () => {
  let marca_id = document.getElementById('id_marca').value;

  // Convertir cadenas vacías a NULL
  marca_id = marca_id !== '' ? marca_id : null;

  const respuesta = await fetch(`/modelos/${marca_id}`);
  const modelos = await respuesta.json();

  const selectorModelos = document.getElementById('modelo_id');
  selectorModelos.innerHTML = '';

  modelos.forEach((modelo) => {
    const opcion = document.createElement('option');
    opcion.value = modelo.id;
    opcion.text = modelo.nombre;
    selectorModelos.add(opcion);
  });
});

const selectores = ['categoria_id', 'id_marca', 'modelo_id'];

selectores.forEach(selector => {
  document.getElementById(selector).addEventListener('change', async () => {
    let categoria_id = document.getElementById('categoria_id').value;
    let marca_id = document.getElementById('id_marca').value;
    let modelo_id = document.getElementById('modelo_id').value;

    // Convertir cadenas vacías a NULL
    categoria_id = categoria_id !== '' ? categoria_id : null;
    marca_id = marca_id !== '' ? marca_id : null;
    modelo_id = modelo_id !== '' ? modelo_id : null;

    const respuesta = await fetch(`/productos/api/${categoria_id}/${marca_id}/${modelo_id}`);
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
});