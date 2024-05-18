$(document).ready(function(){
  $('#entradaBusqueda').on('input', function() {
    var query = $(this).val();
    if (query.length > 2) { 
      $.ajax({
        url: '/api/buscar',
        data: {
          query: query
        },
        success: function(data) {
          $('#contenedor-productos').empty();
          data.forEach(function(producto) {
            var html = '<div class="card">' +
              '<div class="cover__card">' +
              '<img src="' + (producto.imagen ? '../../uploads/productos/' + producto.imagen : '/ruta/valida/a/imagen/por/defecto.jpg') + '" alt="Imagen de ' + producto.nombre + '">' +
              '</div>' +
              '<div class="titulo-producto">' +
              '<h3 class="nombre">' + producto.nombre + '</h3>' +
              '</div>' +
              '<hr>' +
              '<div class="categoria-producto">' +
              '<h6 class="categoria">' + producto.categoria + '</h6>' +
              '</div>' +
              '<div class="descripcion" style="display: none;">' +
              producto.descripcion +
              '</div>' +
              '<div class="precio-producto">' +
              '<p class="precio">$' + (typeof producto.precio_venta === 'number' ? Math.floor(producto.precio_venta).toLocaleString('de-DE') : producto.precio_venta) + '</p>' +
              '</div>' +
              '<div class="cantidad-producto">' +
              '<a href="/productos/carrito/agregar/' + producto.id + '" class="agregar-carrito">Agregar al carrito</a>' +
              '</div>' +
              '</div>';
            $('#contenedor-productos').append(html);
          });
        }
      });
    }
  });
})