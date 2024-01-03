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

      // Solicitar los datos del servidor
      fetch('/productos/api/carrito')
          .then(response => response.json())
          .then(data => {
            var productos = data.productos;
            var totalCantidad = data.totalCantidad;
            var totalPrecio = data.totalPrecio ? data.totalPrecio.toFixed(2) : '0.00';
        
            var mensaje = 'Pedido:\n';
            for (var i = 0; i < productos.length; i++) {
                var nombre = productos[i].nombre ? productos[i].nombre : 'Nombre no definido';
                var cantidad = productos[i].cantidad ? productos[i].cantidad : 'Cantidad no definida';
                var precio = productos[i].precio ? productos[i].precio.toFixed(2) : 'Precio no definido';
                mensaje += nombre + ' - Cantidad: ' + cantidad + ' - Precio: ' + precio + '\n';
            }
            
            mensaje += 'Total de productos: ' + totalCantidad + '\n';
            mensaje += 'Total: ' + totalPrecio;

            // Codificar el mensaje antes de añadirlo a la URL
            var whatsapp_url = 'https://api.whatsapp.com/send?phone=543513820440&text=' + encodeURIComponent(mensaje);
            window.location.href = whatsapp_url;
          });
  });
};
