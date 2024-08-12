document.addEventListener('DOMContentLoaded', function() {
    const contenedorProductos = document.querySelector('.contenedor-productos');
    const flechaIzquierda = document.querySelector('.flecha-izquierda');
    const flechaDerecha = document.querySelector('.flecha-derecha');
  
    let scrollAmount = 0;
    const cardWidth = 150; // Ancho de cada tarjeta (sin incluir márgenes)
    const visibleCards = 3; // Número de tarjetas visibles a la vez
  
    flechaDerecha.addEventListener('click', function() {
      const maxScroll = contenedorProductos.scrollWidth - contenedorProductos.clientWidth;
      if (scrollAmount < maxScroll) {
        scrollAmount += cardWidth * visibleCards; // Mueve 3 tarjetas a la vez
        if (scrollAmount > maxScroll) scrollAmount = maxScroll;
        contenedorProductos.scrollTo({
          left: scrollAmount,
          behavior: 'smooth'
        });
      }
    });
  
    flechaIzquierda.addEventListener('click', function() {
      if (scrollAmount > 0) {
        scrollAmount -= cardWidth * visibleCards; // Mueve 3 tarjetas a la vez
        if (scrollAmount < 0) scrollAmount = 0;
        contenedorProductos.scrollTo({
          left: scrollAmount,
          behavior: 'smooth'
        });
      }
    });
  });
  