document.addEventListener('DOMContentLoaded', function() {
  
  document.querySelector('.boton-vaciar').addEventListener('click', function(e) {
    // Eliminar los productos de la vista
    var filasProducto = document.querySelectorAll('tbody tr');
    filasProducto.forEach(function(fila) {
        fila.remove();
    });    
  });

  document.querySelector('.boton-continuar-compra').addEventListener('click', function(e){
  
    var filasProducto = document.querySelectorAll('tbody tr');
    var productos = [];
    filasProducto.forEach(function(fila) {
      var id = fila.id.split('-')[1]; // Extraer el número del id de la fila
      var nombreElemento = document.querySelector('#producto-' + id);
      var cantidadElemento = document.querySelector('#cantidad-tabla-' + id);
      var precioElemento = document.querySelector('#precio-' + id);
      
      if (nombreElemento && cantidadElemento && precioElemento) {
          var nombre = nombreElemento.textContent;
          var cantidad = parseInt(cantidadElemento.textContent, 10);
          var precio = parseFloat(precioElemento.textContent.replace('$', ''));
          productos.push({nombre: nombre, cantidad: cantidad, precio: precio});
      }
    });

    var totalCantidad = productos.reduce(function(total, producto) {
      return total + producto.cantidad;
    }, 0);

    var totalPrecio = productos.reduce(function(total, producto) {
      return total + (producto.precio * producto.cantidad);
    }, 0).toFixed(2);

    var mensaje = 'Pedido:\n';
    for (var i = 0; i < productos.length; i++) {
        mensaje += productos[i].nombre + ' - Cantidad: ' + productos[i].cantidad + ' - Precio: $' + productos[i].precio.toFixed(2) + '\n';
    }
    
    mensaje += 'Total de productos: ' + totalCantidad + '\n';
    mensaje += 'Total: $' + totalPrecio;

    // Eliminar espacios en blanco y saltos de línea innecesarios
    mensaje = eliminarEspacios(mensaje);
  
    // Codificar el mensaje antes de añadirlo a la URL
    var whatsapp_url = 'https://api.whatsapp.com/send?phone=543513820440&text=' + encodeURIComponent(mensaje);
    window.location.href = whatsapp_url;
  });
});