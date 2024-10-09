let productosOriginales = [];
let productosSeleccionados = [];
let timer;

window.onload = async () => {
  const respuesta = await fetch('/productos/api/buscar');
  productosOriginales = await respuesta.json();
};
document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value.trim();
    const contenedorProductos = document.getElementById('contenedor-productos');
    contenedorProductos.innerHTML = ''; 

    if (busqueda) {
      const url = `/productos/api/buscar?q=${encodeURIComponent(busqueda)}`;
      const respuesta = await fetch(url);
      const productos = await respuesta.json();
      mostrarProductos(productos);
    }
  }, 300);
});

function mostrarProductos(productos) {
  const contenedorProductos = document.getElementById('contenedor-productos');
  contenedorProductos.innerHTML = ''; 

  productos.forEach(producto => {
    const divProducto = document.createElement('div');
    divProducto.textContent = producto.nombre;
    divProducto.classList.add('producto-item'); 

    // Agregar el evento para seleccionar el producto
    divProducto.addEventListener('click', () => {
      agregarProductoATabla(producto); 
      limpiarBusqueda();                
    });

    contenedorProductos.appendChild(divProducto);
  });
}

function agregarProductoATabla(producto) {
  console.log("Producto seleccionado:", producto); 

  // Verificar si el producto ya está en la tabla
  const existe = productosSeleccionados.some(p => p.id === producto.id);
  if (!existe) {
    producto.cantidad = 1;
    producto.precioTotal = parseFloat(producto.costo_neto) || 0; 
    productosSeleccionados.push(producto);

    actualizarTabla(); 
  } else {
    console.log("El producto ya está en la tabla");
  }
}

function limpiarBusqueda() {
  document.getElementById('entradaBusqueda').value = '';
  document.getElementById('contenedor-productos').innerHTML = ''; 
}

function actualizarTabla() {
  const tablaBody = document.getElementById('tabla-pedido-body');
  tablaBody.innerHTML = ''; // Limpiar la tabla antes de actualizarla

  productosSeleccionados.forEach((producto, index) => {
    const precioTotal = parseFloat(producto.precioTotal) || 0; // Asegurarse que precioTotal es un número

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${producto.codigo}</td>
      <td>${producto.nombre}</td>
      <td>$${parseFloat(producto.costo_neto).toFixed(0)}</td>  <!-- Precio sin decimales -->
      <td>
        <button onclick="cambiarCantidad(${index}, -1)">-</button>
        ${producto.cantidad}
        <button onclick="cambiarCantidad(${index}, 1)">+</button>
      </td>
      <td>$<span id="precio-total-${producto.id}">${precioTotal.toFixed(0)}</span></td>  <!-- Precio total sin decimales -->
    `;
    tablaBody.appendChild(fila);
  });

  actualizarTotalPedido(); // Actualizar el total del pedido
}

function cambiarCantidad(index, cambio) {
  const producto = productosSeleccionados[index];
  producto.cantidad += cambio;

  if (producto.cantidad < 1) {
    productosSeleccionados.splice(index, 1); 
  } else {
    producto.precioTotal = parseFloat(producto.costo_neto) * producto.cantidad; 
  }

  actualizarTabla(); 
}

// Función para actualizar el total del pedido
function actualizarTotalPedido() {
  let total = productosSeleccionados.reduce((sum, producto) => sum + (parseFloat(producto.precioTotal) || 0), 0);
  document.getElementById('total-pedido').innerText = `$${total.toFixed(0)}`; 
}
document.getElementById('btn-confirmar').addEventListener('click', function() {
    generarPDF();
 });
 
 function generarPDF() {
   const { jsPDF } = window.jspdf;
   const doc = new jsPDF();
   doc.setFontSize(18);
   doc.text('Pedido Confirmado', 10, 10);
   const headers = [['Código', 'Producto', 'Costo Neto', 'Cantidad', 'Precio Total']];
   
   // Extraer datos de la tabla
   const rows = productosSeleccionados.map(producto => [
    producto.codigo, 
    producto.nombre, 
    `$${parseFloat(producto.costo_neto).toFixed(0)}`,  
    producto.cantidad, 
    `$${parseFloat(producto.precioTotal).toFixed(0)}`  
]);
   doc.autoTable({
     head: headers,
     body: rows,
     startY: 20, 
   });
 
let total = productosSeleccionados.reduce((sum, producto) => sum + parseFloat(producto.precioTotal), 0);
doc.setFontSize(12);
const totalText = `Total Pedido: $${total.toFixed(0)}`;  

const pageWidth = doc.internal.pageSize.getWidth();
const textWidth = doc.getTextWidth(totalText);
const x = (pageWidth - textWidth) / 2; 
doc.text(totalText, x, doc.previousAutoTable.finalY + 10);

   // Guardar el PDF
   doc.save('pedido_confirmado.pdf');
 }
 