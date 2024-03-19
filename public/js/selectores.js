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
            '<div class="precio-producto">' +
            '<p class="precio">$' + producto.precio + '</p>' +
            '</div>' +
            '<div class="cantidad-producto">' +
            '<a href="/productos/carrito/agregar/' + producto.id + '" class="agregar-carrito">Agregar al carrito</a>' +
            '</div>' +
            '</div>';
          $('#contenedor-productos').append(productoHtml);
        });
      }
    });
  });

  $('body').on('click', '.cover__card img', function(){
    var card = $(this).closest('.card');
    var clonedCard = card.clone(true); // Clona la tarjeta, incluyendo los manejadores de eventos
    card.addClass('card-ampliada');
    card.find('.descripcion').show();
    $('body').append('<div class="fondo-oscuro"></div>');
    $('body').append(clonedCard); // Mover la tarjeta clonada al cuerpo del documento
    clonedCard.hide(); // Oculta la tarjeta clonada
  });
  
  $('body').on('click', '.fondo-oscuro', function(){
    var card = $('.card-ampliada');
    card.removeClass('card-ampliada').find('.descripcion').hide();
    $('.card').not(card).remove(); // Elimina todas las tarjetas clonadas
    $(this).remove();
  });
});