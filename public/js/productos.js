$(document).ready(function() {
  $('.carousel').each(function() {
    var $carousel = $(this);
    var $images = $carousel.find('.carousel__image');
    var $prevButton = $carousel.closest('.card').find('.carousel__button:has(.fa-chevron-left)');
    var $nextButton = $carousel.closest('.card').find('.carousel__button:has(.fa-chevron-right)');
    var index = 0;

    // Ocultar todas las imágenes excepto la primera
    $images.hide().eq(index).show();

    $prevButton.on('click', function() {
      console.log('Prev button clicked'); // Añade una traza para verificar el clic
      $images.eq(index).hide();
      index = (index > 0) ? index - 1 : $images.length - 1;
      $images.eq(index).show();
    });

    $nextButton.on('click', function() {
      console.log('Next button clicked'); // Añade una traza para verificar el clic
      $images.eq(index).hide();
      index = (index < $images.length - 1) ? index + 1 : 0;
      $images.eq(index).show();
    });
  });
});

