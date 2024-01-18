  // Obtener los elementos de la tabla
  const tabla = document.querySelector('table');
  const filas = tabla.querySelectorAll('tbody tr');
  const totalElemento = document.querySelector('#total');

// Calcular el total
  let total = 0;
  filas.forEach(fila => {
      const precio = parseFloat(fila.querySelector('td:nth-child(3)').textContent.slice(1));
      
      total += precio ;
  });

  totalElemento.textContent = '$' + total.toFixed(2);

document.addEventListener('DOMContentLoaded', function() {
  document.querySelector('.boton-vaciar').addEventListener('click', function(e) {
    // Eliminar los productos de la vista
    var filasProducto = document.querySelectorAll('tbody tr');
    filasProducto.forEach(function(fila) {
        fila.remove();
    });    
  });
});

function mas(id) {
const input = document.getElementById('cantidad-' + id);
let valor = parseInt(input.value, 10);
valor = isNaN(valor) ? 0 : valor;
valor++;
input.value = valor;
actualizarPrecio(id);
}
function menos(id) {
const input = document.getElementById('cantidad-' + id);
let valor = parseInt(input.value, 10);
valor = isNaN(valor) ? 0 : valor;
valor < 1 ? valor = 1 : '';
valor--;
input.value = valor;
actualizarPrecio(id);
}

function actualizarPrecio(id) {
const cantidad = document.getElementById('cantidad-' + id).value;
const precio = document.getElementById('precio-' + id).textContent.slice(1);
const subtotal = cantidad * precio;

document.getElementById('subtotal-' + id).textContent = '$' + subtotal.toFixed(2);
document.getElementById('cantidad-tabla-' + id).textContent = cantidad;

// Recalcular el total
let total = 0;
const filas = document.querySelectorAll('tbody tr');
filas.forEach(fila => {
const precio = parseFloat(fila.querySelector('td:nth-child(3)').textContent.slice(1));
total += precio;
});
document.querySelector('#total').textContent = '$' + total.toFixed(2);
}

window.onload = function(){
  console.log('El código JavaScript se está ejecutando');
  document.querySelector('.boton-continuar-compra').addEventListener('click', function(e){
      console.log('El botón fue clickeado');
      e.preventDefault();

      // Obtener los datos del carrito desde el DOM
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

    
    // Codificar el mensaje antes de añadirlo a la URL
var whatsapp_url = 'https://api.whatsapp.com/send?phone=543513820440&text=' + encodeURIComponent(mensaje);
window.location.href = whatsapp_url;
  });
};