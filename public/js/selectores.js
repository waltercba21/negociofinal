$(document).ready(function(){
  $('#id_marca').change(function(){
    var marcaId = $(this).val();
    console.log('Marca ID:', marcaId); // Agrega esta línea
    $.ajax({
      url: '/productos/modelos/' + marcaId,
      type: 'GET',
      success: function(data) {
        console.log('Data de Modelos:', data); // Agrega esta línea
        $('#modelo_id').html('<option value="">Selecciona un modelo...</option>');
        data.forEach(function(modelo) {
          $('#modelo_id').append('<option value="' + modelo.id + '">' + modelo.nombre + '</option>');
        });
      }
    });
  });

  $('#categoria_id').change(function(){ 
    var categoriaId = $(this).val();
    console.log('Categoria ID:', categoriaId); // Agrega esta línea
    $.ajax({
      url: '/productos/marcas/' + categoriaId,
      type: 'GET',
      success: function(data) {
        console.log('Data de Marcas:', data); // Agrega esta línea
        $('#id_marca').html('<option value="">Selecciona una marca...</option>');
        data.forEach(function(marca) {
          $('#id_marca').append('<option value="' + marca.id + '">' + marca.nombre + '</option>');
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
            '<div class="descripcion" style="display: none;">' +
            producto.descripcion +
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
  $('body').on('click', '.card', function(){
    var card = $(this);
    card.addClass('card-ampliada');
    card.find('.descripcion').css('font-weight', 'bold').show();
    if ($('.fondo-oscuro').length === 0) {  
      $('body').append('<div class="fondo-oscuro"></div>');
    }
  });
  
  $('body').on('click', '.fondo-oscuro', function(event){
    if (!$(event.target).closest('.card').length) {
      var card = $('.card-ampliada');
      card.removeClass('card-ampliada');
      card.find('.descripcion').hide();
      $(this).remove();
    }
  });
});

document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('click', function() {
    const idProducto = this.querySelector('.agregar-carrito').href.split('/').pop();
    window.location.href = `/productos/${idProducto}`;
  });
});