document.addEventListener('DOMContentLoaded', function() {
    const contenedorProductos = document.querySelector('.contenedor-productos');
    const tarjetas = document.querySelectorAll('.card-oferta');
    const flechaIzquierda = document.querySelector('.flecha-izquierda');
    const flechaDerecha = document.querySelector('.flecha-derecha');
  
    let index = 0;
    const tarjetasPorPagina = 3;
  
    function mostrarTarjetas() {
      tarjetas.forEach((tarjeta, i) => {
        tarjeta.style.display = 'none';
        if (i >= index && i < index + tarjetasPorPagina) {
          tarjeta.style.display = 'flex';
        }
      });
    }
  
    flechaDerecha.addEventListener('click', function() {
      if (index + tarjetasPorPagina < tarjetas.length) {
        index += tarjetasPorPagina;
        mostrarTarjetas();
      }
    });
  
    flechaIzquierda.addEventListener('click', function() {
      if (index - tarjetasPorPagina >= 0) {
        index -= tarjetasPorPagina;
        mostrarTarjetas();
      }
    });
  
    mostrarTarjetas();
  });
  