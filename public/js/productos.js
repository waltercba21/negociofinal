$(document).ready(function() {
  $('.carousel').each(function() {
    var $carousel = $(this);
    var $images = $carousel.find('.carousel__image');
    var $prevButton = $carousel.closest('.card').find('.carousel__button:has(.fa-chevron-left)');
    var $nextButton = $carousel.closest('.card').find('.carousel__button:has(.fa-chevron-right)');
    var index = 0;

    // Inicializar mostrando solo la primera imagen
    $images.hide().eq(index).show();

    $prevButton.on('click', function() {
      $images.eq(index).hide();
      index = (index > 0) ? index - 1 : $images.length - 1;
      $images.eq(index).show();
    });

    $nextButton.on('click', function() {
      $images.eq(index).hide();
      index = (index < $images.length - 1) ? index + 1 : 0;
      $images.eq(index).show();
    });
  });
});
