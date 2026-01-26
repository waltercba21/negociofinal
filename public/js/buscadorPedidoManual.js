let productosSeleccionados = [];
let timer;

const entradaBusqueda = document.getElementById('entradaBusqueda');
const contenedorProductos = document.getElementById('contenedor-productos');
const proveedorSelect = document.querySelector('.proveedores');

function proveedorValido(val) {
  return /^\d+$/.test(String(val || ''));
}

function limpiarBusqueda() {
  entradaBusqueda.value = '';
  contenedorProductos.innerHTML = '';
}

function formatearNumero(num) {
  const entero = Math.round(Number(num || 0));
  return entero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function obtenerCodigoPorProveedor(producto) {
  // En este flujo, el API ya debe traer `codigo` del proveedor seleccionado
  return producto.codigo || '—';
}

function mostrarProductos(productos) {
  contenedorProductos.innerHTML = '';

  if (!productos || productos.length === 0) {
    contenedorProductos.innerHTML = '<p>No hay productos disponibles</p>';
    return;
  }

  productos.forEach((producto) => {
    const divProducto = document.createElement('div');
    divProducto.classList.add('producto-sugerido');

    const img =
      producto.imagenes && Array.isArray(producto.imagenes) && producto.imagenes.length > 0
        ? `/uploads/productos/${producto.imagenes[0].imagen || producto.imagenes[0]}`
        : '/ruta/imagen-defecto.jpg';

    divProducto.innerHTML = `
      <img src="${img}" alt="${producto.nombre}">
      <span>${producto.nombre}</span>
    `;

    divProducto.addEventListener('click', () => agregarProductoATabla(producto));
    contenedorProductos.appendChild(divProducto);
  });
}

function agregarProductoATabla(producto) {
  if (productosSeleccionados.some((p) => p.id === producto.id)) {
    alert('Este producto ya está agregado al pedido.');
    return;
  }

  producto.cantidad = 1;
  producto.precioTotal = parseFloat(producto.costo_neto) || 0;

  productosSeleccionados.push(producto);
  actualizarTabla();
}

function actualizarTabla() {
  const tablaBody = document.getElementById('tabla-pedido-body');
  tablaBody.innerHTML = '';

  productosSeleccionados.forEach((producto, index) => {
    const precioTotal = parseFloat(producto.precioTotal) || 0;

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${obtenerCodigoPorProveedor(producto)}</td>
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

window.cambiarCantidad = function (index, cambio) {
  const producto = productosSeleccionados[index];
  producto.cantidad += cambio;

  if (producto.cantidad < 1) {
    productosSeleccionados.splice(index, 1);
  } else {
    producto.precioTotal = (parseFloat(producto.costo_neto) || 0) * producto.cantidad;
  }

  actualizarTabla();
};

window.eliminarProducto = function (index) {
  productosSeleccionados.splice(index, 1);
  actualizarTabla();
};

function actualizarTotalPedido() {
  const total = productosSeleccionados.reduce(
    (sum, producto) => sum + (parseFloat(producto.precioTotal) || 0),
    0
  );
  document.getElementById('total-pedido').innerText = `$${formatearNumero(total)}`;
}

// --- UX: deshabilitar búsqueda hasta elegir proveedor
entradaBusqueda.disabled = true;
entradaBusqueda.placeholder = 'Seleccioná un proveedor para buscar...';

proveedorSelect.addEventListener('change', () => {
  limpiarBusqueda();
  contenedorProductos.innerHTML = '';
  productosSeleccionados = []; // pedido = 1 proveedor
  actualizarTabla();

  if (proveedorValido(proveedorSelect.value)) {
    entradaBusqueda.disabled = false;
    entradaBusqueda.placeholder = 'Buscar por código o nombre...';
    entradaBusqueda.focus();
  } else {
    entradaBusqueda.disabled = true;
    entradaBusqueda.placeholder = 'Seleccioná un proveedor para buscar...';
  }
});

// --- Búsqueda filtrada por proveedor
entradaBusqueda.addEventListener('input', (e) => {
  clearTimeout(timer);

  timer = setTimeout(async () => {
    const proveedor_id = proveedorSelect.value;

    contenedorProductos.innerHTML = '';

    if (!proveedorValido(proveedor_id)) return;

    const busqueda = e.target.value.trim();
    if (!busqueda) return;

    const url = `/productos/api/buscar?q=${encodeURIComponent(busqueda)}&proveedor_id=${encodeURIComponent(proveedor_id)}&limite=30`;


    const respuesta = await fetch(url);
    const productos = await respuesta.json();

    const productosFiltrados = (productos || []).filter(
      (p) => !productosSeleccionados.some((sel) => sel.id === p.id)
    );

    mostrarProductos(productosFiltrados);
  }, 250);
});

contenedorProductos.addEventListener('mouseenter', () => clearTimeout(timer));
contenedorProductos.addEventListener('mouseleave', limpiarBusqueda);

// Confirmar pedido
document.getElementById('btn-confirmar').addEventListener('click', async function () {
  const proveedor_id = proveedorSelect.value;

  if (!proveedorValido(proveedor_id)) {
    alert('Seleccioná un proveedor');
    return;
  }

  if (productosSeleccionados.length === 0) {
    alert('No hay productos seleccionados');
    return;
  }

  const total = productosSeleccionados.reduce(
    (sum, producto) => sum + (parseFloat(producto.precioTotal) || 0),
    0
  );

  const datosPedido = {
    proveedor_id,
    total,
    productos: productosSeleccionados.map((producto) => ({
      id: producto.id,
      cantidad: producto.cantidad,
      costo_neto: producto.costo_neto,
      codigo: producto.codigo,
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
      alert('Error al guardar el pedido: ' + (errorData.message || ''));
    }
  } catch (error) {
    console.error('Error al guardar el pedido:', error);
    alert('Error en la conexión con el servidor');
  }
});

function generarPDF() {
  const proveedor_id = proveedorSelect.value;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text('Pedido Confirmado', 10, 10);

  const headers = [['Código', 'Producto', 'Costo Neto', 'Cantidad', 'Precio Total']];
  const rows = productosSeleccionados.map((producto) => [
    obtenerCodigoPorProveedor(producto, proveedor_id),
    producto.nombre,
    `$${formatearNumero(parseFloat(producto.costo_neto))}`,
    producto.cantidad,
    `$${formatearNumero(parseFloat(producto.precioTotal))}`,
  ]);

  doc.autoTable({ head: headers, body: rows, startY: 20 });

  const total = productosSeleccionados.reduce(
    (sum, producto) => sum + (parseFloat(producto.precioTotal) || 0),
    0
  );

  doc.setFontSize(12);
  doc.text(`Total Pedido: $${formatearNumero(total)}`, 10, doc.previousAutoTable.finalY + 10);

  doc.save('pedido_confirmado.pdf');
}
