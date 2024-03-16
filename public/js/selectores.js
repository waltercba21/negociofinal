$(document).ready(function(){
  $('#id_marca').change(function(){
    var marcaId = $(this).val();
    $.ajax({
      url: '/productos/modelos/' + marcaId,
      type: 'GET',
      success: function(data) {
        $('#modelo_id').html('<option value="">Selecciona un modelo...</option>');
        data.forEach(function(modelo) {
          $('#modelo_id').append('<option value="' + modelo.id + '">' + modelo.nombre + '</option>');
        });
      }
    });
  });

  $('#boton-buscar').click(function(){
    var categoriaId = $('#categoria_id').val();
    var marcaId = $('#id_marca').val();
    var modeloId = $('#modelo_id').val();
    $.ajax({
      url: '/productos/buscar',
      type: 'GET',
      data: {
        categoria_id: categoriaId,
        marca_id: marcaId,
        modelo_id: modeloId
      },
      success: function(data) {
        $('#contenedor-productos').empty();
        data.forEach(function(producto) {
          var productoHtml = '<div class="card">' +
            '<div class="cover__card">' +
            '<img src="../../images/' + producto.imagen + '" alt="Imagen de ' + producto.nombre + '">' +
            '</div>' +
            '<div class="titulo-producto">' +
            '<h3 class="nombre">' + producto.nombre + '</h3>' +
            '</div>' +
            '<hr>' +
            '<div class="categoria-producto">' +
            '<h6 class="categoria">' + producto.categoria + '</h6>' +
            '</div>' +
            '<hr>' +
            '<div class="descripcion" style="display: none;">' + producto.descripcion + '</div>' +
            '<hr>' +
            '<div class="precio-producto">' +
            '<p class="precio">$' + producto.precio + '</p>' +
            '</div>' +
            '<div class="cantidad-producto">' +
            '<a href="/productos/carrito/agregar/' + producto.id + '" class="agregar-carrito">Agregar al carrito</a>' +
            '</div>' +
            '</div>';
          $('#contenedor-productos').append(productoHtml);
        });
        asignarEventoClickACard();
      }
    });
  });

  function asignarEventoClickACard() {
    $('.card').click(function() {
      $(this).addClass('card-seleccionada card-centrada');
      $(this).find('.descripcion').show();
      let fondoOscuro = $('<div>').addClass('fondo-oscuro');
      $('body').append(fondoOscuro);
    });
  
    $('body').on('click', '.fondo-oscuro', function() {
      $('.card-seleccionada').removeClass('card-seleccionada card-centrada');
      $('.card-seleccionada .descripcion').hide();
      $('.fondo-oscuro').remove();
    });
  }

  asignarEventoClickACard();
});