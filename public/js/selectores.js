document.addEventListener('DOMContentLoaded', function() {
  const categoriaSelect = document.getElementById('categoria_id');
  const contenedorProductos = document.getElementById('contenedor-productos');

  categoriaSelect.addEventListener('change', function() {
      const categoriaId = this.value;

      fetch('/productos/api/buscar', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ categoria_id: categoriaId })
      })
      .then(response => response.json())
      .then(data => {
          // Limpiar el contenedor de productos
          contenedorProductos.innerHTML = '';

          data.productos.forEach(producto => {
            // Crear elementos para la tarjeta del producto
            const productoDiv = document.createElement('div');
            productoDiv.classList.add('card');
        
            let imagenes = '';
            producto.imagenes.forEach((imagen, i) => {
                imagenes += `<img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${imagen}" alt="Imagen de ${producto.nombre}">`;
            });
        
            productoDiv.innerHTML = `
                <div class="cover__card">
                    <div class="carousel">
                        ${imagenes}
                    </div>
                </div>
                <div class="carousel__buttons">
                    <button class="carousel__button">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button class="carousel__button">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                <div class="titulo-producto">
                    <h3 class="nombre">${producto.nombre}</h3>
                </div>
                <hr>
                <div class="categoria-producto">
                    <h6 class="categoria">${producto.categoria}</h6>
                </div>
                <div class="descripcion" style="display: none;">
                    ${producto.descripcion}
                </div>
                <div class="precio-producto">
                    <p class="precio">$${typeof producto.precio_venta === 'number' ? Math.floor(producto.precio_venta).toLocaleString('de-DE') : producto.precio_venta}</p>
                </div>
                <div class="cantidad-producto">
                    <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
                </div>
            `;
        
            // Agregar funcionalidad a las flechas
            const carouselImages = productoDiv.querySelectorAll('.carousel__image');
            const leftButton = productoDiv.querySelector('.carousel__button .fas.fa-chevron-left');
            const rightButton = productoDiv.querySelector('.carousel__button .fas.fa-chevron-right');
        
            let currentImageIndex = 0;
        
            leftButton.addEventListener('click', () => {
                carouselImages[currentImageIndex].classList.add('hidden');
                currentImageIndex--;
                if (currentImageIndex < 0) {
                    currentImageIndex = carouselImages.length - 1;
                }
                carouselImages[currentImageIndex].classList.remove('hidden');
            });
        
            rightButton.addEventListener('click', () => {
                carouselImages[currentImageIndex].classList.add('hidden');
                currentImageIndex++;
                if (currentImageIndex >= carouselImages.length) {
                    currentImageIndex = 0;
                }
                carouselImages[currentImageIndex].classList.remove('hidden');
            });
        
            contenedorProductos.appendChild(productoDiv);
        });
      })
      .catch(error => console.error('Error:', error));
  });
});