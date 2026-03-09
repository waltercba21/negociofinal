// buscadorFacturasMostrador.js — v2026-03-09-clean

function fechaHoyYYYYMMDD(timeZone = 'America/Argentina/Cordoba') {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

function formatCurrencyCL(valor) {
  const num = Number(valor) || 0;
  return num.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

// ── Funciones puras (no tocan DOM, pueden estar fuera) ──────────────────────

function updateSubtotal(row, verificarStock = true) {
  const inputPrecio = row.cells[3].querySelector('input');
  const inputCantidad = row.cells[4].querySelector('input');
  const stockActualCell = row.cells[5];

  if (!inputPrecio || !inputCantidad || !stockActualCell) return;

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
    if (stockRestante <= 5 && stockRestante >= 0) {
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
  const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  let total = 0;

  for (let i = 0; i < filasFactura.length; i++) {
    let subtotal = parseFloat(filasFactura[i].cells[6].textContent.replace(/\$|\./g, '').replace(',', '.'));
    subtotal = !isNaN(subtotal) ? subtotal : 0;
    total += subtotal;
  }

  const creditoCheckbox = document.querySelector('input[name="metodosPago"][value="CREDITO"]');
  const interesAmountInput = document.getElementById('interes-amount');
  const totalAmountInput = document.getElementById('total-amount');

  let interes = 0;
  if (creditoCheckbox && creditoCheckbox.checked) {
    interes = total * 0.15;
    total += interes;
  }

  if (interesAmountInput) interesAmountInput.value = interes.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
  if (totalAmountInput) totalAmountInput.value = total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

function agregarProductoATabla(codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto) {
  const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
  const filas = tablaFactura.rows;
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
    inputPrecio.addEventListener('input', function () {
      updateSubtotal(filaDisponible, false);
    });
  }

  // Reemplazar celda de cantidad con botones +/-
  const stockNum = parseInt(stockActual) || 0;
  filaDisponible.cells[4].innerHTML = `
    <div class="qty-control">
      <button type="button" class="qty-btn qty-btn--minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button>
      <input type="number" min="1" max="${stockNum}" value="1" class="facturas-tabla__input facturas-tabla__input--qty" />
      <button type="button" class="qty-btn qty-btn--plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button>
    </div>`;

  const inputCantidad = filaDisponible.cells[4].querySelector("input");
  const btnMinus = filaDisponible.cells[4].querySelector(".qty-btn--minus");
  const btnPlus  = filaDisponible.cells[4].querySelector(".qty-btn--plus");

  btnMinus.addEventListener('click', () => {
    const val = parseInt(inputCantidad.value) || 1;
    if (val > 1) { inputCantidad.value = val - 1; updateSubtotal(filaDisponible); }
  });

  btnPlus.addEventListener('click', () => {
    const val = parseInt(inputCantidad.value) || 1;
    if (val < stockNum) { inputCantidad.value = val + 1; updateSubtotal(filaDisponible); }
    else {
      Swal.fire({ title: 'Stock insuficiente', text: `Solo hay ${stockNum} unidades disponibles.`, icon: 'warning', confirmButtonText: 'Entendido' });
    }
  });

  inputCantidad.addEventListener('input', function () {
    updateSubtotal(filaDisponible);
  });

  filaDisponible.cells[5].textContent = stockActual;
  filaDisponible.cells[6].textContent = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

  calcularTotal();

  const botonEliminar = filaDisponible.cells[7].querySelector("button");
  if (botonEliminar) {
    botonEliminar.style.display = "block";
    botonEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    botonEliminar.addEventListener("click", function () {
      filaDisponible.cells[1].textContent = "";
      filaDisponible.cells[2].textContent = "";
      if (inputPrecio) { inputPrecio.value = ""; inputPrecio.disabled = true; }
      filaDisponible.cells[4].innerHTML = `<input type="number" min="1" value="0" class="facturas-tabla__input facturas-tabla__input--qty" disabled />`;
      filaDisponible.cells[5].textContent = "";
      filaDisponible.cells[6].textContent = "";
      if (imgElement) imgElement.style.display = "none";
      botonEliminar.style.display = "none";
      calcularTotal();
    });
  }
}

// ── Todo lo que toca el DOM va dentro de DOMContentLoaded ──────────────────

document.addEventListener('DOMContentLoaded', function () {

  // Fecha actual
  const fechaPresupuestoInput = document.getElementById('fecha-presupuesto');
  if (fechaPresupuestoInput && !fechaPresupuestoInput.value) {
    fechaPresupuestoInput.value = fechaHoyYYYYMMDD();
  }

  // Prevenir Enter en el formulario
  document.getElementById('invoice-form').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      return false;
    }
  });

  // Submit con confirmación
  document.getElementById('invoice-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const metodosPagoSeleccionados = document.querySelector('input[name="metodosPago"]:checked');
    if (!metodosPagoSeleccionados) {
      Swal.fire({ title: 'Error', text: 'Debe seleccionar un método de pago antes de continuar.', icon: 'warning', confirmButtonText: 'Entendido' });
      return;
    }

    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    const invoiceItems = [];
    let totalSinInteres = 0;

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
        Swal.fire({ title: 'Stock insuficiente', text: `No hay stock suficiente para el producto en la fila ${i + 1}. Tiene ${stock}, y desea facturar ${cantidad}.`, icon: 'error', confirmButtonText: 'Entendido' });
        return;
      }

      const subtotal = precio_unitario * cantidad;
      if (codigo !== '' && descripcion !== '' && precio_unitario > 0 && cantidad > 0) {
        invoiceItems.push({ producto_id: codigo, descripcion, precio_unitario, cantidad, subtotal });
        totalSinInteres += subtotal;
      }
    }

    if (invoiceItems.length === 0) {
      Swal.fire({ title: 'Error', text: 'Debe agregar al menos un producto válido antes de continuar.', icon: 'error', confirmButtonText: 'Entendido' });
      return;
    }

    const totalFacturaElement = document.getElementById('total-amount');
    let totalFactura = '0';
    if (totalFacturaElement) {
      totalFactura = totalFacturaElement.value.replace(/\./g, '').replace(',', '.').replace('$', '').trim();
    }

    const fechaFacturaElement = document.getElementById('fecha-presupuesto');
    const fechaFactura = fechaFacturaElement ? fechaFacturaElement.value.trim() : undefined;
    const nombreClienteInput = document.getElementById('nombre-cliente');
    const nombreCliente = nombreClienteInput ? nombreClienteInput.value.trim() : '';

    let interesCalculado = 0;
    if (metodosPagoSeleccionados.value === 'CREDITO') interesCalculado = totalSinInteres * 0.15;
    const totalConInteres = totalSinInteres + interesCalculado;

    const filasHTML = invoiceItems.map((item, index) => `
      <tr>
        <td>${index + 1}</td><td>${item.producto_id}</td><td>${item.descripcion}</td>
        <td>${formatCurrencyCL(item.precio_unitario)}</td><td>${item.cantidad}</td>
        <td>${formatCurrencyCL(item.subtotal)}</td>
      </tr>`).join('');

    const resumenHTML = `
      <div class="resumen-factura-modal">
        <p><strong>Vendedor:</strong> ${nombreCliente || '-'}</p>
        <p><strong>Fecha:</strong> ${fechaFactura || fechaHoyYYYYMMDD()}</p>
        <p><strong>Método de pago:</strong> ${metodosPagoSeleccionados.value}</p>
        <hr>
        <div style="max-height:300px;overflow:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
            <thead><tr>
              <th style="border-bottom:1px solid #ccc;padding:4px;">#</th>
              <th style="border-bottom:1px solid #ccc;padding:4px;">Código</th>
              <th style="border-bottom:1px solid #ccc;padding:4px;">Descripción</th>
              <th style="border-bottom:1px solid #ccc;padding:4px;">P. Unitario</th>
              <th style="border-bottom:1px solid #ccc;padding:4px;">Cant.</th>
              <th style="border-bottom:1px solid #ccc;padding:4px;">Subtotal</th>
            </tr></thead>
            <tbody>${filasHTML}</tbody>
          </table>
        </div>
        <hr>
        <p><strong>Total sin interés:</strong> ${formatCurrencyCL(totalSinInteres)}</p>
        <p><strong>Interés:</strong> ${formatCurrencyCL(interesCalculado)}</p>
        <p><strong>Total a cobrar:</strong> ${formatCurrencyCL(totalConInteres)}</p>
        <p style="margin-top:8px;font-size:0.85rem;color:#666;">Revise los datos antes de guardar. Si algo está mal, presione "Revisar".</p>
      </div>`;

    const { isConfirmed } = await Swal.fire({
      title: 'Confirmar datos de la factura',
      html: resumenHTML,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Revisar',
      reverseButtons: true,
      width: '80%',
      allowOutsideClick: false,
      allowEscapeKey: false
    });

    if (!isConfirmed) return;

    try {
      const response = await fetch('/productos/procesarFormularioFacturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreCliente,
          fechaPresupuesto: fechaFactura,
          totalPresupuesto: totalFactura,
          invoiceItems,
          metodosPago: metodosPagoSeleccionados.value
        })
      });

      const data = await response.json();
      if (response.ok) {
        Swal.fire({ title: '¡Factura guardada!', text: data.message, icon: 'success', confirmButtonText: 'Ir a productos' })
          .then(() => { window.location.href = '/productos'; });
      } else {
        throw new Error(data.error || 'Error al procesar el formulario');
      }
    } catch (error) {
      console.error('Error al enviar el formulario:', error);
      Swal.fire({ title: 'Error', text: 'Error al enviar formulario: ' + error.message, icon: 'error', confirmButtonText: 'Entendido' });
    }
  });

  // Buscador de productos
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

    const respuesta = await fetch('/productos/api/buscar?q=' + encodeURIComponent(busqueda));
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
        document.querySelectorAll('.resultado-busqueda').forEach(r => r.classList.remove('hover-activo'));
        this.classList.add('hover-activo');
      });

      resultado.addEventListener('mouseleave', function () {
        this.classList.remove('hover-activo');
      });

      resultado.addEventListener('click', function () {
        agregarProductoATabla(
          this.dataset.codigo,
          this.dataset.nombre,
          this.dataset.precio_venta,
          this.dataset.stock_actual,
          this.dataset.imagen
        );
        resultadosBusqueda.style.display = 'none';
        entradaBusqueda.value = '';
      });

      resultadosBusqueda.appendChild(resultado);
      resultadosBusqueda.style.display = 'block';
    });
  });

  resultadosBusqueda.addEventListener('mouseleave', () => {
    timeoutId = setTimeout(() => { resultadosBusqueda.style.display = 'none'; }, 300);
  });

  resultadosBusqueda.addEventListener('mouseenter', () => {
    clearTimeout(timeoutId);
    resultadosBusqueda.style.display = 'block';
  });

  // Eventos de inputs de tabla
  document.querySelectorAll('#tabla-factura tbody tr').forEach(row => {
    const inputCantidad = row.cells[4].querySelector('input');
    const inputPrecio = row.cells[3].querySelector('input');
    if (inputCantidad) inputCantidad.addEventListener('input', function () { updateSubtotal(row); });
    if (inputPrecio) inputPrecio.addEventListener('input', function () { updateSubtotal(row, false); });
  });

  // Métodos de pago → recalcular total
  document.querySelectorAll('input[name="metodosPago"]').forEach(checkbox => {
    checkbox.addEventListener('change', calcularTotal);
  });

  // Prevenir Enter en todos los inputs
  document.querySelectorAll('input:not(#entradaBusqueda):not(#headerEntradaBusqueda)').forEach(input => {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); return false; }
    });
  });

}); // ── END DOMContentLoaded