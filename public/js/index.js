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


document.addEventListener('DOMContentLoaded', function () {
  const contenedor = document.querySelector('.contenedor-productos-ofertas');
  const tarjetas = document.querySelectorAll('.card-oferta');
  const flechaIzq = document.querySelector('.flecha-izquierda-ofertas');
  const flechaDer = document.querySelector('.flecha-derecha-ofertas');

  let index = 0;
  const tarjetasPorVista = 3;
  const total = tarjetas.length;
  const maxIndex = Math.ceil(total / tarjetasPorVista) - 1;

  function mostrarTarjetas() {
    tarjetas.forEach((tarjeta, i) => {
      tarjeta.style.display = (i >= index * tarjetasPorVista && i < (index + 1) * tarjetasPorVista) ? 'flex' : 'none';
    });
  }

  function siguiente() {
    index = (index + 1) > maxIndex ? 0 : index + 1;
    mostrarTarjetas();
  }

  function anterior() {
    index = (index - 1) < 0 ? maxIndex : index - 1;
    mostrarTarjetas();
  }

  flechaDer.addEventListener('click', siguiente);
  flechaIzq.addEventListener('click', anterior);

  // Auto-carrusel cada 5 segundos
  setInterval(siguiente, 5000);

  mostrarTarjetas();
});

