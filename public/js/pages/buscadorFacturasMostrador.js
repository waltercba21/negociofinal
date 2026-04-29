// buscadorFacturasMostrador.js — v2026-04-29-enhanced

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

  // Verificar si el producto ya está en la tabla
  for (let i = 0; i < filas.length; i++) {
    if (filas[i].cells[1].textContent.trim() === String(codigoProducto).trim()) {
      // Producto ya en tabla: incrementar cantidad en 1
      const inputQty = filas[i].cells[4].querySelector('input');
      const stockNum = parseInt(filas[i].cells[5].textContent) || 0;
      if (inputQty) {
        const actual = parseInt(inputQty.value) || 1;
        if (actual < stockNum) {
          inputQty.value = actual + 1;
          updateSubtotal(filas[i]);
          // Feedback visual: flash en la fila
          filas[i].classList.add('row-flash');
          setTimeout(() => filas[i].classList.remove('row-flash'), 600);
        } else {
          Swal.fire({ title: 'Stock insuficiente', text: `Solo hay ${stockNum} unidades disponibles.`, icon: 'warning', confirmButtonText: 'Entendido' });
        }
      }
      return;
    }
  }

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

  // Si es PRODUCTO PRUEBA → celda de descripción con input editable
  const esPrueba = nombreProducto.trim().toUpperCase() === 'PRODUCTO PRUEBA';
  if (esPrueba) {
    filaDisponible.cells[2].innerHTML =
      `<input type="text"
              class="facturas-tabla__desc-input"
              placeholder="Escribir nombre del producto…"
              value=""
              autocomplete="off" />`;
    filaDisponible.cells[2].querySelector('input')
      .addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  } else {
    filaDisponible.cells[2].textContent = nombreProducto;
  }

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
      filaDisponible.cells[2].innerHTML = "";
      if (inputPrecio) { inputPrecio.value = ""; inputPrecio.disabled = true; }
      filaDisponible.cells[4].innerHTML = `<input type="number" min="1" value="0" class="facturas-tabla__input facturas-tabla__input--qty" disabled />`;
      filaDisponible.cells[5].textContent = "";
      filaDisponible.cells[6].textContent = "";
      if (imgElement) imgElement.style.display = "none";
      botonEliminar.style.display = "none";
      calcularTotal();
      // Actualizar contadores en el buscador si está activo
      _actualizarContadoresEnResultados();
    });
  }

  // Animar entrada de la nueva fila
  filaDisponible.classList.add('row-new');
  setTimeout(() => filaDisponible.classList.remove('row-new'), 500);
}

// ── Estado global del buscador avanzado ───────────────────────────────────
let _productosEnBusqueda = []; // Cache de los últimos resultados

/**
 * Devuelve un objeto { codigo → { cantidad, filaIndex } } con los productos ya en tabla.
 */
function _obtenerProductosEnTabla() {
  const mapa = {};
  const filas = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  for (let i = 0; i < filas.length; i++) {
    const cod = filas[i].cells[1].textContent.trim();
    if (cod) {
      const qty = parseInt(filas[i].cells[4].querySelector('input')?.value) || 1;
      mapa[cod] = { cantidad: qty, filaIndex: i };
    }
  }
  return mapa;
}

/**
 * Refresca los badges de cantidad y botones de eliminar en los resultados visibles,
 * sin disparar una nueva búsqueda.
 */
