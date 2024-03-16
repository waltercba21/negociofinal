document.addEventListener('DOMContentLoaded', (event) => {
  const fila = document.querySelector('.contenedor-carrousel');
  const peliculas = document.querySelectorAll('.pelicula');
  const flechaIzquierda = document.getElementById('flecha-izquierda');
  const flechaDerecha = document.getElementById('flecha-derecha');
  let scrollInterval;

  const responsive = window.matchMedia("(max-width: 768px)");
  
  const startAutoScroll = () => {
    // Detener el desplazamiento automático si ya está en marcha
    if (scrollInterval) {
      clearInterval(scrollInterval);
    }

    scrollInterval = setInterval(() => {
      if (fila) {
        // Desplazarse a la derecha por 1 pixel
        fila.scrollLeft += 1;
      }
    }, 2000);
  }
  startAutoScroll();

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

function startAutoScroll() {
  const fila = document.querySelector('.contenedor-carrousel');
  // Detener el desplazamiento automático si ya está en marcha
  if (scrollInterval) {
    clearInterval(scrollInterval);
  }

  // Comenzar a desplazarse automáticamente cada 2000 milisegundos (2 segundos)
  scrollInterval = setInterval(() => {
    if (fila) {
      // Desplazarse a la derecha por 1 pixel
      fila.scrollLeft += 1;
    }
  }, 2000);
}