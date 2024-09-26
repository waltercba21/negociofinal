$(document).ready(function() {
  var $images = $('.carousel__image');
  var index = 0;

  function showImage(newIndex) {
    $images.removeClass('active').hide();
    $images.eq(newIndex).addClass('active').show();
    index = newIndex;
  }

  $('#prevButton').on('click', function() {
    console.log('Prev button clicked'); 
    var newIndex = (index > 0) ? index - 1 : $images.length - 1;
    showImage(newIndex);
  });

  $('#nextButton').on('click', function() {
    console.log('Next button clicked'); 
    var newIndex = (index < $images.length - 1) ? index + 1 : 0;
    showImage(newIndex);
  });
});
$('.card').each(function() {
  var producto = $(this).data('producto');
  if (producto.calidad_original_fitam) {
    $(this).addClass('calidad-original-fitam');
  }
});