function _actualizarContadoresEnResultados() {
  const enTabla = _obtenerProductosEnTabla();
  document.querySelectorAll('.resultado-busqueda').forEach(el => {
    const cod = el.dataset.codigo;
    const badgeEl = el.querySelector('.srb-badge');
    const deleteBtn = el.querySelector('.srb-delete');
    const qtyMinus = el.querySelector('.srb-qty-minus');
    const qtyPlus  = el.querySelector('.srb-qty-plus');
    const qtyVal   = el.querySelector('.srb-qty-val');

    if (enTabla[cod]) {
      const info = enTabla[cod];
      if (badgeEl)  { badgeEl.textContent = info.cantidad; badgeEl.style.display = 'inline-flex'; }
      if (deleteBtn) deleteBtn.style.display = 'flex';
      if (qtyMinus)  qtyMinus.style.display = 'flex';
      if (qtyPlus)   qtyPlus.style.display  = 'flex';
      if (qtyVal)    { qtyVal.textContent = info.cantidad; qtyVal.style.display = 'inline-block'; }
      el.classList.add('en-tabla');
    } else {
      if (badgeEl)   { badgeEl.textContent = ''; badgeEl.style.display = 'none'; }
      if (deleteBtn)  deleteBtn.style.display = 'none';
      if (qtyMinus)   qtyMinus.style.display = 'none';
      if (qtyPlus)    qtyPlus.style.display  = 'none';
      if (qtyVal)     qtyVal.style.display   = 'none';
      el.classList.remove('en-tabla');
    }
  });
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
      const descInput = filasFactura[i].cells[2].querySelector('input.facturas-tabla__desc-input');
      const descripcion = descInput
        ? (descInput.value.trim() || 'PRODUCTO PRUEBA')
        : filasFactura[i].cells[2].textContent.trim();
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
        invoiceItems.push({
          producto_id: codigo,
          descripcion,
          es_producto_prueba: !!descInput,
          precio_unitario,
          cantidad,
          subtotal
        });
        totalSinInteres += subtotal;
      }
    }

    if (invoiceItems.length === 0) {
      Swal.fire({ title: 'Error', text: 'Debe agregar al menos un producto válido antes de continuar.', icon: 'error', confirmButtonText: 'Entendido' });
      return;
    }

    const fechaFacturaElement = document.getElementById('fecha-presupuesto');
    const fechaFactura = fechaFacturaElement ? fechaFacturaElement.value.trim() : undefined;
    const nombreClienteInput = document.getElementById('nombre-cliente');
    const nombreCliente = nombreClienteInput ? nombreClienteInput.value.trim() : '';

    const esCredito = metodosPagoSeleccionados.value === 'CREDITO';
    const factorInteres = esCredito ? 1.15 : 1;
    let interesCalculado = 0;

    const invoiceItemsConInteres = invoiceItems.map(item => {
      const pu  = item.precio_unitario * factorInteres;
      const sub = item.subtotal        * factorInteres;
      return { ...item, precio_unitario: pu, subtotal: sub };
    });

    if (esCredito) interesCalculado = totalSinInteres * 0.15;
    const totalConInteres = totalSinInteres + interesCalculado;

    const filasHTML = invoiceItemsConInteres.map((item, index) => `
      <tr>
        <td style="padding:4px 6px;text-align:center;">${index + 1}</td>
        <td style="padding:4px 6px;">${item.producto_id}</td>
        <td style="padding:4px 6px;">${item.descripcion}</td>
        <td style="padding:4px 6px;text-align:right;">${formatCurrencyCL(item.precio_unitario)}</td>
        <td style="padding:4px 6px;text-align:center;">${item.cantidad}</td>
        <td style="padding:4px 6px;text-align:right;font-weight:500;">${formatCurrencyCL(item.subtotal)}</td>
      </tr>`).join('');

    const bloqueInteres = esCredito ? `
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.9rem;">
        <span>Subtotal (sin recargo)</span>
        <span>${formatCurrencyCL(totalSinInteres)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.9rem;color:#c07000;">
        <span>⚡ Recargo tarjeta crédito (15%)</span>
        <span>+ ${formatCurrencyCL(interesCalculado)}</span>
      </div>` : '';

    const resumenHTML = `
      <div class="resumen-factura-modal">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px;font-size:0.9rem;">
          <span><strong>Vendedor:</strong> ${nombreCliente || '-'}</span>
          <span><strong>Fecha:</strong> ${fechaFactura || fechaHoyYYYYMMDD()}</span>
          <span><strong>Pago:</strong> ${metodosPagoSeleccionados.value}${esCredito ? ' &nbsp;💳 +15%' : ''}</span>
        </div>
        <div style="max-height:260px;overflow:auto;border:1px solid #ddd;border-radius:6px;">
          <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
            <thead>
              <tr style="background:#f5f5f5;position:sticky;top:0;">
                <th style="border-bottom:1px solid #ddd;padding:6px 6px;text-align:center;">#</th>
                <th style="border-bottom:1px solid #ddd;padding:6px 6px;">Código</th>
                <th style="border-bottom:1px solid #ddd;padding:6px 6px;">Descripción</th>
                <th style="border-bottom:1px solid #ddd;padding:6px 6px;text-align:right;">P. Unitario${esCredito ? '*' : ''}</th>
                <th style="border-bottom:1px solid #ddd;padding:6px 6px;text-align:center;">Cant.</th>
                <th style="border-bottom:1px solid #ddd;padding:6px 6px;text-align:right;">Subtotal${esCredito ? '*' : ''}</th>
              </tr>
            </thead>
            <tbody>${filasHTML}</tbody>
          </table>
        </div>
        ${esCredito ? `<p style="font-size:0.78rem;color:#888;margin:4px 0 8px;">* Precios ya incluyen el recargo del 15% por tarjeta de crédito.</p>` : ''}
        <div style="border-top:1px solid #ddd;margin-top:8px;padding-top:8px;">
          ${bloqueInteres}
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:1.05rem;font-weight:700;border-top:1px solid #ddd;margin-top:4px;">
            <span>Total a cobrar</span>
            <span>${formatCurrencyCL(totalConInteres)}</span>
          </div>
        </div>
        <p style="margin-top:8px;font-size:0.82rem;color:#888;">Revisá los datos antes de guardar. Si algo está mal, presioná "Revisar".</p>
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
          totalPresupuesto: totalConInteres.toFixed(2),
          invoiceItems: invoiceItemsConInteres,
          metodosPago: metodosPagoSeleccionados.value
        })
      });

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (_) {
        console.error('[Factura] Respuesta no-JSON del servidor:', rawText.substring(0, 500));
        Swal.fire({
          title: 'Error del servidor',
          html: `<p>El servidor devolvió una respuesta inesperada.</p>
                 <pre style="text-align:left;font-size:11px;max-height:200px;overflow:auto;background:#111c30;color:#f0f4ff;padding:10px;border-radius:8px;">${rawText.substring(0, 600)}</pre>`,
          icon: 'error',
          confirmButtonText: 'Entendido'
        });
        return;
      }
      if (response.ok) {
        const facturaId = data.facturaId;
        await mostrarModalARCA(facturaId, totalConInteres);
      } else {
        throw new Error(data.error || 'Error al procesar el formulario');
      }
    } catch (error) {
      console.error('Error al enviar el formulario:', error);
      Swal.fire({ title: 'Error', text: 'Error al enviar formulario: ' + error.message, icon: 'error', confirmButtonText: 'Entendido' });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BUSCADOR AVANZADO — mantiene texto, controles qty y borrar desde dropdown
  // ══════════════════════════════════════════════════════════════════════════

  const entradaBusqueda = document.getElementById('entradaBusqueda');
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  let timeoutId;
  let _searchTimer = null;
  let _searchController = null;
  let _keepResultsOpen = false; // flag para no cerrar al hacer click en controles internos

  /**
   * Construye el elemento de resultado con:
   *   - Imagen + nombre del producto
   *   - Badge de cantidad (si ya está en tabla)
   *   - Controles qty: [-] [N] [+]  (visibles solo si está en tabla)
   *   - Botón eliminar de tabla (visible solo si está en tabla)
   */
  function crearElementoResultado(producto, enTabla) {
    const cod = producto.codigo;
    const enTablaInfo = enTabla[cod];

    const resultado = document.createElement('div');
    resultado.classList.add('resultado-busqueda');
    if (enTablaInfo) resultado.classList.add('en-tabla');
    resultado.dataset.codigo       = cod;
    resultado.dataset.nombre       = producto.nombre;
    resultado.dataset.precio_venta = producto.precio_venta;
    resultado.dataset.stock_actual = producto.stock_actual;
    if (producto.imagenes && producto.imagenes.length > 0) {
      resultado.dataset.imagen = '/uploads/productos/' + producto.imagenes[0].imagen;
    }

    // ── Lado izquierdo: imagen + nombre ──────────────────────────────────────
    const izquierda = document.createElement('div');
    izquierda.classList.add('resultado-contenedor');

    if (producto.imagenes && producto.imagenes.length > 0) {
      const imagen = document.createElement('img');
      imagen.src = '/uploads/productos/' + producto.imagenes[0].imagen;
      imagen.classList.add('miniatura');
      imagen.loading = 'lazy';
      imagen.decoding = 'async';
      izquierda.appendChild(imagen);
    }

    const nombreSpan = document.createElement('span');
    nombreSpan.classList.add('srb-nombre');
    nombreSpan.textContent = producto.nombre;
    izquierda.appendChild(nombreSpan);

    // Badge cantidad (siempre presente pero oculto si no está en tabla)
    const badge = document.createElement('span');
    badge.classList.add('srb-badge');
    badge.textContent = enTablaInfo ? enTablaInfo.cantidad : '';
    badge.style.display = enTablaInfo ? 'inline-flex' : 'none';
    izquierda.appendChild(badge);

    resultado.appendChild(izquierda);

    // ── Lado derecho: controles qty + eliminar ────────────────────────────────
    const derecha = document.createElement('div');
    derecha.classList.add('srb-controles');

    // Botón restar cantidad
    const btnMinus = document.createElement('button');
    btnMinus.type = 'button';
    btnMinus.classList.add('srb-qty-minus', 'srb-btn');
    btnMinus.innerHTML = '<i class="fa-solid fa-minus"></i>';
    btnMinus.style.display = enTablaInfo ? 'flex' : 'none';
    btnMinus.title = 'Restar 1 unidad';

    // Display cantidad
    const qtyVal = document.createElement('span');
    qtyVal.classList.add('srb-qty-val');
    qtyVal.textContent = enTablaInfo ? enTablaInfo.cantidad : '';
    qtyVal.style.display = enTablaInfo ? 'inline-block' : 'none';

    // Botón sumar cantidad
    const btnPlus = document.createElement('button');
    btnPlus.type = 'button';
    btnPlus.classList.add('srb-qty-plus', 'srb-btn');
    btnPlus.innerHTML = '<i class="fa-solid fa-plus"></i>';
    btnPlus.style.display = enTablaInfo ? 'flex' : 'none';
    btnPlus.title = 'Agregar 1 unidad';

    // Botón eliminar de tabla
    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.classList.add('srb-delete', 'srb-btn');
    btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i>';
    btnDelete.style.display = enTablaInfo ? 'flex' : 'none';
    btnDelete.title = 'Quitar de la factura';

    derecha.appendChild(btnMinus);
    derecha.appendChild(qtyVal);
    derecha.appendChild(btnPlus);
    derecha.appendChild(btnDelete);
    resultado.appendChild(derecha);

    // ── Eventos ───────────────────────────────────────────────────────────────

    // Click en el resultado (lado izquierdo / nombre) → agregar a tabla o incrementar
    izquierda.addEventListener('click', () => {
      agregarProductoATabla(
        resultado.dataset.codigo,
        resultado.dataset.nombre,
        resultado.dataset.precio_venta,
        resultado.dataset.stock_actual,
        resultado.dataset.imagen
      );
      _actualizarContadoresEnResultados();
      // ✅ FIX PRINCIPAL: NO borrar el texto del buscador, solo mantener el foco
      entradaBusqueda.focus();
    });

    // Botón [+]: incrementar cantidad en tabla
    btnPlus.addEventListener('mousedown', e => { e.preventDefault(); _keepResultsOpen = true; });
    btnPlus.addEventListener('click', (e) => {
      e.stopPropagation();
      agregarProductoATabla(
        resultado.dataset.codigo,
        resultado.dataset.nombre,
        resultado.dataset.precio_venta,
        resultado.dataset.stock_actual,
        resultado.dataset.imagen
      );
      _actualizarContadoresEnResultados();
      entradaBusqueda.focus();
      _keepResultsOpen = false;
    });

    // Botón [-]: restar cantidad en tabla (si llega a 0 → eliminar fila)
    btnMinus.addEventListener('mousedown', e => { e.preventDefault(); _keepResultsOpen = true; });
    btnMinus.addEventListener('click', (e) => {
      e.stopPropagation();
      const filas = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
      for (let i = 0; i < filas.length; i++) {
        if (filas[i].cells[1].textContent.trim() === String(cod).trim()) {
          const inputQty = filas[i].cells[4].querySelector('input');
          if (inputQty) {
            const actual = parseInt(inputQty.value) || 1;
            if (actual > 1) {
              inputQty.value = actual - 1;
              updateSubtotal(filas[i]);
            } else {
              // Cantidad llega a 0 → simular click en eliminar
              const boton = filas[i].cells[7].querySelector('button');
              if (boton) boton.click();
            }
          }
          break;
        }
      }
      _actualizarContadoresEnResultados();
      entradaBusqueda.focus();
      _keepResultsOpen = false;
    });

    // Botón papelera: eliminar fila completa de la tabla
    btnDelete.addEventListener('mousedown', e => { e.preventDefault(); _keepResultsOpen = true; });
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      const filas = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
      for (let i = 0; i < filas.length; i++) {
        if (filas[i].cells[1].textContent.trim() === String(cod).trim()) {
          const boton = filas[i].cells[7].querySelector('button');
          if (boton) boton.click();
          break;
        }
      }
      _actualizarContadoresEnResultados();
      entradaBusqueda.focus();
      _keepResultsOpen = false;
    });

    // Hover
    resultado.addEventListener('mouseenter', function () {
      document.querySelectorAll('.resultado-busqueda').forEach(r => r.classList.remove('hover-activo'));
      this.classList.add('hover-activo');
    });
    resultado.addEventListener('mouseleave', function () {
      this.classList.remove('hover-activo');
    });

    return resultado;
  }

  function renderResultadosMostrador(productos) {
    _productosEnBusqueda = productos;
    resultadosBusqueda.innerHTML = '';

    if (!productos.length) {
      resultadosBusqueda.style.display = 'none';
      return;
    }

    const enTabla = _obtenerProductosEnTabla();

    productos.forEach((producto) => {
      resultadosBusqueda.appendChild(crearElementoResultado(producto, enTabla));
    });

    resultadosBusqueda.style.display = 'block';
  }

  // ── Input del buscador ───────────────────────────────────────────────────
  entradaBusqueda.addEventListener('input', (e) => {
    const busqueda = e.target.value.trim();

    resultadosBusqueda.innerHTML = '';
    resultadosBusqueda.style.display = 'none';

    if (_searchController) { _searchController.abort(); _searchController = null; }
    clearTimeout(_searchTimer);

    if (!busqueda) return;

    const queryCapturada = busqueda;

    _searchTimer = setTimeout(async () => {
      _searchController = new AbortController();
      try {
        const respuesta = await fetch(
          '/productos/api/buscar?q=' + encodeURIComponent(busqueda),
          { signal: _searchController.signal }
        );
        const productos = await respuesta.json();

        // Stale-check: descartar si la query cambió mientras viajaba
        if (entradaBusqueda.value.trim() !== queryCapturada) return;

        renderResultadosMostrador(productos);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('[BuscadorFacturas] Error al buscar:', err);
      }
    }, 300);
  });

  // Cerrar resultados al perder el foco (excepto cuando se interactúa con controles internos)
  entradaBusqueda.addEventListener('blur', () => {
    if (_keepResultsOpen) return;
    timeoutId = setTimeout(() => {
      resultadosBusqueda.style.display = 'none';
    }, 200);
  });

  entradaBusqueda.addEventListener('focus', () => {
    clearTimeout(timeoutId);
    if (_productosEnBusqueda.length > 0 && entradaBusqueda.value.trim()) {
      renderResultadosMostrador(_productosEnBusqueda);
    }
  });

  resultadosBusqueda.addEventListener('mouseleave', () => {
    if (_keepResultsOpen) return;
    timeoutId = setTimeout(() => { resultadosBusqueda.style.display = 'none'; }, 300);
  });

  resultadosBusqueda.addEventListener('mouseenter', () => {
    clearTimeout(timeoutId);
    resultadosBusqueda.style.display = 'block';
  });

  // Teclas de navegación en el buscador
  entradaBusqueda.addEventListener('keydown', (e) => {
    const items = resultadosBusqueda.querySelectorAll('.resultado-busqueda');
    if (!items.length) return;
    const activo = resultadosBusqueda.querySelector('.hover-activo');
    let idx = [...items].indexOf(activo);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[Math.min(idx + 1, items.length - 1)];
      items.forEach(r => r.classList.remove('hover-activo'));
      next.classList.add('hover-activo');
      next.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[Math.max(idx - 1, 0)];
      items.forEach(r => r.classList.remove('hover-activo'));
      prev.classList.add('hover-activo');
      prev.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && activo) {
      e.preventDefault();
      const contenedor = activo.querySelector('.resultado-contenedor');
      if (contenedor) contenedor.click();
    } else if (e.key === 'Escape') {
      resultadosBusqueda.style.display = 'none';
      resultadosBusqueda.innerHTML = '';
      _productosEnBusqueda = [];
    }
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


/* ═══════════════════════════════════════════════════════════
   ARCA — Emisión desde factura mostrador
   Se llama después de guardar exitosamente la factura interna.
   No toca stock, no toca el backend de facturas.
═══════════════════════════════════════════════════════════ */

async function mostrarModalARCA(facturaId, totalConInteres) {

  // ── Paso 1: elegir tipo de emisión ──────────────────────
  const htmlPaso1 = `
    <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">

      <button id="arca-btn-cf" type="button" style="
        display:flex;align-items:center;gap:14px;
        padding:16px 20px;border-radius:14px;
        background:rgba(31,72,126,.15);border:1.5px solid rgba(31,72,126,.4);
        color:#f0f4ff;font-size:1rem;font-weight:700;cursor:pointer;
        transition:background .15s;text-align:left;width:100%">
        <i class="fa-solid fa-receipt" style="font-size:1.4rem;color:#7aaee8;flex-shrink:0"></i>
        <div>
          <div style="font-size:.95rem;font-weight:800">Factura B — Consumidor Final</div>
          <div style="font-size:.78rem;color:#8fa3c0;margin-top:3px">Sin CUIT · Emisión en un click</div>
        </div>
      </button>

      <button id="arca-btn-cuit" type="button" style="
        display:flex;align-items:center;gap:14px;
        padding:16px 20px;border-radius:14px;
        background:rgba(99,102,241,.1);border:1.5px solid rgba(99,102,241,.3);
        color:#f0f4ff;font-size:1rem;font-weight:700;cursor:pointer;
        transition:background .15s;text-align:left;width:100%">
        <i class="fa-solid fa-building" style="font-size:1.4rem;color:#a5b4fc;flex-shrink:0"></i>
        <div>
          <div style="font-size:.95rem;font-weight:800">Factura B/A — Con CUIT</div>
          <div style="font-size:.78rem;color:#8fa3c0;margin-top:3px">Responsable Inscripto · ingresar CUIT</div>
        </div>
      </button>

      <button id="arca-btn-saltar" type="button" style="
        display:flex;align-items:center;gap:10px;
        padding:12px 20px;border-radius:10px;
        background:transparent;border:1px solid rgba(255,255,255,.08);
        color:#4d6380;font-size:.85rem;cursor:pointer;
        transition:color .15s;text-align:left;width:100%">
        <i class="fa-solid fa-forward" style="flex-shrink:0"></i>
        Solo guardar, emitir ARCA más tarde
      </button>
    </div>`;

  const paso1 = await Swal.fire({
    title: '<span style="font-size:1rem;letter-spacing:.08em;text-transform:uppercase;color:#7aaee8">Factura #' + facturaId + ' guardada</span>',
    html: htmlPaso1,
    background: '#111c30',
    color: '#f0f4ff',
    showConfirmButton: false,
    showCloseButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    width: '460px',
    didOpen: () => {
      document.getElementById('arca-btn-cf').addEventListener('click', () => Swal.clickConfirm());
      document.getElementById('arca-btn-cuit').addEventListener('click', () => Swal.close({ isDenied: true, value: 'cuit' }));
      document.getElementById('arca-btn-saltar').addEventListener('click', () => Swal.close({ isDismissed: true }));
    },
    preConfirm: () => 'cf'
  });

  // Saltar → ir directo a productos
  if (paso1.isDismissed) {
    window.location.href = '/productos';
    return;
  }

  // ── Consumidor Final ──────────────────────────────────────────────────────
  if (paso1.isConfirmed && paso1.value === 'cf') {
    await _emitirARCA(facturaId, { cbte_tipo: 6, doc_tipo: 99, doc_nro: 0, receptor_cond_iva_id: 5 });
    return;
  }

  // ── Con CUIT ──────────────────────────────────────────────────────────────
  const paso2 = await Swal.fire({
    title: '<span style="font-size:1rem;color:#a5b4fc">Datos del receptor</span>',
    html: `
      <div style="display:flex;flex-direction:column;gap:14px;text-align:left;padding:4px 0">

        <div>
          <label style="font-size:.8rem;color:#8fa3c0;font-weight:700;letter-spacing:.04em">TIPO DE FACTURA</label>
          <div style="display:flex;gap:10px;margin-top:6px">
            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;color:#f0f4ff;font-size:.9rem">
              <input type="radio" name="af-cbte" value="6" checked> Factura B
            </label>
            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;color:#f0f4ff;font-size:.9rem">
              <input type="radio" name="af-cbte" value="1"> Factura A
            </label>
          </div>
        </div>

        <div>
          <label style="font-size:.8rem;color:#8fa3c0;font-weight:700;letter-spacing:.04em">CONDICIÓN IVA RECEPTOR</label>
          <select id="af-cond" style="width:100%;margin-top:6px;padding:9px 12px;background:#1a2a40;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#f0f4ff;font-size:.88rem">
            <option value="5" selected>Consumidor Final (5)</option>
            <option value="4">Exento (4)</option>
            <option value="6">Monotributista (6)</option>
            <option value="1">Responsable Inscripto (1)</option>
          </select>
        </div>

        <div>
          <label style="font-size:.8rem;color:#8fa3c0;font-weight:700;letter-spacing:.04em">CUIT / CUIL *</label>
          <input id="af-cuit" type="text" maxlength="11" placeholder="Ej: 20304050607"
            style="width:100%;margin-top:6px;padding:9px 12px;background:#1a2a40;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#f0f4ff;font-size:.95rem;box-sizing:border-box">
        </div>

        <div>
          <label style="font-size:.8rem;color:#8fa3c0;font-weight:700;letter-spacing:.04em">RAZÓN SOCIAL (opcional)</label>
          <input id="af-nombre" type="text" placeholder="Dejar vacío para resolver por CUIT"
            style="width:100%;margin-top:6px;padding:9px 12px;background:#1a2a40;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#f0f4ff;font-size:.88rem;box-sizing:border-box">
        </div>

        <div>
          <label style="font-size:.8rem;color:#8fa3c0;font-weight:700;letter-spacing:.04em">DOMICILIO (opcional)</label>
          <input id="af-dom" type="text" placeholder="Dejar vacío para resolver por CUIT"
            style="width:100%;margin-top:6px;padding:9px 12px;background:#1a2a40;border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#f0f4ff;font-size:.88rem;box-sizing:border-box">
        </div>

        <div id="af-err" style="display:none;color:#f87171;font-size:.82rem;padding:8px 12px;background:rgba(248,113,113,.07);border-radius:8px;border:1px solid rgba(248,113,113,.2)"></div>
      </div>`,
    background: '#111c30',
    color: '#f0f4ff',
    confirmButtonText: 'Emitir comprobante',
    cancelButtonText: 'Cancelar',
    showCancelButton: true,
    reverseButtons: true,
    width: '480px',
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: { confirmButton: 'af-apps-confirm' },
    preConfirm: () => {
      const errEl = document.getElementById('af-err');
      errEl.style.display = 'none';

      const cbte_tipo  = Number(document.querySelector('input[name="af-cbte"]:checked')?.value || 6);
      const cond_iva   = Number(document.getElementById('af-cond')?.value || 5);
      const cuitVal    = document.getElementById('af-cuit')?.value.replace(/\D/g,'') || '';
      const receptorNombre = document.getElementById('af-nombre')?.value.trim() || '';
      const receptorDom    = document.getElementById('af-dom')?.value.trim()    || '';

      if (!cuitVal || cuitVal.length < 10) {
        errEl.textContent = 'Ingresá un CUIT/CUIL válido (10 u 11 dígitos).';
        errEl.style.display = 'block';
        return false;
      }

      if (cbte_tipo === 1 && cond_iva !== 1) {
        errEl.textContent = 'Factura A requiere condición IVA: Responsable Inscripto (1).';
        errEl.style.display = 'block';
        return false;
      }
      if (cbte_tipo === 6 && cond_iva === 1) {
        errEl.textContent = 'Factura B no acepta condición IVA Responsable Inscripto. Usá Factura A.';
        errEl.style.display = 'block';
        return false;
      }

      return { cbte_tipo, doc_nro: Number(cuitVal), cond_iva, receptorNombre, receptorDom };
    }
  });

  if (!paso2.isConfirmed) { window.location.href = '/productos'; return; }

  const { cbte_tipo, doc_nro, cond_iva, receptorNombre, receptorDom } = paso2.value;

  const cuitPayload = { cbte_tipo, doc_tipo: 80, doc_nro, receptor_cond_iva_id: cond_iva };
  if (receptorNombre) cuitPayload.receptor_nombre    = receptorNombre;
  if (receptorDom)    cuitPayload.receptor_domicilio = receptorDom;

  await _emitirARCA(facturaId, cuitPayload, !receptorNombre);
}


/* ── Llamada real al endpoint ARCA ── */
async function _emitirARCA(facturaId, payload, resolveReceptor = false) {

  Swal.fire({
    title: 'Emitiendo comprobante ARCA…',
    html: '<p style="color:#8fa3c0;font-size:.9rem">Conectando con WSFE · no cerrar esta ventana</p>',
    background: '#111c30',
    color: '#f0f4ff',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const qs = resolveReceptor ? '?resolve_receptor=1' : '';
    const resp = await fetch(`/arca/emitir-desde-factura/${facturaId}${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (resp.ok && data.estado === 'EMITIDO') {
      const tipoLabel = (data.cbte_tipo === 1 || data.cbte_tipo === 51) ? 'Factura A' : 'Factura B';
      const pdfUrl   = `/arca/pdf/${data.arca_id}`;

      await Swal.fire({
        icon: 'success',
        title: '<span style="color:#4ade80">✓ Comprobante emitido</span>',
        html: `
          <div style="text-align:left;display:flex;flex-direction:column;gap:8px;margin-top:8px">
            <div style="display:flex;justify-content:space-between;padding:10px 14px;background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.2);border-radius:10px">
              <span style="color:#4d6380;font-size:.82rem;font-weight:700">CAE</span>
              <strong style="color:#f0f4ff;font-family:monospace;font-size:.9rem">${data.cae || '-'}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 14px;background:rgba(31,72,126,.1);border-radius:10px">
              <span style="color:#4d6380;font-size:.82rem;font-weight:700">Comprobante N°</span>
              <strong style="color:#f0f4ff">${String(data.cbte_nro || '-').padStart(8,'0')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 14px;background:rgba(31,72,126,.1);border-radius:10px">
              <span style="color:#4d6380;font-size:.82rem;font-weight:700">Tipo</span>
              <strong style="color:#f0f4ff">${tipoLabel}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 14px;background:rgba(31,72,126,.1);border-radius:10px">
              <span style="color:#4d6380;font-size:.82rem;font-weight:700">Vto. CAE</span>
              <strong style="color:#f0f4ff">${_formatFecha8(data.cae_vto)}</strong>
            </div>

            <a href="${pdfUrl}" target="_blank" rel="noopener"
               style="display:flex;align-items:center;justify-content:center;gap:10px;
                      margin-top:6px;padding:13px 20px;border-radius:12px;
                      background:rgba(31,72,126,.25);border:1.5px solid rgba(31,72,126,.5);
                      color:#c0d8f8;font-size:.9rem;font-weight:800;
                      text-decoration:none;letter-spacing:.04em">
              <i class="fa-solid fa-print"></i>
              Imprimir / Ver PDF
            </a>
          </div>`,
        background: '#111c30',
        color: '#f0f4ff',
        confirmButtonText: 'Ir a productos',
        customClass: { confirmButton: 'af-apps-confirm' },
        allowOutsideClick: false
      });
      window.location.href = '/productos';
      return;
    }

    if (resp.status === 202 || data.estado === 'PENDIENTE') {
      await Swal.fire({
        icon: 'warning',
        title: '<span style="color:#fbbf24">⚠ Pendiente de confirmación</span>',
        html: `
          <p style="color:#8fa3c0;font-size:.88rem;margin-bottom:12px">
            WSFE no confirmó el comprobante en este momento. La factura interna quedó guardada.
            Verificá el estado en el panel ARCA antes de reimprimir o reemitir.
          </p>
          <div style="padding:10px 14px;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);border-radius:10px;font-size:.82rem;color:#fbbf24">
            ${data.obs_msg || data.error || 'Sin detalle disponible'}
          </div>`,
        background: '#111c30',
        color: '#f0f4ff',
        confirmButtonText: 'Entendido',
        customClass: { confirmButton: 'af-apps-confirm' },
        allowOutsideClick: false
      });
      window.location.href = '/productos';
      return;
    }

    if (resp.status === 409) {
      await Swal.fire({
        icon: 'info',
        title: 'Ya existe un comprobante ARCA',
        html: `<p style="color:#8fa3c0;font-size:.88rem">
          Esta factura ya tiene un comprobante ARCA en estado <strong style="color:#f0f4ff">${data.estado}</strong>.
          ${data.cae ? `<br>CAE: <code style="color:#7aaee8">${data.cae}</code>` : ''}
          </p>`,
        background: '#111c30',
        color: '#f0f4ff',
        confirmButtonText: 'Ir a productos',
        customClass: { confirmButton: 'af-apps-confirm' }
      });
      window.location.href = '/productos';
      return;
    }

    const detalle = data.error || data.obs_msg || JSON.stringify(data);
    await Swal.fire({
      icon: 'error',
      title: '<span style="color:#f87171">Error al emitir en ARCA</span>',
      html: `
        <p style="color:#8fa3c0;font-size:.85rem;margin-bottom:10px">
          La factura interna quedó guardada. Podés reintentar la emisión desde el panel ARCA.
        </p>
        <pre style="text-align:left;font-size:.75rem;max-height:180px;overflow:auto;
                    background:rgba(217,4,41,.05);border:1px solid rgba(217,4,41,.2);
                    color:#fca5a5;padding:10px;border-radius:8px;white-space:pre-wrap">${String(detalle).substring(0, 600)}</pre>`,
      background: '#111c30',
      color: '#f0f4ff',
      confirmButtonText: 'Ir a productos',
      customClass: { confirmButton: 'af-apps-confirm' },
      allowOutsideClick: false
    });
    window.location.href = '/productos';

  } catch (err) {
    await Swal.fire({
      icon: 'error',
      title: 'Error de conexión con ARCA',
      html: `<p style="color:#8fa3c0;font-size:.85rem">
        No se pudo conectar con el servicio ARCA. La factura interna quedó guardada correctamente.
        Podés reintentar la emisión desde el panel ARCA.
        </p>
        <code style="font-size:.78rem;color:#f87171">${err.message || String(err)}</code>`,
      background: '#111c30',
      color: '#f0f4ff',
      confirmButtonText: 'Ir a productos',
      customClass: { confirmButton: 'af-apps-confirm' },
      allowOutsideClick: false
    });
    window.location.href = '/productos';
  }
}

/* ── Helper: formatea fecha YYYYMMDD → DD/MM/YYYY ── */
function _formatFecha8(f) {
  if (!f || String(f).length !== 8) return f || '-';
  return `${f.slice(6,8)}/${f.slice(4,6)}/${f.slice(0,4)}`;
}