// buscadorPresupuesto.js — v2026-03-09-clean

function fechaHoyYYYYMMDD(timeZone = 'America/Argentina/Cordoba') {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

function formatCurrencyCL(valor) {
  const num = Number(valor) || 0;
  return num.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

// ── Funciones puras (no tocan DOM) ─────────────────────────────────────────

function updateSubtotal(row, verificarStock = true) {
  const inputPrecio    = row.cells[3].querySelector('input');
  const inputCantidad  = row.cells[4].querySelector('input');
  const stockActualCell = row.cells[5];

  if (!inputPrecio || !inputCantidad || !stockActualCell) return;

  let precio     = parseFloat(inputPrecio.value.replace(/\$|\./g, '').replace(',', '.'));
  let cantidad   = parseInt(inputCantidad.value);
  let stockActual = parseInt(stockActualCell.textContent.replace(/\$|\./g, '').replace(',', '.'));

  precio      = !isNaN(precio)      ? precio      : 0;
  cantidad    = !isNaN(cantidad)    ? cantidad    : 1;
  stockActual = !isNaN(stockActual) ? stockActual : 0;

  const subtotal = precio * cantidad;
  row.cells[6].textContent = formatCurrencyCL(subtotal);

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
  const filas = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  let total = 0;

  for (let i = 0; i < filas.length; i++) {
    let subtotal = parseFloat(filas[i].cells[6].textContent.replace(/\$|\./g, '').replace(',', '.'));
    subtotal = !isNaN(subtotal) ? subtotal : 0;
    total += subtotal;
  }

  const totalAmountInput = document.getElementById('total-amount');
  if (totalAmountInput) totalAmountInput.value = formatCurrencyCL(total);
}

function agregarProductoATabla(productoId, codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto) {
  const tbody = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
  const filas = tbody.rows;
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

  const stockNum = parseInt(stockActual) || 0;

  // Guardar el id numérico en la fila para usarlo al hacer submit
  filaDisponible.dataset.productoId = productoId;

  // Imagen
  const imgElement = filaDisponible.cells[0].querySelector("img");
  if (imagenProducto && imgElement) {
    imgElement.src = imagenProducto;
    imgElement.style.display = "block";
  }

  // Código y descripción
  filaDisponible.cells[1].textContent = codigoProducto;
  filaDisponible.cells[2].textContent = nombreProducto;

  // Precio
  const inputPrecio = filaDisponible.cells[3].querySelector("input");
  if (inputPrecio) {
    inputPrecio.value = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    inputPrecio.disabled = false;
    inputPrecio.addEventListener('input', function () {
      updateSubtotal(filaDisponible, false);
    });
  }

  // Cantidad con botones +/-
  filaDisponible.cells[4].innerHTML = `
    <div class="qty-control">
      <button type="button" class="qty-btn qty-btn--minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button>
      <input type="number" min="1" max="${stockNum}" value="1" class="presupuesto-tabla__input presupuesto-tabla__input--qty" />
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

  inputCantidad.addEventListener('input', function () { updateSubtotal(filaDisponible); });

  // Stock y subtotal
  filaDisponible.cells[5].textContent = stockActual;
  filaDisponible.cells[6].textContent = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

  calcularTotal();

  // Botón eliminar
  const botonEliminar = filaDisponible.cells[7].querySelector("button");
  if (botonEliminar) {
    botonEliminar.style.display = "block";
    botonEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    botonEliminar.addEventListener("click", function () {
      filaDisponible.cells[1].textContent = "";
      filaDisponible.cells[2].textContent = "";
      if (inputPrecio) { inputPrecio.value = ""; inputPrecio.disabled = true; }
      filaDisponible.cells[4].innerHTML = `<input type="number" min="1" value="0" class="presupuesto-tabla__input presupuesto-tabla__input--qty" disabled />`;
      filaDisponible.cells[5].textContent = "0";
      filaDisponible.cells[6].textContent = "";
      if (imgElement) imgElement.style.display = "none";
      botonEliminar.style.display = "none";
      calcularTotal();
    });
  }
}

// ── Todo lo que toca DOM va dentro de DOMContentLoaded ─────────────────────

document.addEventListener('DOMContentLoaded', function () {

  // Aviso de presupuesto
  Swal.fire({
    title: 'Está en la sección de Presupuesto',
    text: 'Recuerde que está realizando un presupuesto, no una factura.',
    icon: 'info',
    confirmButtonText: 'Entendido'
  });

  // Fecha por defecto
  const fechaPresupuestoInput = document.getElementById('fecha-presupuesto');
  if (fechaPresupuestoInput && !fechaPresupuestoInput.value) {
    fechaPresupuestoInput.value = fechaHoyYYYYMMDD();
  }

  // Prevenir Enter en formulario
  document.getElementById('invoice-form').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); return false; }
  });

  // Submit
  document.getElementById('invoice-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const filas = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    const invoiceItems = [];

    for (let i = 0; i < filas.length; i++) {
      const productoId  = filas[i].dataset.productoId || '';
      const codigo      = filas[i].cells[1].textContent.trim();
      const descripcion = filas[i].cells[2].textContent.trim();
      const precioInput = filas[i].cells[3].querySelector('input').value;
      let precio_unitario = parseFloat(precioInput.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim());
      let cantidad = parseInt(filas[i].cells[4].querySelector('input').value);
      const stock  = parseInt(filas[i].cells[5].textContent.trim());

      precio_unitario = !isNaN(precio_unitario) ? precio_unitario : 0;
      cantidad        = !isNaN(cantidad)         ? cantidad        : 1;

      if (cantidad > stock) {
        Swal.fire({ title: 'Stock insuficiente', text: `No hay stock suficiente en la fila ${i + 1}. Tiene ${stock}, desea presupuestar ${cantidad}.`, icon: 'error', confirmButtonText: 'Entendido' });
        return;
      }

      const subtotal = precio_unitario * cantidad;
      if (codigo !== '' && descripcion !== '' && precio_unitario > 0 && cantidad > 0) {
        invoiceItems.push({ producto_id: productoId || codigo, descripcion, precio_unitario, cantidad, subtotal });
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

    const fechaFactura  = fechaPresupuestoInput ? fechaPresupuestoInput.value.trim() : undefined;
    const nombreCliente = document.getElementById('nombre-cliente').value.trim();

    try {
      const response = await fetch('/productos/procesarFormulario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombreCliente, fechaPresupuesto: fechaFactura, totalPresupuesto: totalFactura, invoiceItems })
      });

      const data = await response.json();
      if (response.ok) {
        Swal.fire({ title: '¡Presupuesto guardado!', text: data.message, icon: 'success', confirmButtonText: 'Ir a productos' })
          .then(() => { window.location.href = '/productos'; });
      } else {
        throw new Error(data.error || 'Error al procesar el formulario');
      }
    } catch (error) {
      console.error('Error al enviar el formulario:', error);
      Swal.fire({ title: 'Error', text: 'Error al enviar formulario: ' + error.message, icon: 'error', confirmButtonText: 'Entendido' });
    }
  });

  // Buscador
  const entradaBusqueda   = document.getElementById('entradaBusqueda');
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  let timeoutId;

  // Buscador con debounce + AbortController (evita duplicados y requests fantasma)
  let _searchTimer = null;
  let _searchController = null;

  function renderResultados(productos) {
    resultadosBusqueda.innerHTML = '';
    if (!productos.length) {
      resultadosBusqueda.style.display = 'none';
      return;
    }
    productos.forEach((producto) => {
      const resultado = document.createElement('div');
      resultado.classList.add('resultado-busqueda');
      resultado.dataset.id           = producto.id;
      resultado.dataset.codigo       = producto.codigo;
      resultado.dataset.nombre       = producto.nombre;
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

      const nombreSpan = document.createElement('span');
      nombreSpan.textContent = producto.nombre;
      contenedor.appendChild(nombreSpan);
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
          this.dataset.id,
          this.dataset.codigo,
          this.dataset.nombre,
          this.dataset.precio_venta,
          this.dataset.stock_actual,
          this.dataset.imagen
        );
        // ✅ FIX: cerrar lista pero mantener el texto para buscar más productos
        resultadosBusqueda.style.display = 'none';
        // Enfocar el input para que el vendedor siga escribiendo sin hacer click
        entradaBusqueda.focus();
      });

      resultadosBusqueda.appendChild(resultado);
    });
    resultadosBusqueda.style.display = 'block';
  }

  entradaBusqueda.addEventListener('input', (e) => {
    const busqueda = e.target.value.trim();

    // Cancelar búsqueda anterior si todavía está en vuelo
    if (_searchController) { _searchController.abort(); _searchController = null; }
    clearTimeout(_searchTimer);

    if (!busqueda) {
      resultadosBusqueda.innerHTML = '';
      resultadosBusqueda.style.display = 'none';
      return;
    }

    // Debounce 280ms: esperar a que el usuario deje de escribir
    _searchTimer = setTimeout(async () => {
      _searchController = new AbortController();
      try {
        const respuesta = await fetch(
          '/productos/api/buscar?q=' + encodeURIComponent(busqueda),
          { signal: _searchController.signal }
        );
        const productos = await respuesta.json();
        renderResultados(productos);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[Buscador] Error al buscar:', err);
        }
        // Si fue abortado, ignorar silenciosamente
      }
    }, 280);
  });

  resultadosBusqueda.addEventListener('mouseleave', () => {
    timeoutId = setTimeout(() => { resultadosBusqueda.style.display = 'none'; }, 300);
  });

  resultadosBusqueda.addEventListener('mouseenter', () => {
    clearTimeout(timeoutId);
    resultadosBusqueda.style.display = 'block';
  });

  // Eventos inputs tabla
  document.querySelectorAll('#tabla-factura tbody tr').forEach(row => {
    const inputCantidad = row.cells[4].querySelector('input');
    const inputPrecio   = row.cells[3].querySelector('input');
    if (inputCantidad) inputCantidad.addEventListener('input', function () { updateSubtotal(row); });
    if (inputPrecio)   inputPrecio.addEventListener('input',   function () { updateSubtotal(row, false); });
  });

  // Prevenir Enter en inputs
  document.querySelectorAll('input:not(#entradaBusqueda):not(#headerEntradaBusqueda)').forEach(input => {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); return false; }
    });
  });

}); // ── END DOMContentLoaded