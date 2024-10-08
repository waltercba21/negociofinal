let productosOriginales = [];
let productosSeleccionados = [];
let timer;

// Cargar productos en memoria cuando se carga la página, pero no mostrarlos
window.onload = async () => {
  const respuesta = await fetch('/productos/api/buscar');
  productosOriginales = await respuesta.json();
};

// Buscar productos cuando se escribe en la barra de búsqueda
document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value.trim();
    const contenedorProductos = document.getElementById('contenedor-productos');
    contenedorProductos.innerHTML = ''; // Limpiar la lista anterior

    if (busqueda) {
      const url = `/productos/api/buscar?q=${encodeURIComponent(busqueda)}`;
      const respuesta = await fetch(url);
      const productos = await respuesta.json();
      mostrarProductos(productos);
    }
  }, 300);
});

// Mostrar productos en el listado de búsqueda
function mostrarProductos(productos) {
  const contenedorProductos = document.getElementById('contenedor-productos');
  contenedorProductos.innerHTML = ''; // Limpiar el listado previo

  productos.forEach(producto => {
    const divProducto = document.createElement('div');
    divProducto.textContent = producto.nombre; // Mostrar solo el nombre del producto
    divProducto.classList.add('producto-item'); // Clase para estilos

    // Agregar el evento para seleccionar el producto
    divProducto.addEventListener('click', () => {
      agregarProductoATabla(producto);  // Llamada a la función para agregar el producto a la tabla
      limpiarBusqueda();                // Limpiar la barra de búsqueda después de la selección
    });

    contenedorProductos.appendChild(divProducto);
  });
}

// Función para agregar el producto a la tabla
function agregarProductoATabla(producto) {
  console.log("Producto seleccionado:", producto); // Verificar en la consola si el producto es seleccionado

  // Verificar si el producto ya está en la tabla
  const existe = productosSeleccionados.some(p => p.id === producto.id);
  if (!existe) {
    producto.cantidad = 1;
    producto.precioTotal = parseFloat(producto.costo_neto) || 0; // Asegurarse que es un número
    productosSeleccionados.push(producto);

    actualizarTabla();  // Actualizar la tabla con el producto agregado
  } else {
    console.log("El producto ya está en la tabla");
  }
}

// Función para limpiar la barra de búsqueda y ocultar el listado de productos
function limpiarBusqueda() {
  document.getElementById('entradaBusqueda').value = ''; // Vaciar la barra de búsqueda
  document.getElementById('contenedor-productos').innerHTML = ''; // Ocultar el listado de productos
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
      <td>$${producto.costo_neto}</td>
      <td>
        <button onclick="cambiarCantidad(${index}, -1)">-</button>
        ${producto.cantidad}
        <button onclick="cambiarCantidad(${index}, 1)">+</button>
      </td>
      <td>$<span id="precio-total-${producto.id}">${precioTotal.toFixed(2)}</span></td>
    `;
    tablaBody.appendChild(fila);
  });

  actualizarTotalPedido(); // Actualizar el total del pedido
}

// Función para cambiar la cantidad del producto
function cambiarCantidad(index, cambio) {
  const producto = productosSeleccionados[index];
  producto.cantidad += cambio;

  if (producto.cantidad < 1) {
    productosSeleccionados.splice(index, 1); // Eliminar producto si la cantidad es menor que 1
  } else {
    producto.precioTotal = parseFloat(producto.costo_neto) * producto.cantidad; // Asegurarse de realizar operaciones con números
  }

  actualizarTabla(); // Actualizar la tabla después de cambiar la cantidad
}

// Función para actualizar el total del pedido
function actualizarTotalPedido() {
  let total = productosSeleccionados.reduce((sum, producto) => sum + (parseFloat(producto.precioTotal) || 0), 0);
  document.getElementById('total-pedido').innerText = `$${total.toFixed(2)}`;
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
     `$${parseFloat(producto.costo_neto).toFixed(2)}`, 
     producto.cantidad, 
     `$${parseFloat(producto.precioTotal).toFixed(2)}`
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
const totalText = `Total Pedido: $${total.toFixed(2)}`;

// Calcular la posición del centro de la página
const pageWidth = doc.internal.pageSize.getWidth();
const textWidth = doc.getTextWidth(totalText);
const x = (pageWidth - textWidth) / 2; // Centrar el texto

doc.text(totalText, x, doc.previousAutoTable.finalY + 10);

 
   // Guardar el PDF
   doc.save('pedido_confirmado.pdf');
 }
 