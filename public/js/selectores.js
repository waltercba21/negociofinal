// selectores.js
$(document).ready(function() {
  // Obtén los elementos del DOM
  const categoriaSelector = $('#categoria_id');
  const marcaSelector = $('#id_marca');
  const modeloSelector = $('#modelo_id');
  const contenedorProductos = $('#contenedor-productos');

  // Función para realizar la solicitud AJAX
  function obtenerProductosFiltrados() {
      const categoria = categoriaSelector.val();
      const marca = marcaSelector.val();
      const modelo = modeloSelector.val();

      $.get('/productos/api/buscar', { categoria, marca, modelo }, function(data) {
          renderizarProductos(data.productos);
      });
  }

  // Función para renderizar los productos
  function renderizarProductos(productos) {
      // Limpia el contenedor de productos
      contenedorProductos.empty();

      // Genera el HTML para cada producto
      productos.forEach(producto => {
          const productoHTML = `
              <div class="card">
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
              </div>
          `;

          // Agrega el producto al contenedor
          contenedorProductos.append(productoHTML);
      });
  }

  // Manejadores de eventos para los selectores
  categoriaSelector.change(obtenerProductosFiltrados);
  marcaSelector.change(obtenerProductosFiltrados);
  modeloSelector.change(obtenerProductosFiltrados);
});