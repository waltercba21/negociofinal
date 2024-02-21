document.addEventListener('DOMContentLoaded', (event) => {
  
  const fila = document.querySelector('.contenedor-carrousel');
  const peliculas = document.querySelectorAll('.pelicula');
  const flechaIzquierda = document.getElementById('flecha-izquierda');
  const flechaDerecha = document.getElementById('flecha-derecha');

  // Verificar si estamos en modo responsive
  const responsive = window.matchMedia("(max-width: 768px)");

  // Si no estamos en modo responsive, agregar los event listeners
  if (!responsive.matches) {
    // Verificar si los elementos existen antes de agregar event listeners
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

  if (peliculas && peliculas.length > 0) {
    const numeroPaginas = Math.ceil(peliculas.length / 2);
    for (let i = 0; i < numeroPaginas; i++){
      const indicador = document.createElement('button');
      if(i===0){
        indicador.classList.add ('activo');
      }
      document.querySelector('.indicadores').appendChild(indicador);
      indicador.addEventListener ('click', (e)=>{
        fila.scrollLeft = i * fila.offsetWidth;
        document.querySelector('.indicadores .activo').classList.remove('activo');
        e.target.classList.add('activo');
      })
    }
  }

  // Verificar si los elementos existen antes de agregar event listeners
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
        const categoria = imagen.getAttribute('data-categoria');
        window.location.href = `/productos?categoria=${categoria}`;
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