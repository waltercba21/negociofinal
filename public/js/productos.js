productos.forEach((producto, index) => {
    let carousel = document.createElement('div');
    carousel.id = `carousel${index}`;
    carousel.className = 'carousel slide';
    carousel.setAttribute('data-ride', 'carousel');
  
    let carouselInner = document.createElement('div');
    carouselInner.className = 'carousel-inner';
  
    producto.imagenes.forEach((imagen, imagenIndex) => {
      let carouselItem = document.createElement('div');
      carouselItem.className = `carousel-item ${imagenIndex === 0 ? 'active' : ''}`;
  
      let img = document.createElement('img');
      img.src = `../../uploads/productos/${imagen.imagen}`;
      img.className = 'd-block w-100';
      img.alt = `Imagen de ${producto.nombre}`;
  
      carouselItem.appendChild(img);
      carouselInner.appendChild(carouselItem);
    });
  
    carousel.appendChild(carouselInner);
  
    if (producto.imagenes.length > 1) {
      let prev = document.createElement('a');
      prev.className = 'carousel-control-prev';
      prev.href = `#carousel${index}`;
      prev.role = 'button';
      prev.setAttribute('data-slide', 'prev');
  
      let prevIcon = document.createElement('span');
      prevIcon.className = 'carousel-control-prev-icon';
      prevIcon.setAttribute('aria-hidden', 'true');
      prev.appendChild(prevIcon);
  
      let prevText = document.createElement('span');
      prevText.className = 'sr-only';
      prevText.innerText = 'Anterior';
      prev.appendChild(prevText);
  
      let next = document.createElement('a');
      next.className = 'carousel-control-next';
      next.href = `#carousel${index}`;
      next.role = 'button';
      next.setAttribute('data-slide', 'next');
  
      let nextIcon = document.createElement('span');
      nextIcon.className = 'carousel-control-next-icon';
      nextIcon.setAttribute('aria-hidden', 'true');
      next.appendChild(nextIcon);
  
      let nextText = document.createElement('span');
      nextText.className = 'sr-only';
      nextText.innerText = 'Siguiente';
      next.appendChild(nextText);
  
      carousel.appendChild(prev);
      carousel.appendChild(next);
    }
  
    document.getElementById('contenedor-productos').appendChild(carousel);
  });