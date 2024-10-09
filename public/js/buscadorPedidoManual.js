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

    divProducto.addEventListener('click', () => {
      agregarProductoATabla(producto); 
      limpiarBusqueda();                
    });

    contenedorProductos.appendChild(divProducto);
  });
}

function agregarProductoATabla(producto) {
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
    const precioTotal = parseFloat(producto.precioTotal) || 0;

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${producto.codigo}</td>
      <td>${producto.nombre}</td>
      <td>$${formatearNumero(parseFloat(producto.costo_neto))}</td>
      <td>
        <button onclick="cambiarCantidad(${index}, -1)">-</button>
        ${producto.cantidad}
        <button onclick="cambiarCantidad(${index}, 1)">+</button>
      </td>
      <td>$<span id="precio-total-${producto.id}">${formatearNumero(precioTotal)}</span></td>
      <td><button onclick="eliminarProducto(${index})" class="btn btn-danger">Eliminar</button></td>  <!-- Botón de eliminar -->
    `;
    tablaBody.appendChild(fila);
  });

  actualizarTotalPedido(); 
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

function eliminarProducto(index) {
  productosSeleccionados.splice(index, 1); 
  actualizarTabla();
}

function actualizarTotalPedido() {
  let total = productosSeleccionados.reduce((sum, producto) => sum + (parseFloat(producto.precioTotal) || 0), 0);
  document.getElementById('total-pedido').innerText = `$${formatearNumero(total)}`;
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

  const rows = productosSeleccionados.map(producto => [
    producto.codigo, 
    producto.nombre, 
    `$${formatearNumero(parseFloat(producto.costo_neto))}`,
    producto.cantidad, 
    `$${formatearNumero(parseFloat(producto.precioTotal))}`
  ]);

  doc.autoTable({
    head: headers,
    body: rows,
    startY: 20,
  });

  let total = productosSeleccionados.reduce((sum, producto) => sum + parseFloat(producto.precioTotal), 0);
  doc.setFontSize(12);
  doc.text(`Total Pedido: $${formatearNumero(total)}`, 10, doc.previousAutoTable.finalY + 10);

  doc.save('pedido_confirmado.pdf');
}
