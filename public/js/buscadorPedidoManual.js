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
function formatearNumero(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Función para actualizar la tabla con los productos seleccionados
function actualizarTabla() {
  const tablaBody = document.getElementById('tabla-pedido-body');
  tablaBody.innerHTML = ''; // Limpiar la tabla antes de actualizarla

  productosSeleccionados.forEach((producto, index) => {
    const precioTotal = parseFloat(producto.precioTotal) || 0; // Asegurarse que precioTotal es un número

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${producto.codigo}</td>
      <td>${producto.nombre}</td>
      <td>$${formatearNumero(parseFloat(producto.costo_neto))}</td>  <!-- Precio con separadores de miles -->
      <td>
        <button onclick="cambiarCantidad(${index}, -1)">-</button>
        ${producto.cantidad}
        <button onclick="cambiarCantidad(${index}, 1)">+</button>
      </td>
      <td>$<span id="precio-total-${producto.id}">${formatearNumero(precioTotal)}</span></td>  <!-- Precio total con separadores de miles -->
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

function actualizarTotalPedido() {
  let total = productosSeleccionados.reduce((sum, producto) => sum + (parseFloat(producto.precioTotal) || 0), 0);
  document.getElementById('total-pedido').innerText = `$${formatearNumero(total)}`;  // Total con separadores de miles
}

document.getElementById('btn-confirmar').addEventListener('click', function() {
    generarPDF();
 });
 
 function generarPDF() {
  // Crear una instancia de jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Título del PDF
  doc.setFontSize(18);
  doc.text('Pedido Confirmado', 10, 10);

  // Agregar los encabezados de la tabla
  const headers = [['Código', 'Producto', 'Costo Neto', 'Cantidad', 'Precio Total']];
  
  // Extraer datos de la tabla
  const rows = productosSeleccionados.map(producto => [
    producto.codigo, 
    producto.nombre, 
    `$${formatearNumero(parseFloat(producto.costo_neto))}`,  // Formatear costo neto
    producto.cantidad, 
    `$${formatearNumero(parseFloat(producto.precioTotal))}`  // Formatear precio total
  ]);

  // Insertar la tabla de productos en el PDF
  doc.autoTable({
    head: headers,
    body: rows,
    startY: 20,  // Comenzar a mostrar la tabla un poco más abajo
  });

  // Total del pedido
  let total = productosSeleccionados.reduce((sum, producto) => sum + parseFloat(producto.precioTotal), 0);
  doc.setFontSize(12);
  doc.text(`Total Pedido: $${formatearNumero(total)}`, 10, doc.previousAutoTable.finalY + 10);  // Formatear total del pedido

  // Guardar el PDF
  doc.save('pedido_confirmado.pdf');
}

 