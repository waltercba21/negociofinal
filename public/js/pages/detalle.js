function moverCarruselDetalle(direccion) {
    const carousel = document.getElementById('carousel-detalle');
    const imagenes = carousel.querySelectorAll('.carousel__image');
    let activa = [...imagenes].findIndex(img => !img.classList.contains('hidden'));
  
    imagenes[activa].classList.add('hidden');
    activa = (activa + direccion + imagenes.length) % imagenes.length;
    imagenes[activa].classList.remove('hidden');
  }
  