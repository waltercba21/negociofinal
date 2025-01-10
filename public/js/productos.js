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
  contenedorProductos.innerHTML = ''; // Limpiar el contenedor antes de mostrar nuevos productos

  const isAdminUser = document.body.getAttribute('data-is-admin-user') === 'true';
  const isUserLoggedIn = document.body.getAttribute('data-is-user-logged-in') === 'true';

  fetch('/productos/api/buscar?q=' + encodeURIComponent(busqueda))
    .then(response => response.json())
    .then(productos => {
      productos.forEach((producto) => {
        const tarjetaProducto = document.createElement('div');
        tarjetaProducto.classList.add('card');

        // Renderización condicional basada en el tipo de usuario
        let detallesHtml = '';
        if (isAdminUser) {
          // Administrador: Mostrar stock real
          detallesHtml = `
            <div class="stock-producto ${producto.stock_actual < producto.stock_minimo ? 'bajo-stock' : 'suficiente-stock'}">
              <p>Stock Disponible: ${producto.stock_actual}</p>
            </div>`;
        } else if (isUserLoggedIn) {
          // Usuario registrado (que no es administrador): Mostrar semáforo
          if (producto.stock_actual >= producto.stock_minimo) {
            detallesHtml = `
              <div class="semaforo-container">
                <span class="semaforo verde"></span>
                <span class="texto-semaforo">PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA</span>
              </div>`;
          } else {
            detallesHtml = `
              <div class="semaforo-container">
                <span class="semaforo rojo"></span>
                <span class="texto-semaforo">PRODUCTO PENDIENTE DE INGRESO O A PEDIDO</span>
              </div>`;
          }
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
          ${detallesHtml} <!-- Incluir los detalles dinámicos aquí -->
          <div class="cantidad-producto">
            <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
          </div>
        `;

        contenedorProductos.appendChild(tarjetaProducto);
      });
    })
    .catch(error => console.error('Error al buscar productos:', error));
});
