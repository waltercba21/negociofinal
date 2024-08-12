document.addEventListener('DOMContentLoaded', function() {
    const contenedorProductos = document.querySelector('.contenedor-productos');
    const tarjetas = document.querySelectorAll('.card-oferta');
    const flechaIzquierda = document.querySelector('.flecha-izquierda');
    const flechaDerecha = document.querySelector('.flecha-derecha');
  
    console.log('Contenedor de productos:', contenedorProductos);
    console.log('Tarjetas:', tarjetas);
    console.log('Flecha izquierda:', flechaIzquierda);
    console.log('Flecha derecha:', flechaDerecha);
  
    let index = 0;
    const tarjetasPorPagina = 3;
  
    function mostrarTarjetas() {
      console.log('Mostrando tarjetas desde índice:', index);
      tarjetas.forEach((tarjeta, i) => {
        if (i >= index && i < index + tarjetasPorPagina) {
          tarjeta.style.display = 'flex';
        } else {
          tarjeta.style.display = 'none';
        }
      });
    }
  
    flechaDerecha.addEventListener('click', function() {
      console.log('Flecha derecha clickeada');
      if (index + tarjetasPorPagina < tarjetas.length) {
        index += tarjetasPorPagina;
      } else {
        console.log('No hay más tarjetas a la derecha');
      }
      mostrarTarjetas();
    });
  
    flechaIzquierda.addEventListener('click', function() {
      console.log('Flecha izquierda clickeada');
      if (index - tarjetasPorPagina >= 0) {
        index -= tarjetasPorPagina;
      } else {
        console.log('No hay más tarjetas a la izquierda');
      }
      mostrarTarjetas();
    });
  
    mostrarTarjetas();
  });
  