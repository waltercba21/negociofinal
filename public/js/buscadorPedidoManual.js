let productosOriginales = [];
let productosSeleccionados = [];
let timer;

// Cargar productos en memoria, pero no mostrarlos inicialmente
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

// Mostrar productos en el listado de búsqueda (solo el nombre)
function mostrarProductos(productos) {
  const contenedorProductos = document.getElementById('contenedor-productos');
  contenedorProductos.innerHTML = ''; // Limpiar el listado previo

  productos.forEach(producto => {
    const divProducto = document.createElement('div');
    divProducto.textContent = producto.nombre; // Mostrar solo el nombre
    divProducto.classList.add('producto-item');
    divProducto.addEventListener('click', () => {
      agregarProductoATabla(producto);
      limpiarBusqueda(); // Limpiar la barra de búsqueda y ocultar productos
    });
    contenedorProductos.appendChild(divProducto);
  });
}

// Función para limpiar la barra de búsqueda y el listado de productos
function limpiarBusqueda() {
  document.getElementById('entradaBusqueda').value = ''; // Vaciar la barra de búsqueda
  document.getElementById('contenedor-productos').innerHTML = ''; // Ocultar el listado de productos
}

// Agregar un producto a la tabla de pedido
function agregarProductoATabla(producto) {
  // Evitar agregar duplicados
  if (!productosSeleccionados.some(p => p.id === producto.id)) {
    producto.cantidad = 1;
    producto.precioTotal = producto.costo_neto;
    productosSeleccionados.push(producto);

    actualizarTabla();
  }
}

// Actualizar la tabla con los productos seleccionados
function actualizarTabla() {
  const tablaBody = document.getElementById('tabla-pedido-body');
  tablaBody.innerHTML = ''; // Limpiar la tabla antes de actualizarla

  productosSeleccionados.forEach((producto, index) => {
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
      <td>$<span id="precio-total-${producto.id}">${producto.precioTotal.toFixed(2)}</span></td>
    `;

    tablaBody.appendChild(fila);
  });

  // Actualizar el total del pedido
  actualizarTotalPedido();
}

// Cambiar la cantidad de un producto
function cambiarCantidad(index, cambio) {
  const producto = productosSeleccionados[index];
  producto.cantidad += cambio;

  if (producto.cantidad < 1) {
    productosSeleccionados.splice(index, 1); // Eliminar producto si la cantidad es menor que 1
  } else {
    producto.precioTotal = producto.costo_neto * producto.cantidad;
  }

  actualizarTabla();
}

// Actualizar el total del pedido
function actualizarTotalPedido() {
  let total = productosSeleccionados.reduce((sum, producto) => sum + producto.precioTotal, 0);
  document.getElementById('total-pedido').innerText = `$${total.toFixed(2)}`;
}
