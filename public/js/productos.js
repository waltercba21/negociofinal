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
  const botonesAgregarCarrito = document.querySelectorAll('.btn-agregar-carrito');

  botonesAgregarCarrito.forEach(boton => {
    boton.addEventListener('click', () => {
      const productoId = boton.getAttribute('data-id');
      const cantidadInput = document.getElementById(`cantidad-${productoId}`);
      const cantidad = parseInt(cantidadInput.value, 10);

      if (cantidad > 0) {
        // Enviar datos al servidor
        fetch('/carrito/agregar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: productoId, cantidad })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            alert('Producto agregado al carrito con éxito.');
          } else {
            alert('Error al agregar el producto al carrito.');
          }
        })
        .catch(error => console.error('Error:', error));
      } else {
        alert('Por favor, selecciona una cantidad válida.');
      }
    });
  });
});

document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
  const busqueda = e.target.value;
  const contenedorProductos = document.getElementById('contenedor-productos');
  const precio_venta = producto.precio_venta
  ? `$${new Intl.NumberFormat('es-AR').format(Math.floor(producto.precio_venta))}`
  : 'Precio no disponible';

  contenedorProductos.innerHTML = ''; // Limpiar el contenedor antes de mostrar nuevos productos

  fetch('/productos/api/buscar?q=' + encodeURIComponent(busqueda))
    .then(response => response.json())
    .then(productos => {
      productos.forEach((producto) => {
        const tarjetaProducto = document.createElement('div');
        tarjetaProducto.classList.add('card');
        
        // Aquí viene la parte del semáforo
        let semaforoHtml = '';
        if (producto.stock_actual >= producto.stock_minimo) {
          semaforoHtml = `
            <div class="semaforo-container">
              <span class="semaforo verde"></span>
              <span class="texto-semaforo">PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA</span>
            </div>`;
        } else {
          semaforoHtml = `
            <div class="semaforo-container">
              <span class="semaforo rojo"></span>
              <span class="texto-semaforo">PRODUCTO PENDIENTE DE INGRESO O A PEDIDO</span>
            </div>`;
        }

        tarjetaProducto.innerHTML = `
          <div class="cover__card">
            <div class="carousel">
              <img class="carousel__image" src="/uploads/productos/${producto.imagenes[0].imagen}" alt="Imagen de ${producto.nombre}">
            </div>
          </div>
          <div class="titulo-producto">
            <h3 class="nombre">${producto.nombre}</h3>
          </div>
          <div class="precio-producto">
            <p class="precio">$${producto.precio_venta}</p>
          </div>
          ${semaforoHtml} <!-- Incluir el semáforo aquí -->
          <div class="cantidad-producto">
            <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
          </div>
        `;

        contenedorProductos.appendChild(tarjetaProducto);
      });
    })
    .catch(error => console.error('Error al buscar productos:', error));
});
