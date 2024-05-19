$(document).ready(function() {
    $('.carousel').each(function() {
      var $carousel = $(this);
      var $images = $carousel.find('.carousel__image');
      var $prevButton = $carousel.find('.carousel__button--prev');
      var $nextButton = $carousel.find('.carousel__button--next');
      var index = 0;
  
      $prevButton.click(function() {
        $images.eq(index).hide();
        index--;
        if (index < 0) {
          index = $images.length - 1;
        }
        $images.eq(index).show();
      });
  
      $nextButton.click(function() {
        $images.eq(index).hide();
        index++;
        if (index >= $images.length) {
          index = 0;
        }
        $images.eq(index).show();
      });
    });
  });