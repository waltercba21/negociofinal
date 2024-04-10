
function mas(id) {
  var inputCantidad = document.querySelector('#cantidad-' + id);
  var cantidad = parseInt(inputCantidad.value, 10);
  cantidad = isNaN(cantidad) ? 0 : cantidad;
  cantidad++;
  inputCantidad.value = cantidad;

  var cantidadTabla = document.querySelector('#cantidad-tabla-' + id);
  cantidadTabla.textContent = cantidad;

  actualizarCantidad(id);
  actualizarTotal();
}

function menos(id) {
  var inputCantidad = document.querySelector('#cantidad-' + id);
  var cantidad = parseInt(inputCantidad.value, 10);
  cantidad = isNaN(cantidad) ? 0 : cantidad;
  if (cantidad > 0) {
      cantidad--;
  }
  inputCantidad.value = cantidad;

  var cantidadTabla = document.querySelector('#cantidad-tabla-' + id);
  cantidadTabla.textContent = cantidad;

  actualizarCantidad(id);
  actualizarTotal();
}

    function actualizarTotal() {
    var totalCantidad = 0;
    var totalPrecio = 0;
  
    // Obtén todos los productos en el carrito
    var productos = document.querySelectorAll('tbody tr');
  
    // Para cada producto, actualiza la cantidad total y el precio total
    productos.forEach(function(producto) {
      var id = producto.id.replace('fila-', '');
  
      // Obtén la cantidad y el precio del producto
      var cantidad = parseInt(document.querySelector('#cantidad-tabla-' + id).textContent, 10);
      var precio = parseFloat(document.querySelector('#subtotal-' + id).textContent.replace('$', ''));
  
      // Actualiza la cantidad total y el precio total
      totalCantidad += cantidad;
      totalPrecio += precio;
    });
  
    // Actualiza la cantidad total y el precio total en la página
    document.querySelector('#totalCantidad').textContent = totalCantidad;
    document.querySelector('#totalPrecio').textContent = '$' + totalPrecio.toFixed(2);
  }
  
  function actualizarCantidad(id) {
    var inputCantidad = document.querySelector('#cantidad-' + id);
    var cantidad = parseInt(inputCantidad.value, 10);
    var precioElemento = document.querySelector('#precio-' + id);
    var precio = parseFloat(precioElemento.textContent.replace('$', ''));
    var subtotalElemento = document.querySelector('#subtotal-' + id);
    var subtotal = precio * cantidad;
    subtotalElemento.textContent = '$' + subtotal.toFixed(2);

    var totalCantidadElemento = document.querySelector('#totalCantidad');
    var totalPrecioElemento = document.querySelector('#totalPrecio');
    var filasProducto = document.querySelectorAll('tbody tr');
    var totalCantidad = 0;
    var totalPrecio = 0;
    filasProducto.forEach(function(fila) {
        var id = fila.id.split('-')[1]; // Extraer el número del id de la fila
        var cantidadElemento = document.querySelector('#cantidad-tabla-' + id);
        var subtotalElemento = document.querySelector('#subtotal-' + id);
        var cantidad = parseInt(cantidadElemento.textContent, 10);
        var subtotal = parseFloat(subtotalElemento.textContent.replace('$', ''));
        totalCantidad += cantidad;
        totalPrecio += subtotal;
    });
    totalCantidadElemento.textContent = totalCantidad;
    totalPrecioElemento.textContent = '$' + totalPrecio.toFixed(2);
}
document.querySelector('.boton-vaciar').addEventListener('click', function(e) {
  // Eliminar los productos de la vista
  var filasProducto = document.querySelectorAll('tbody tr');
  filasProducto.forEach(function(fila) {
      fila.remove();
  });    
});

document.querySelector('.boton-continuar-compra').addEventListener('click', function(e){
  e.preventDefault();

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
  mensaje = mensaje.replace(/\s+/g, ' ').trim();

  // Codificar el mensaje antes de añadirlo a la URL
  var whatsapp_url = 'https://api.whatsapp.com/send?phone=543513820440&text=' + encodeURIComponent(mensaje);
  console.log('Redirigiendo a WhatsApp:', whatsapp_url);
  window.location.href = whatsapp_url;

  document.querySelector('#form-compra').submit(); 
});



