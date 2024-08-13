document.addEventListener('DOMContentLoaded', (event) => {
  const fila = document.querySelector('.contenedor-carrousel');
  const peliculas = document.querySelectorAll('.pelicula');
  const flechaIzquierda = document.querySelector('.flecha-izquierda');
  const flechaDerecha = document.querySelector('.flecha-derecha');
  const responsive = window.matchMedia("(max-width: 768px)");
  

  if (!responsive.matches) {
    if (flechaDerecha && fila) {
      flechaDerecha.addEventListener('click', () => {
        fila.scrollLeft += fila.offsetWidth;
        const indicadorActivo = document.querySelector('.indicadores .activo');
        if (indicadorActivo && indicadorActivo.nextSibling) {
          indicadorActivo.nextSibling.classList.add('activo');
          indicadorActivo.classList.remove('activo');
        }
      });
    }
    if (flechaIzquierda && fila) {
      flechaIzquierda.addEventListener('click', () => {
        fila.scrollLeft -= fila.offsetWidth;
        const indicadorActivo = document.querySelector('.indicadores .activo');
        if (indicadorActivo && indicadorActivo.previousSibling) {
          indicadorActivo.previousSibling.classList.add('activo');
          indicadorActivo.classList.remove('activo');
        }
      });
    }
  }
  if (peliculas) {
    peliculas.forEach(pelicula => {
      pelicula.addEventListener('click', () => {
        const imagen = pelicula.querySelector('.imagen-carrusel');
        if (imagen) {
          const categoria = imagen.getAttribute('data-categoria');
          window.location.href = `/productos?categoria=${categoria}`;
        }
      });
    });
  }  
  if (fila) {
    fila.addEventListener('mouseleave', () => {
      peliculas.forEach(pelicula => pelicula.classList.remove('hover'));
    });
  }
  const imagenesCarrusel = document.querySelectorAll('.imagen-carrusel');
  if (imagenesCarrusel) {
    imagenesCarrusel.forEach(imagen => {
      imagen.addEventListener('click', () => {
        const categoriaId = imagen.getAttribute('data-categoria');
        window.location.href = `/productos?categoria=${categoriaId}`;
      });
    });
  }
});

window.onload = function() {
  if (window.innerWidth <= 768) {
    var navbar = document.querySelector('.navbar');
    var icons = document.querySelector('.icons');
    if (navbar) {
      navbar.style.display = 'none';
    }
    if (icons) {
      icons.style.display = 'none';
    }
  }
}

function toggleMenu() {
  var navbar = document.querySelector('.navbar');
  var icons = document.querySelector('.icons');
  if (navbar) {
    navbar.style.display = navbar.style.display === 'none' ? 'flex' : 'none';
  }
  if (icons) {
    icons.style.display = icons.style.display === 'none' ? 'flex' : 'none';
  }
}

function abrirMapa() {
  window.open("https://maps.app.goo.gl/c6bik6TL7uBQP3KZ8", "_blank");
}
document.addEventListener('DOMContentLoaded', function() {
  const contenedorProductosOfertas = document.querySelector('.contenedor-productos-ofertas');
  const tarjetasOfertas = document.querySelectorAll('.card-oferta');
  const flechaIzquierdaOfertas = document.querySelector('.flecha-izquierda-ofertas');
  const flechaDerechaOfertas = document.querySelector('.flecha-derecha-ofertas');

  let indexOfertas = 0;
  const tarjetasPorPaginaOfertas = 3; // Número de tarjetas a mostrar en una vista

  function actualizarCarruselOfertas() {
    // Calcular el ancho de cada tarjeta y el espacio entre ellas
    const tarjetaAncho = tarjetasOfertas[0].offsetWidth;
    const espacioEntreTarjetas = parseFloat(getComputedStyle(tarjetasOfertas[0]).marginRight);
    const desplazamientoOfertas = -((indexOfertas * (tarjetaAncho + espacioEntreTarjetas)));
    
    contenedorProductosOfertas.style.transform = `translateX(${desplazamientoOfertas}px)`;
  }

  function mostrarTarjetasOfertas() {
    tarjetasOfertas.forEach((tarjeta, i) => {
      if (i >= indexOfertas && i < indexOfertas + tarjetasPorPaginaOfertas) {
        tarjeta.style.display = 'flex';
      } else {
        tarjeta.style.display = 'none';
      }
    });
  }

  if (flechaDerechaOfertas) {
    flechaDerechaOfertas.addEventListener('click', function() {
      if (indexOfertas + tarjetasPorPaginaOfertas < tarjetasOfertas.length) {
        indexOfertas += tarjetasPorPaginaOfertas;
        mostrarTarjetasOfertas();
        actualizarCarruselOfertas();
      }
    });
  }

  if (flechaIzquierdaOfertas) {
    flechaIzquierdaOfertas.addEventListener('click', function() {
      if (indexOfertas - tarjetasPorPaginaOfertas >= 0) {
        indexOfertas -= tarjetasPorPaginaOfertas;
        mostrarTarjetasOfertas();
        actualizarCarruselOfertas();
      }
    });
  }

  mostrarTarjetasOfertas();
  actualizarCarruselOfertas();
});





