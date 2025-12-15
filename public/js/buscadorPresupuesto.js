function fechaHoyYYYYMMDD(timeZone = 'America/Argentina/Cordoba') {
  // en-CA devuelve 'YYYY-MM-DD' directamente
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

document.getElementById('invoice-form').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    return false;
  }
});

document.getElementById('invoice-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  const invoiceItems = [];

  for (let i = 0; i < filasFactura.length; i++) {
    const codigo = filasFactura[i].cells[1].textContent.trim();
    const descripcion = filasFactura[i].cells[2].textContent.trim();
    const precioInput = filasFactura[i].cells[3].querySelector('input').value;
    let precio_unitario = parseFloat(precioInput.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim());
    let cantidad = parseInt(filasFactura[i].cells[4].querySelector('input').value);
    const stock = parseInt(filasFactura[i].cells[5].textContent.trim());

    precio_unitario = !isNaN(precio_unitario) ? precio_unitario : 0;
    cantidad = !isNaN(cantidad) ? cantidad : 1;

    if (cantidad > stock) {
      Swal.fire({
        title: 'Stock insuficiente',
        text: `No hay stock suficiente para el producto en la fila ${i + 1}. Tiene ${stock}, y desea presupuestar ${cantidad}.`,
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const subtotal = precio_unitario * cantidad;

    if (codigo !== '' && descripcion !== '' && precio_unitario > 0 && cantidad > 0) {
      invoiceItems.push({
        producto_id: codigo,
        descripcion,
        precio_unitario,
        cantidad,
        subtotal
      });
    }
  }

  if (invoiceItems.length === 0) {
    Swal.fire({
      title: 'Error',
      text: 'Debe agregar al menos un producto válido antes de continuar.',
      icon: 'error',
      confirmButtonText: 'Entendido'
    });
    return;
  }

  const totalFacturaElement = document.getElementById('total-amount');
  let totalFactura = '0';
  if (totalFacturaElement) {
    totalFactura = totalFacturaElement.value.replace(/\./g, '').replace(',', '.').replace('$', '').trim();
  }

  const fechaFacturaElement = document.getElementById('fecha-presupuesto');
  const fechaFactura = fechaFacturaElement ? fechaFacturaElement.value.trim() : undefined;

  try {
    const response = await fetch('/productos/procesarFormulario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombreCliente: document.getElementById('nombre-cliente').value.trim(),
        fechaPresupuesto: fechaFactura,
        totalPresupuesto: totalFactura,
        invoiceItems
      })
    });

    const data = await response.json();
    if (response.ok) {
      Swal.fire({
        title: '¡Presupuesto guardado!',
        text: data.message,
        icon: 'success',
        confirmButtonText: 'Ir a productos'
      }).then(() => {
        window.location.href = '/productos';
      });
    } else {
      throw new Error(data.error || 'Error al procesar el formulario');
    }
  } catch (error) {
    console.error('Error al enviar el formulario:', error);
    Swal.fire({
      title: 'Error',
      text: 'Error al enviar formulario: ' + error.message,
      icon: 'error',
      confirmButtonText: 'Entendido'
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  Swal.fire({
    title: 'Está en la sección de Presupuesto',
    text: 'Recuerde que está realizando una presupuesto, no una factura.',
    icon: 'info',
    confirmButtonText: 'Entendido'
  });

  // ✅ Fecha por defecto SOLO si está vacía (y SIN alertas de cambio de fecha)
  const fechaPresupuestoInput = document.getElementById('fecha-presupuesto');
  if (fechaPresupuestoInput) {
    if (!fechaPresupuestoInput.value) {
      fechaPresupuestoInput.value = fechaHoyYYYYMMDD();
    }
  }

  const entradaBusqueda = document.getElementById('entradaBusqueda');
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  let timeoutId;

  entradaBusqueda.addEventListener('keyup', async (e) => {
    const busqueda = e.target.value;
    resultadosBusqueda.innerHTML = '';

    if (!busqueda.trim()) {
      resultadosBusqueda.style.display = 'none';
      return;
    }

    const url = '/productos/api/buscar?q=' + busqueda;

    const respuesta = await fetch(url);
    const productos = await respuesta.json();

    productos.forEach((producto) => {
      const resultado = document.createElement('div');
      resultado.classList.add('resultado-busqueda');
      resultado.dataset.codigo = producto.codigo;
      resultado.dataset.nombre = producto.nombre;
      resultado.dataset.precio_venta = producto.precio_venta;
      resultado.dataset.stock_actual = producto.stock_actual;

      if (producto.imagenes && producto.imagenes.length > 0) {
        resultado.dataset.imagen = '/uploads/productos/' + producto.imagenes[0].imagen;
      }

      const contenedor = document.createElement('div');
      contenedor.classList.add('resultado-contenedor');

      if (producto.imagenes && producto.imagenes.length > 0) {
        const imagen = document.createElement('img');
        imagen.src = '/uploads/productos/' + producto.imagenes[0].imagen;
        imagen.classList.add('miniatura');
        contenedor.appendChild(imagen);
      }

      const nombreProducto = document.createElement('span');
      nombreProducto.textContent = producto.nombre;
      contenedor.appendChild(nombreProducto);

      resultado.appendChild(contenedor);

      resultado.addEventListener('mouseenter', function () {
        const resultados = document.querySelectorAll('.resultado-busqueda');
        resultados.forEach(r => r.classList.remove('hover-activo'));
        this.classList.add('hover-activo');
      });

      resultado.addEventListener('mouseleave', function () {
        this.classList.remove('hover-activo');
      });

      resultado.addEventListener('click', function () {
        const codigoProducto = this.dataset.codigo;
        const nombreProducto = this.dataset.nombre;
        const precioVenta = this.dataset.precio_venta;
        const stockActual = this.dataset.stock_actual;
        const imagenProducto = this.dataset.imagen;
        agregarProductoATabla(codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto);
      });

      resultadosBusqueda.appendChild(resultado);
      resultadosBusqueda.style.display = 'block';
    });
  });

  resultadosBusqueda.addEventListener('mouseleave', () => {
    timeoutId = setTimeout(() => {
      resultadosBusqueda.style.display = 'none';
    }, 300);
  });

  resultadosBusqueda.addEventListener('mouseenter', () => {
    clearTimeout(timeoutId);
    resultadosBusqueda.style.display = 'block';
  });
});

function agregarProductoATabla(codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto) {
  const tablaPresupuesto = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
  const filas = tablaPresupuesto.rows;

  let filaDisponible = null;

  for (let i = 0; i < filas.length; i++) {
    if (!filas[i].cells[1].textContent.trim()) {
      filaDisponible = filas[i];
      break;
    }
  }

  if (!filaDisponible) {
    Swal.fire("Límite alcanzado", "Solo se pueden agregar hasta 10 productos.", "warning");
    return;
  }

  const cellImagen = filaDisponible.cells[0];
  const imgElement = cellImagen.querySelector("img");
  if (imagenProducto && imgElement) {
    imgElement.src = imagenProducto;
    imgElement.style.display = "block";
  }

  filaDisponible.cells[1].textContent = codigoProducto;
  filaDisponible.cells[2].textContent = nombreProducto;

  const inputPrecio = filaDisponible.cells[3].querySelector("input");
  if (inputPrecio) {
    inputPrecio.value = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    inputPrecio.disabled = false;
  }

  const inputCantidad = filaDisponible.cells[4].querySelector("input");
  if (inputCantidad) {
    inputCantidad.value = 1;
    inputCantidad.disabled = false;
    inputCantidad.addEventListener('input', function () {
      updateSubtotal(filaDisponible);
    });
  }

  filaDisponible.cells[5].textContent = stockActual;
  filaDisponible.cells[6].textContent = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

  calcularTotal();

  const botonEliminar = filaDisponible.cells[7].querySelector("button");
  if (botonEliminar) {
    botonEliminar.style.display = "block";
    botonEliminar.classList.add("boton-eliminar-factura");
    botonEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    botonEliminar.addEventListener("click", function () {
      filaDisponible.cells[1].textContent = "";
      filaDisponible.cells[2].textContent = "";
      if (inputPrecio) inputPrecio.value = "";
      if (inputCantidad) inputCantidad.value = "";
      filaDisponible.cells[5].textContent = "";
      filaDisponible.cells[6].textContent = "";
      imgElement.style.display = "none";
      botonEliminar.style.display = "none";
      calcularTotal();
    });
  }
}

function updateSubtotal(row, verificarStock = true) {
  const inputPrecio = row.cells[3].querySelector('input');
  const inputCantidad = row.cells[4].querySelector('input');
  const stockActualCell = row.cells[5];

  if (!inputPrecio || !inputCantidad || !stockActualCell) {
    return;
  }

  let precio = parseFloat(inputPrecio.value.replace(/\$|\./g, '').replace(',', '.'));
  let cantidad = parseInt(inputCantidad.value);
  let stockActual = parseInt(stockActualCell.textContent.replace(/\$|\./g, '').replace(',', '.'));

  precio = !isNaN(precio) ? precio : 0;
  cantidad = !isNaN(cantidad) ? cantidad : 1;
  stockActual = !isNaN(stockActual) ? stockActual : 0;

  const subtotal = precio * cantidad;
  row.cells[6].textContent = subtotal.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

  if (verificarStock && document.activeElement === inputCantidad) {
    if (cantidad > stockActual) {
      Swal.fire({
        title: 'ALERTA',
        text: 'NO HAY STOCK DISPONIBLE. Solo hay ' + stockActual + ' unidades en stock.',
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
      inputCantidad.value = stockActual > 0 ? stockActual : 1;
      cantidad = parseInt(inputCantidad.value);
    }

    const stockRestante = stockActual - cantidad;
    const stockMinimo = 5;

    if (stockRestante <= stockMinimo && stockRestante >= 0) {
      Swal.fire({
        title: 'ALERTA',
        text: 'LLEGANDO AL LIMITE DE STOCK. Quedan ' + stockRestante + ' unidades disponibles.',
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
    }
  }

  calcularTotal();
}

function calcularTotal() {
  const filasPresupuesto = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  let total = 0;

  for (let i = 0; i < filasPresupuesto.length; i++) {
    let subtotal = parseFloat(filasPresupuesto[i].cells[6].textContent.replace(/\$|\./g, '').replace(',', '.'));
    subtotal = !isNaN(subtotal) ? subtotal : 0;
    total += subtotal;
  }

  const totalAmountInput = document.getElementById('total-amount');
  totalAmountInput.value = total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

// Eventos de inputs
document.querySelectorAll('#tabla-factura tbody tr').forEach(row => {
  const inputCantidad = row.cells[4].querySelector('input');
  const inputPrecio = row.cells[3].querySelector('input');

  if (inputCantidad) {
    inputCantidad.addEventListener('input', function () {
      updateSubtotal(row);
    });
  }

  if (inputPrecio) {
    inputPrecio.addEventListener('input', function () {
      updateSubtotal(row, false);
    });
  }
});

// Por si existe en la vista (si no existe, no hace nada)
document.querySelectorAll('input[name="metodosPago"]').forEach(checkbox => {
  checkbox.addEventListener('change', calcularTotal);
});

// Bloquea Enter en todos los inputs excepto en la búsqueda
document.querySelectorAll('input:not(#entradaBusqueda)').forEach(input => {
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      return false;
    }
  });
});
