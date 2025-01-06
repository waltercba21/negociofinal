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
document.addEventListener('DOMContentLoaded', () => {
  const botonesAgregarCarrito = document.querySelectorAll('.btn-agregar-carrito');

  botonesAgregarCarrito.forEach(boton => {
    boton.addEventListener('click', () => {
      const productoId = boton.getAttribute('data-id');
      const cantidadInput = document.getElementById(`cantidad-${productoId}`);
      const cantidad = parseInt(cantidadInput.value, 10);

      if (cantidad > 0) {
        // Enviar datos al servidor
        fetch('/carrito/agregar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: productoId, cantidad }),
        })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              alert('Producto agregado al carrito con éxito.');
            } else {
              alert('Error al agregar el producto al carrito.');
            }
          })
          .catch(error => console.error('Error:', error));
      } else {
        alert('Por favor, selecciona una cantidad válida.');
      }
    });
  });
});
