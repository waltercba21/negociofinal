let productosOriginales = [];
let productosSeleccionados = [];
let timer;

window.onload = async () => {
  const respuesta = await fetch('/productos/api/buscar');
  productosOriginales = await respuesta.json();
  mostrarProductos(productosOriginales.slice(0, 12));
};

// Buscar productos
document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value;
    const contenedorProductos = document.getElementById('contenedor-productos');
    contenedorProductos.innerHTML = ''; // Limpiar el listado anterior

    let productos = [];
    if (!busqueda.trim()) {
      productos = productosOriginales.slice(0, 12);
    } else {
      let url = '/productos/api/buscar?q=' + busqueda;
      const respuesta = await fetch(url);
      productos = await respuesta.json();
    }

    mostrarProductos(productos);
  }, 300);
});

// Mostrar productos en el listado de búsqueda
function mostrarProductos(productos) {
  const contenedorProductos = document.getElementById('contenedor-productos');
  contenedorProductos.innerHTML = ''; // Limpiar el listado previo

  productos.forEach(producto => {
    const divProducto = document.createElement('div');
    divProducto.innerHTML = `<strong>${producto.nombre}</strong> - ${producto.codigo} - $${producto.costo_neto}`;
    divProducto.classList.add('producto-item');
    divProducto.addEventListener('click', () => agregarProductoATabla(producto));
    contenedorProductos.appendChild(divProducto);
  });
}

// Agregar un producto a la tabla de pedido
function agregarProductoATabla(producto) {
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
      <td>$<span id="precio-total-${producto.id}">${producto.precioTotal}</span></td>
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
