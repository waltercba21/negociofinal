let productosOriginales = [];
let productosSeleccionados = [];
let timer;

window.onload = async () => {
  const respuesta = await fetch('/productos/api/buscar');
  productosOriginales = await respuesta.json();
};

const entradaBusqueda = document.getElementById('entradaBusqueda');
const contenedorProductos = document.getElementById('contenedor-productos');
const proveedorSelect = document.querySelector('.proveedores');
  
entradaBusqueda.addEventListener('input', (e) => {
  const proveedor_id = proveedorSelect.value;

  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value.trim();
    contenedorProductos.innerHTML = '';

    if (busqueda) {
      const url = `/productos/api/buscar?q=${encodeURIComponent(busqueda)}`;
      const respuesta = await fetch(url);
      const productos = await respuesta.json();

      // Excluir productos que ya están en la tabla
      const productosFiltrados = productos.filter(
        (p) => !productosSeleccionados.some((sel) => sel.id === p.id)
      );

      mostrarProductos(productosFiltrados);
    }
  }, 300);
});

// Mantener abierto mientras el puntero esté en el contenedor
contenedorProductos.addEventListener('mouseenter', () => clearTimeout(timer));
contenedorProductos.addEventListener('mouseleave', limpiarBusqueda);

function mostrarProductos(productos) {
  contenedorProductos.innerHTML = '';

  if (productos.length === 0) {
    contenedorProductos.innerHTML = '<p>No hay productos disponibles</p>';
    return;
  }

  productos.forEach((producto) => {
    const divProducto = document.createElement('div');
    divProducto.classList.add('producto-sugerido'); // Cambiamos la clase

    divProducto.innerHTML = `
      <img src="${producto.imagenes && producto.imagenes.length > 0 ? `/uploads/productos/${producto.imagenes[0].imagen || producto.imagenes[0]}` : '/ruta/imagen-defecto.jpg'}" alt="${producto.nombre}">
      <span>${producto.nombre}</span>
    `;

    divProducto.addEventListener('click', () => agregarProductoATabla(producto));
    contenedorProductos.appendChild(divProducto);
  });
}


function agregarProductoATabla(producto) {
  // Verificar si el producto ya está agregado
  if (productosSeleccionados.some((p) => p.id === producto.id)) {
    alert('Este producto ya está agregado al pedido.');
    return;
  }

  producto.cantidad = 1;
  producto.precioTotal = parseFloat(producto.costo_neto) || 0;
  productosSeleccionados.push(producto);
  actualizarTabla();
}

function limpiarBusqueda() {
  entradaBusqueda.value = '';
  contenedorProductos.innerHTML = '';
}

function formatearNumero(num) {
  const entero = Math.round(num); // redondea al entero más cercano
  return entero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}


function actualizarTabla() {
  const tablaBody = document.getElementById('tabla-pedido-body');
  tablaBody.innerHTML = '';

  productosSeleccionados.forEach((producto, index) => {
    const precioTotal = parseFloat(producto.precioTotal) || 0;

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${obtenerCodigoPorProveedor(producto, proveedorSelect.value)}</td>
      <td>${producto.nombre}</td>
      <td>$${formatearNumero(parseFloat(producto.costo_neto))}</td>
     <td>
  <div class="cantidad-controles">
    <button class="btn-cantidad btn-menos" onclick="cambiarCantidad(${index}, -1)">−</button>
    <span class="cantidad-numero">${producto.cantidad}</span>
    <button class="btn-cantidad btn-mas" onclick="cambiarCantidad(${index}, 1)">+</button>
  </div>
</td>

      <td>$<span id="precio-total-${producto.id}">${formatearNumero(precioTotal)}</span></td>
      <td><button onclick="eliminarProducto(${index})" class="btn btn-danger">Eliminar</button></td>
    `;
    tablaBody.appendChild(fila);
  });

  actualizarTotalPedido();
}
function obtenerCodigoPorProveedor(producto, proveedor_id) {
  if (producto.proveedores && Array.isArray(producto.proveedores)) {
    const proveedorEncontrado = producto.proveedores.find(p => p.id == proveedor_id);
    return proveedorEncontrado ? proveedorEncontrado.codigo : '—';
  }
  return producto.codigo || '—';
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
  let total = productosSeleccionados.reduce(
    (sum, producto) => sum + (parseFloat(producto.precioTotal) || 0),
    0
  );
  document.getElementById('total-pedido').innerText = `$${formatearNumero(total)}`;
}

document.getElementById('btn-confirmar').addEventListener('click', async function () {
  const proveedor_id = document.querySelector('.proveedores').value;

  if (productosSeleccionados.length === 0) {
    alert('No hay productos seleccionados');
    return;
  }

  let total = productosSeleccionados.reduce(
    (sum, producto) => sum + parseFloat(producto.precioTotal),
    0
  );

  const datosPedido = {
    proveedor_id,
    total,
    productos: productosSeleccionados.map((producto) => ({
      id: producto.id,
      cantidad: producto.cantidad,
      costo_neto: producto.costo_neto,
    })),
  };

  try {
    const respuesta = await fetch('/productos/guardarPedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosPedido),
    });

    if (respuesta.ok) {
      alert('Pedido guardado con éxito');
      generarPDF();
    } else {
      const errorData = await respuesta.json();
      alert('Error al guardar el pedido: ' + errorData.message);
    }
  } catch (error) {
    console.error('Error al guardar el pedido:', error);
    alert('Error en la conexión con el servidor');
  }
});

function generarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('Pedido Confirmado', 10, 10);

  const headers = [['Código', 'Producto', 'Costo Neto', 'Cantidad', 'Precio Total']];
  const rows = productosSeleccionados.map((producto) => [
    producto.codigo,
    producto.nombre,
    `$${formatearNumero(parseFloat(producto.costo_neto))}`,
    producto.cantidad,
    `$${formatearNumero(parseFloat(producto.precioTotal))}`,
  ]);

  doc.autoTable({
    head: headers,
    body: rows,
    startY: 20,
  });

  let total = productosSeleccionados.reduce(
    (sum, producto) => sum + parseFloat(producto.precioTotal),
    0
  );
  doc.setFontSize(12);
  doc.text(`Total Pedido: $${formatearNumero(total)}`, 10, doc.previousAutoTable.finalY + 10);

  doc.save('pedido_confirmado.pdf');
}
