$(document).ready(function() {
  var $images = $('.carousel__image');
  var index = 0;

  function showImage(newIndex) {
    $images.removeClass('active').hide();
    $images.eq(newIndex).addClass('active').show();
    index = newIndex;
  }

  $('#prevButton').on('click', function() {
    var newIndex = (index > 0) ? index - 1 : $images.length - 1;
    showImage(newIndex);
  }); 

  $('#nextButton').on('click', function() {
    var newIndex = (index < $images.length - 1) ? index + 1 : 0;
    showImage(newIndex);
  }); 
});

document.addEventListener('DOMContentLoaded', () => {
    const isAdminUser = document.body.dataset.isAdminUser === 'true';
  
    // Función para construir el contenido dinámico según el tipo de usuario
    function construirContenidoProducto(producto) {
        if (isAdminUser) {
            return `
                <div class="stock-producto ${producto.stock_actual < producto.stock_minimo ? 'bajo-stock' : 'suficiente-stock'}">
                    <p>Stock Disponible: ${producto.stock_actual}</p>
                </div>`;
        } else {
            if (producto.stock_actual >= producto.stock_minimo) {
                return `
                    <div class="semaforo-container">
                        <span class="semaforo verde"></span>
                        <span class="texto-semaforo">PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA</span>
                    </div>`;
            } else {
                return `
                    <div class="semaforo-container">
                        <span class="semaforo rojo"></span>
                        <span class="texto-semaforo">PRODUCTO PENDIENTE DE INGRESO O A PEDIDO</span>
                    </div>`;
            }
        }
    }
  
    document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
        const busqueda = e.target.value;
        const contenedorProductos = document.getElementById('contenedor-productos');
        contenedorProductos.innerHTML = '';
  
        fetch('/productos/api/buscar?q=' + encodeURIComponent(busqueda))
            .then(response => response.json())
            .then(productos => {
                productos.forEach((producto) => {
                    const tarjetaProducto = document.createElement('div');
                    tarjetaProducto.classList.add('card');
  
                    tarjetaProducto.innerHTML = `
                        <div class="cover__card">
                            <img class="carousel__image" src="/uploads/productos/${producto.imagenes[0].imagen}" alt="Imagen de ${producto.nombre}">
                        </div>
                        <div class="titulo-producto">
                            <h3 class="nombre">${producto.nombre}</h3>
                        </div>
                        <div class="precio-producto">
                            <p class="precio">$${producto.precio_venta}</p>
                        </div>
                        ${construirContenidoProducto(producto)}
                        <div class="cantidad-producto">
                            <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
                        </div>
                    `;
  
                    contenedorProductos.appendChild(tarjetaProducto);
                });
            })
            .catch(error => console.error('Error al buscar productos:', error));
    });
  });
  