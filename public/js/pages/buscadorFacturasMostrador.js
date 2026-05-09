// buscadorFacturasMostrador.js — v2026-04-29-v2

function fechaHoyYYYYMMDD(timeZone = 'America/Argentina/Cordoba') {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

function formatCurrencyCL(valor) {
  const num = Number(valor) || 0;
  return num.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

// ── Funciones puras ─────────────────────────────────────────────────────────

function updateSubtotal(row, verificarStock = true) {
  const inputPrecio     = row.cells[3].querySelector('input');
  const inputCantidad   = row.cells[4].querySelector('input');
  const stockActualCell = row.cells[5];
  if (!inputPrecio || !inputCantidad || !stockActualCell) return;

  let precio     = parseFloat(inputPrecio.value.replace(/\$|\./g, '').replace(',', '.'));
  let cantidad   = parseInt(inputCantidad.value);
  let stockActual = parseInt(stockActualCell.textContent.replace(/\$|\./g, '').replace(',', '.'));

  precio      = !isNaN(precio)      ? precio      : 0;
  cantidad    = !isNaN(cantidad)    ? cantidad    : 1;
  stockActual = !isNaN(stockActual) ? stockActual : 0;

  const subtotal = precio * cantidad;
  row.cells[6].textContent = subtotal.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

  if (verificarStock && document.activeElement === inputCantidad) {
    if (cantidad > stockActual) {
      Swal.fire({ title: 'ALERTA', text: 'NO HAY STOCK DISPONIBLE. Solo hay ' + stockActual + ' unidades en stock.', icon: 'error', confirmButtonText: 'Entendido' });
      inputCantidad.value = stockActual > 0 ? stockActual : 1;
    }
    const stockRestante = stockActual - cantidad;
    if (stockRestante <= 5 && stockRestante >= 0) {
      Swal.fire({ title: 'ALERTA', text: 'LLEGANDO AL LIMITE DE STOCK. Quedan ' + stockRestante + ' unidades disponibles.', icon: 'warning', confirmButtonText: 'Entendido' });
    }
  }
  calcularTotal();
}

function calcularTotal() {
  const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  let total = 0;
  for (let i = 0; i < filasFactura.length; i++) {
    let subtotal = parseFloat(filasFactura[i].cells[6].textContent.replace(/\$|\./g, '').replace(',', '.'));
    total += !isNaN(subtotal) ? subtotal : 0;
  }
  const creditoCheckbox    = document.querySelector('input[name="metodosPago"][value="CREDITO"]');
  const interesAmountInput = document.getElementById('interes-amount');
  const totalAmountInput   = document.getElementById('total-amount');
  let interes = 0;
  if (creditoCheckbox && creditoCheckbox.checked) { interes = total * 0.15; total += interes; }
  if (interesAmountInput) interesAmountInput.value = interes.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
  if (totalAmountInput)   totalAmountInput.value   = total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

function agregarProductoATabla(productoId, codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto, cantidadInicial) {
  const cantAgregar  = parseInt(cantidadInicial) || 1;
  const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
  const filas        = tablaFactura.rows;

  // Si ya está en tabla (buscar por ID de BD) → actualizar cantidad
  for (let i = 0; i < filas.length; i++) {
    if (filas[i].dataset.productoId && String(filas[i].dataset.productoId) === String(productoId)) {
      const inputQty = filas[i].cells[4].querySelector('input');
      const stockNum = parseInt(filas[i].cells[5].textContent) || 0;
      if (inputQty) {
        inputQty.value = Math.min(cantAgregar, stockNum);
        updateSubtotal(filas[i]);
        filas[i].classList.add('row-flash');
        setTimeout(() => filas[i].classList.remove('row-flash'), 600);
      }
      return;
    }
  }

  // Buscar fila libre
  let filaDisponible = null;
  for (let i = 0; i < filas.length; i++) {
    if (!filas[i].dataset.productoId) { filaDisponible = filas[i]; break; }
  }
  if (!filaDisponible) { Swal.fire("Límite alcanzado", "Solo se pueden agregar hasta 10 productos.", "warning"); return; }

  // Guardar el ID de BD en el dataset de la fila — esta es la clave única
  filaDisponible.dataset.productoId = String(productoId);

  const imgElement = filaDisponible.cells[0].querySelector("img");
  if (imagenProducto && imgElement) { imgElement.src = imagenProducto; imgElement.style.display = "block"; }

  filaDisponible.cells[1].textContent = codigoProducto;

  const esPrueba = nombreProducto.trim().toUpperCase() === 'PRODUCTO PRUEBA';
  if (esPrueba) {
    filaDisponible.cells[2].innerHTML = `<input type="text" class="facturas-tabla__desc-input" placeholder="Escribir nombre del producto…" value="" autocomplete="off" />`;
    filaDisponible.cells[2].querySelector('input').addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  } else {
    filaDisponible.cells[2].textContent = nombreProducto;
  }

  const inputPrecio = filaDisponible.cells[3].querySelector("input");
  if (inputPrecio) {
    inputPrecio.value    = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    inputPrecio.disabled = false;
    inputPrecio.addEventListener('input', () => updateSubtotal(filaDisponible, false));
  }

  const stockNum      = parseInt(stockActual) || 0;
  const cantaInicial  = Math.max(1, Math.min(cantAgregar, stockNum));

  filaDisponible.cells[4].innerHTML = `
    <div class="qty-control">
      <button type="button" class="qty-btn qty-btn--minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button>
      <input type="number" min="1" max="${stockNum}" value="${cantaInicial}" class="facturas-tabla__input facturas-tabla__input--qty" />
      <button type="button" class="qty-btn qty-btn--plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button>
    </div>`;

  const inputCantidad = filaDisponible.cells[4].querySelector("input");
  const btnMinus      = filaDisponible.cells[4].querySelector(".qty-btn--minus");
  const btnPlus       = filaDisponible.cells[4].querySelector(".qty-btn--plus");

  btnMinus.addEventListener('click', () => {
    const val = parseInt(inputCantidad.value) || 1;
    if (val > 1) { inputCantidad.value = val - 1; updateSubtotal(filaDisponible); }
  });
  btnPlus.addEventListener('click', () => {
    const val = parseInt(inputCantidad.value) || 1;
    if (val < stockNum) { inputCantidad.value = val + 1; updateSubtotal(filaDisponible); }
    else { Swal.fire({ title: 'Stock insuficiente', text: `Solo hay ${stockNum} unidades disponibles.`, icon: 'warning', confirmButtonText: 'Entendido' }); }
  });
  inputCantidad.addEventListener('input', () => updateSubtotal(filaDisponible));

  filaDisponible.cells[5].textContent = stockActual;
  filaDisponible.cells[6].textContent = (parseFloat(precioVenta) * cantaInicial).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
  calcularTotal();

  const botonEliminar = filaDisponible.cells[7].querySelector("button");
  if (botonEliminar) {
    botonEliminar.style.display = "block";
    botonEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    botonEliminar.addEventListener("click", function () {
      delete filaDisponible.dataset.productoId;
      filaDisponible.cells[1].textContent = "";
      filaDisponible.cells[2].innerHTML   = "";
      if (inputPrecio) { inputPrecio.value = ""; inputPrecio.disabled = true; }
      filaDisponible.cells[4].innerHTML   = `<input type="number" min="1" value="0" class="facturas-tabla__input facturas-tabla__input--qty" disabled />`;
      filaDisponible.cells[5].textContent = "";
      filaDisponible.cells[6].textContent = "";
      if (imgElement) imgElement.style.display = "none";
      botonEliminar.style.display = "none";
      calcularTotal();
      renderResultadosMostrador(_productosEnBusqueda);
    });
  }

  filaDisponible.classList.add('row-new');
  setTimeout(() => filaDisponible.classList.remove('row-new'), 500);
}

// ── Helpers buscador ────────────────────────────────────────────────────────
let _productosEnBusqueda = [];

// Usa data-id (ID de BD, siempre único) como clave — nunca data-codigo que puede repetirse
function _obtenerIdsEnTabla() {
  const mapa = {};
  const filas = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  for (let i = 0; i < filas.length; i++) {
    const id = filas[i].dataset.productoId;
    if (id) {
      const qty = parseInt(filas[i].cells[4].querySelector('input')?.value) || 1;
      mapa[id] = { cantidad: qty, filaIndex: i };
    }
  }
  return mapa;
}

function _actualizarContadoresEnResultados() {
  const enTabla = _obtenerIdsEnTabla();
  document.querySelectorAll('.resultado-busqueda[data-id]').forEach(el => {
    const id         = el.dataset.id;
    const info       = enTabla[id] || null;
    const badge      = el.querySelector('.srb-badge');
    const qtyInput   = el.querySelector('.srb-qty-input');
    const btnAgregar = el.querySelector('.srb-agregar');
    const btnQuitar  = el.querySelector('.srb-delete');

    if (info) {
      el.classList.add('en-tabla');
      if (badge)      { badge.textContent = info.cantidad; badge.style.display = 'inline-flex'; }
      if (qtyInput)   qtyInput.value = info.cantidad;
      if (btnAgregar) btnAgregar.style.display = 'none';
      if (btnQuitar)  btnQuitar.style.display  = 'flex';
    } else {
      el.classList.remove('en-tabla');
      if (badge)      { badge.textContent = ''; badge.style.display = 'none'; }
      if (qtyInput)   qtyInput.value = '1';
      if (btnAgregar) btnAgregar.style.display = 'flex';
      if (btnQuitar)  btnQuitar.style.display  = 'none';
    }
  });
}

// ── DOMContentLoaded ────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {

  const fechaPresupuestoInput = document.getElementById('fecha-presupuesto');
  if (fechaPresupuestoInput && !fechaPresupuestoInput.value) {
    fechaPresupuestoInput.value = fechaHoyYYYYMMDD();
  }

  document.getElementById('invoice-form').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); return false; }
  });

  // ── Submit ──────────────────────────────────────────────────────────────────
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
      const codigo    = filasFactura[i].cells[1].textContent.trim();
      const descInput = filasFactura[i].cells[2].querySelector('input.facturas-tabla__desc-input');
      const descripcion = descInput ? (descInput.value.trim() || 'PRODUCTO PRUEBA') : filasFactura[i].cells[2].textContent.trim();
      const precioInput = filasFactura[i].cells[3].querySelector('input').value;
      let precio_unitario = parseFloat(precioInput.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim());
      let cantidad  = parseInt(filasFactura[i].cells[4].querySelector('input').value);
      const stock   = parseInt(filasFactura[i].cells[5].textContent.trim());

      precio_unitario = !isNaN(precio_unitario) ? precio_unitario : 0;
      cantidad        = !isNaN(cantidad)         ? cantidad        : 1;

      if (cantidad > stock) {
        Swal.fire({ title: 'Stock insuficiente', text: `No hay stock suficiente en fila ${i + 1}. Tiene ${stock}, quiere facturar ${cantidad}.`, icon: 'error', confirmButtonText: 'Entendido' });
        return;
      }

      const subtotal = precio_unitario * cantidad;
      if (codigo !== '' && descripcion !== '' && precio_unitario > 0 && cantidad > 0) {
        invoiceItems.push({
          // IMPORTANTE: producto_id debe ser el ID real de BD, no el código visible.
          // El código se envía aparte para mostrarlo/imprimirlo si el backend lo usa.
          producto_id: filasFactura[i].dataset.productoId || codigo,
          codigo,
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
      Swal.fire({ title: 'Error', text: 'Debe agregar al menos un producto válido.', icon: 'error', confirmButtonText: 'Entendido' });
      return;
    }

    const fechaFactura  = fechaPresupuestoInput ? fechaPresupuestoInput.value.trim() : undefined;
    const nombreCliente = document.getElementById('nombre-cliente')?.value.trim() || '';

    const esCredito     = metodosPagoSeleccionados.value === 'CREDITO';
    const factorInteres = esCredito ? 1.15 : 1;
    let   interesCalculado = 0;

    const invoiceItemsConInteres = invoiceItems.map(item => ({
      ...item,
      precio_unitario: item.precio_unitario * factorInteres,
      subtotal:        item.subtotal        * factorInteres
    }));

    if (esCredito) interesCalculado = totalSinInteres * 0.15;
    const totalConInteres = totalSinInteres + interesCalculado;

    const filasHTML = invoiceItemsConInteres.map((item, idx) => `
      <tr>
        <td style="padding:4px 6px;text-align:center;">${idx + 1}</td>
        <td style="padding:4px 6px;">${item.producto_id}</td>
        <td style="padding:4px 6px;">${item.descripcion}</td>
        <td style="padding:4px 6px;text-align:right;">${formatCurrencyCL(item.precio_unitario)}</td>
        <td style="padding:4px 6px;text-align:center;">${item.cantidad}</td>
        <td style="padding:4px 6px;text-align:right;font-weight:500;">${formatCurrencyCL(item.subtotal)}</td>
      </tr>`).join('');

    const bloqueInteres = esCredito ? `
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.9rem;"><span>Subtotal (sin recargo)</span><span>${formatCurrencyCL(totalSinInteres)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.9rem;color:#c07000;"><span>⚡ Recargo tarjeta crédito (15%)</span><span>+ ${formatCurrencyCL(interesCalculado)}</span></div>` : '';

    const resumenHTML = `
      <div class="resumen-factura-modal">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px;font-size:0.9rem;">
          <span><strong>Vendedor:</strong> ${nombreCliente || '-'}</span>
          <span><strong>Fecha:</strong> ${fechaFactura || fechaHoyYYYYMMDD()}</span>
          <span><strong>Pago:</strong> ${metodosPagoSeleccionados.value}${esCredito ? ' &nbsp;💳 +15%' : ''}</span>
        </div>
        <div style="max-height:260px;overflow:auto;border:1px solid #ddd;border-radius:6px;">
          <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
            <thead><tr style="background:#f5f5f5;position:sticky;top:0;">
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:center;">#</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;">Código</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;">Descripción</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:right;">P. Unitario${esCredito ? '*' : ''}</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:center;">Cant.</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:right;">Subtotal${esCredito ? '*' : ''}</th>
            </tr></thead>
            <tbody>${filasHTML}</tbody>
          </table>
        </div>
        ${esCredito ? `<p style="font-size:0.78rem;color:#888;margin:4px 0 8px;">* Precios incluyen recargo 15%.</p>` : ''}
        <div style="border-top:1px solid #ddd;margin-top:8px;padding-top:8px;">
          ${bloqueInteres}
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:1.05rem;font-weight:700;border-top:1px solid #ddd;margin-top:4px;"><span>Total a cobrar</span><span>${formatCurrencyCL(totalConInteres)}</span></div>
        </div>
        <p style="margin-top:8px;font-size:0.82rem;color:#888;">Revisá los datos antes de guardar.</p>
      </div>`;

    const { isConfirmed } = await Swal.fire({
      title: 'Confirmar datos de la factura', html: resumenHTML, icon: 'question',
      showCancelButton: true, confirmButtonText: 'Sí, guardar', cancelButtonText: 'Revisar',
      reverseButtons: true, width: '80%', allowOutsideClick: false, allowEscapeKey: false
    });
    if (!isConfirmed) return;

    try {
      const response = await fetch('/productos/procesarFormularioFacturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombreCliente, fechaPresupuesto: fechaFactura, totalPresupuesto: totalConInteres.toFixed(2), invoiceItems: invoiceItemsConInteres, metodosPago: metodosPagoSeleccionados.value })
      });
      const rawText = await response.text();
      let data;
      try { data = JSON.parse(rawText); } catch (_) {
        Swal.fire({ title: 'Error del servidor', html: `<pre style="text-align:left;font-size:11px;max-height:200px;overflow:auto">${rawText.substring(0, 600)}</pre>`, icon: 'error', confirmButtonText: 'Entendido' });
        return;
      }
      if (response.ok) { await mostrarModalARCA(data.facturaId, totalConInteres); }
      else { throw new Error(data.error || 'Error al procesar el formulario'); }
    } catch (error) {
      Swal.fire({ title: 'Error', text: 'Error al enviar formulario: ' + error.message, icon: 'error', confirmButtonText: 'Entendido' });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BUSCADOR — controles SIEMPRE visibles, botón Agregar confirma la acción
  // ══════════════════════════════════════════════════════════════════════════

  const entradaBusqueda    = document.getElementById('entradaBusqueda');
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  let timeoutId;
  let _searchTimer      = null;
  let _searchController = null;
  let _keepOpen         = false;

  /**
   * Layout de cada resultado:
   *
   *  [img]  [nombre]                 [−] [input] [+]  [🛒 Agregar]
   *                                                   (o [🗑 Quitar] si ya está en tabla)
   *
   * [-] y [+] modifican el input de cantidad.
   * Si el producto YA está en tabla, [-][+] también actualizan la tabla en tiempo real.
   * [Agregar] → confirma y agrega con la cantidad del input.
   * [Quitar]  → elimina de la tabla.
   */
  function crearElementoResultado(producto, enTabla) {
    const id        = String(producto.id);
    const cod       = String(producto.codigo ?? '').trim();
    const stockMax  = parseInt(producto.stock_actual) || 0;
    const info      = enTabla[id] || null;

    const resultado = document.createElement('div');
    resultado.classList.add('resultado-busqueda');
    if (info) resultado.classList.add('en-tabla');
    resultado.dataset.id           = id;
    resultado.dataset.codigo       = cod;
    resultado.dataset.nombre       = producto.nombre;
    resultado.dataset.precio_venta = producto.precio_venta;
    resultado.dataset.stock_actual = producto.stock_actual;
    if (producto.imagenes && producto.imagenes.length > 0) {
      resultado.dataset.imagen = '/uploads/productos/' + producto.imagenes[0].imagen;
    }

    // ── Imagen ───────────────────────────────────────────────────────────────
    const imgWrap = document.createElement('div');
    imgWrap.classList.add('srb-img-wrap');
    if (producto.imagenes && producto.imagenes.length > 0) {
      const img = document.createElement('img');
      img.src      = '/uploads/productos/' + producto.imagenes[0].imagen;
      img.loading  = 'lazy';
      img.decoding = 'async';
      img.classList.add('srb-img');
      imgWrap.appendChild(img);
    } else {
      imgWrap.innerHTML = '<span class="srb-img-placeholder"><i class="fa-solid fa-image"></i></span>';
    }
    resultado.appendChild(imgWrap);

    // ── Nombre + precio ──────────────────────────────────────────────────────
    const infoDiv = document.createElement('div');
    infoDiv.classList.add('srb-info');

    const nombreSpan = document.createElement('span');
    nombreSpan.classList.add('srb-nombre');
    nombreSpan.textContent = producto.nombre;
    infoDiv.appendChild(nombreSpan);

    const precioSpan = document.createElement('span');
    precioSpan.classList.add('srb-precio');
    precioSpan.textContent = parseFloat(producto.precio_venta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    infoDiv.appendChild(precioSpan);

    resultado.appendChild(infoDiv);

    // Badge "en tabla"
    const badge = document.createElement('span');
    badge.classList.add('srb-badge');
    badge.textContent  = info ? info.cantidad : '';
    badge.style.display = info ? 'inline-flex' : 'none';
    resultado.appendChild(badge);

    // ── Controles qty + acción ───────────────────────────────────────────────
    const controles = document.createElement('div');
    controles.classList.add('srb-controles');

    const btnMinus = document.createElement('button');
    btnMinus.type      = 'button';
    btnMinus.classList.add('srb-qty-minus', 'srb-btn');
    btnMinus.innerHTML = '<i class="fa-solid fa-minus"></i>';

    const qtyInput = document.createElement('input');
    qtyInput.type        = 'number';
    qtyInput.min         = '0';           // min=0 evita el error "value < min"
    qtyInput.max         = String(stockMax || 999);
    qtyInput.value       = info ? String(info.cantidad) : '1';
    qtyInput.tabIndex    = -1;            // no participa en Tab navigation
    qtyInput.setAttribute('form', '');    // desvincula del form padre → no se valida en submit
    qtyInput.classList.add('srb-qty-input');

    const btnPlus = document.createElement('button');
    btnPlus.type      = 'button';
    btnPlus.classList.add('srb-qty-plus', 'srb-btn');
    btnPlus.innerHTML = '<i class="fa-solid fa-plus"></i>';

    // Botón Agregar (siempre presente, oculto cuando ya está en tabla)
    const btnAgregar = document.createElement('button');
    btnAgregar.type      = 'button';
    btnAgregar.classList.add('srb-agregar', 'srb-btn');
    btnAgregar.innerHTML = '<i class="fa-solid fa-cart-plus"></i><span>Agregar</span>';
    btnAgregar.style.display = info ? 'none' : 'flex';

    // Botón Quitar (visible solo si ya está en tabla)
    const btnQuitar = document.createElement('button');
    btnQuitar.type      = 'button';
    btnQuitar.classList.add('srb-delete', 'srb-btn');
    btnQuitar.innerHTML = '<i class="fa-solid fa-trash"></i><span>Quitar</span>';
    btnQuitar.style.display = info ? 'flex' : 'none';

    controles.appendChild(btnMinus);
    controles.appendChild(qtyInput);
    controles.appendChild(btnPlus);
    controles.appendChild(btnAgregar);
    controles.appendChild(btnQuitar);
    resultado.appendChild(controles);

    // ── EVENTOS ──────────────────────────────────────────────────────────────

    // Variables del closure — deben declararse ANTES de los listeners que las usan
    const _id     = id;
    const _cod    = cod;
    const _nombre = producto.nombre;
    const _precio = producto.precio_venta;
    const _stock  = producto.stock_actual;
    const _imagen = resultado.dataset.imagen || '';

    // ── Bloquear propagación en TODOS los eventos de controles ──────────────
    // mousedown: preventDefault evita que el buscador pierda el foco
    //            stopImmediatePropagation evita que suba al .resultado-busqueda
    // mousedown: preventDefault evita que el buscador pierda el foco al hacer click en los controles
    [btnMinus, btnPlus, btnAgregar, btnQuitar, qtyInput].forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        _keepOpen = true;
      });
    });

    // Input qty manual
    qtyInput.addEventListener('input', e => {
      e.stopImmediatePropagation();
      let v = parseInt(qtyInput.value) || 1;
      v = Math.max(1, Math.min(v, stockMax));
      qtyInput.value = v;
      if (resultado.classList.contains('en-tabla')) {
        _setQtyEnTabla(_id, v);
        renderResultadosMostrador(_productosEnBusqueda);
      }
    });
    qtyInput.addEventListener('keydown', e => { e.stopImmediatePropagation(); if (e.key === 'Enter') e.preventDefault(); });

    // Botón −
    btnMinus.addEventListener('click', e => {
      e.stopImmediatePropagation();
      const v = parseInt(qtyInput.value) || 1;
      if (resultado.classList.contains('en-tabla')) {
        if (v <= 1) {
          _quitarDeTabla(_id);
        } else {
          qtyInput.value = v - 1;
          _setQtyEnTabla(_id, v - 1);
        }
        renderResultadosMostrador(_productosEnBusqueda);
      } else {
        if (v > 1) qtyInput.value = v - 1;
      }
      entradaBusqueda.focus();
      _keepOpen = false;
    });

    // Botón +
    btnPlus.addEventListener('click', e => {
      e.stopImmediatePropagation();
      const v = parseInt(qtyInput.value) || 1;
      if (v >= stockMax) {
        Swal.fire({ title: 'Stock máximo', text: `Solo hay ${stockMax} unidades disponibles.`, icon: 'warning', confirmButtonText: 'Entendido' });
      } else {
        qtyInput.value = v + 1;
        if (resultado.classList.contains('en-tabla')) {
          _setQtyEnTabla(_id, v + 1);
          renderResultadosMostrador(_productosEnBusqueda);
        }
      }
      entradaBusqueda.focus();
      _keepOpen = false;
    });

    btnAgregar.addEventListener('click', e => {
      e.stopImmediatePropagation();
      const qty = parseInt(qtyInput.value) || 1;
      agregarProductoATabla(_id, _cod, _nombre, _precio, _stock, _imagen, qty);
      renderResultadosMostrador(_productosEnBusqueda);
      entradaBusqueda.focus();
      _keepOpen = false;
    });

    // Botón Quitar
    btnQuitar.addEventListener('click', e => {
      e.stopImmediatePropagation();
      _quitarDeTabla(_id);
      renderResultadosMostrador(_productosEnBusqueda);
      entradaBusqueda.focus();
      _keepOpen = false;
    });

    // Hover
    resultado.addEventListener('mouseenter', function () {
      document.querySelectorAll('.resultado-busqueda').forEach(r => r.classList.remove('hover-activo'));
      this.classList.add('hover-activo');
    });
    resultado.addEventListener('mouseleave', function () { this.classList.remove('hover-activo'); });

    return resultado;
  }

  function _setQtyEnTabla(id, qty) {
    const filas = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    for (let i = 0; i < filas.length; i++) {
      if (String(filas[i].dataset.productoId) === String(id)) {
        const inputQty = filas[i].cells[4].querySelector('input');
        if (inputQty) { inputQty.value = qty; updateSubtotal(filas[i]); }
        break;
      }
    }
  }

  function _quitarDeTabla(id) {
    const filas = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    for (let i = 0; i < filas.length; i++) {
      if (String(filas[i].dataset.productoId) === String(id)) {
        const boton = filas[i].cells[7].querySelector('button');
        if (boton) boton.click();
        break;
      }
    }
  }

  function renderResultadosMostrador(productos) {
    _productosEnBusqueda = productos;
    resultadosBusqueda.innerHTML = '';
    if (!productos.length) { resultadosBusqueda.style.display = 'none'; return; }
    const enTabla = _obtenerIdsEnTabla();
    productos.forEach(p => resultadosBusqueda.appendChild(crearElementoResultado(p, enTabla)));
    resultadosBusqueda.style.display = 'block';
  }

  entradaBusqueda.addEventListener('input', e => {
    const busqueda = e.target.value.trim();
    resultadosBusqueda.innerHTML = '';
    resultadosBusqueda.style.display = 'none';
    if (_searchController) { _searchController.abort(); _searchController = null; }
    clearTimeout(_searchTimer);
    if (!busqueda) { _productosEnBusqueda = []; return; }
    const q = busqueda;
    _searchTimer = setTimeout(async () => {
      _searchController = new AbortController();
      try {
        const resp      = await fetch('/productos/api/buscar?q=' + encodeURIComponent(busqueda), { signal: _searchController.signal });
        const productos = await resp.json();
        if (entradaBusqueda.value.trim() !== q) return;
        renderResultadosMostrador(productos);
      } catch (err) {
        if (err.name !== 'AbortError') console.error('[BuscadorFacturas]', err);
      }
    }, 300);
  });

  entradaBusqueda.addEventListener('blur', () => {
    if (_keepOpen) return;
    timeoutId = setTimeout(() => { resultadosBusqueda.style.display = 'none'; }, 200);
  });
  entradaBusqueda.addEventListener('focus', () => {
    clearTimeout(timeoutId);
    if (_productosEnBusqueda.length > 0 && entradaBusqueda.value.trim()) renderResultadosMostrador(_productosEnBusqueda);
  });
  resultadosBusqueda.addEventListener('mouseleave', () => {
    if (_keepOpen) return;
    timeoutId = setTimeout(() => { resultadosBusqueda.style.display = 'none'; }, 300);
  });
  resultadosBusqueda.addEventListener('mouseenter', () => { clearTimeout(timeoutId); resultadosBusqueda.style.display = 'block'; });

  // Navegación teclado
  entradaBusqueda.addEventListener('keydown', e => {
    const items  = resultadosBusqueda.querySelectorAll('.resultado-busqueda');
    if (!items.length) return;
    const activo = resultadosBusqueda.querySelector('.hover-activo');
    const idx    = [...items].indexOf(activo);
    if (e.key === 'ArrowDown')       { e.preventDefault(); const n = items[Math.min(idx+1, items.length-1)]; items.forEach(r => r.classList.remove('hover-activo')); n.classList.add('hover-activo'); n.scrollIntoView({ block:'nearest' }); }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); const n = items[Math.max(idx-1, 0)];              items.forEach(r => r.classList.remove('hover-activo')); n.classList.add('hover-activo'); n.scrollIntoView({ block:'nearest' }); }
    else if (e.key === 'Enter' && activo) { e.preventDefault(); activo.querySelector('.srb-agregar')?.click(); }
    else if (e.key === 'Escape')     { resultadosBusqueda.style.display = 'none'; }
  });

  // Eventos tabla existente
  document.querySelectorAll('#tabla-factura tbody tr').forEach(row => {
    const ic = row.cells[4].querySelector('input');
    const ip = row.cells[3].querySelector('input');
    if (ic) ic.addEventListener('input', () => updateSubtotal(row));
    if (ip) ip.addEventListener('input', () => updateSubtotal(row, false));
  });

  document.querySelectorAll('input[name="metodosPago"]').forEach(cb => cb.addEventListener('change', calcularTotal));

  document.querySelectorAll('input:not(#entradaBusqueda):not(#headerEntradaBusqueda)').forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); return false; } });
  });

}); // END DOMContentLoaded


/* ═══════════════════════════════════════════════════════════
   ARCA — sin cambios respecto a versión anterior
═══════════════════════════════════════════════════════════ */

async function mostrarModalARCA(facturaId, totalConInteres) {
  const swalBase = {
    background: '#111c30',
    color: '#f0f4ff',
    width: '520px',
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: { confirmButton: 'af-apps-confirm' }
  };

  // Limpieza por si quedó estado viejo de un modal anterior.
  window.__arcaModalOption = null;

  await Swal.fire({
    ...swalBase,
    title: `<span style="font-size:1rem;letter-spacing:.08em;text-transform:uppercase;color:#7aaee8">Factura #${facturaId} guardada</span>`,
    html: `
      <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0;text-align:left">
        <button id="arca-btn-cf" type="button" style="display:flex;align-items:center;gap:14px;padding:16px 20px;border-radius:14px;background:rgba(31,72,126,.22);border:1.5px solid rgba(122,174,232,.45);color:#f0f4ff;font-size:1rem;font-weight:700;cursor:pointer;text-align:left;width:100%;box-sizing:border-box">
          <i class="fa-solid fa-receipt" style="font-size:1.4rem;color:#7aaee8;flex-shrink:0"></i>
          <div>
            <div style="font-size:.95rem;font-weight:800">Factura B — Consumidor Final</div>
            <div style="font-size:.78rem;color:#9fb3ce;margin-top:3px">Sin CUIT · emisión rápida</div>
          </div>
        </button>

        <button id="arca-btn-cuit" type="button" style="display:flex;align-items:center;gap:14px;padding:16px 20px;border-radius:14px;background:rgba(99,102,241,.16);border:1.5px solid rgba(165,180,252,.45);color:#f0f4ff;font-size:1rem;font-weight:700;cursor:pointer;text-align:left;width:100%;box-sizing:border-box">
          <i class="fa-solid fa-building" style="font-size:1.4rem;color:#a5b4fc;flex-shrink:0"></i>
          <div>
            <div style="font-size:.95rem;font-weight:800">Factura B/A — Con CUIT</div>
            <div style="font-size:.78rem;color:#9fb3ce;margin-top:3px">Buscar razón social, condición IVA y emitir</div>
          </div>
        </button>

        <button id="arca-btn-saltar" type="button" style="display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,.10);color:#9fb3ce;font-size:.85rem;cursor:pointer;text-align:left;width:100%;box-sizing:border-box">
          <i class="fa-solid fa-forward" style="flex-shrink:0"></i> Solo guardar, emitir ARCA más tarde
        </button>
      </div>`,
    showConfirmButton: false,
    showCancelButton: false,
    didOpen: () => {
      const setOption = (op) => { window.__arcaModalOption = op; Swal.close(); };
      document.getElementById('arca-btn-cf')?.addEventListener('click', () => setOption('cf'));
      document.getElementById('arca-btn-cuit')?.addEventListener('click', () => setOption('cuit'));
      document.getElementById('arca-btn-saltar')?.addEventListener('click', () => setOption('saltar'));
    }
  });

  const opcion = window.__arcaModalOption || 'saltar';
  window.__arcaModalOption = null;

  if (opcion === 'saltar') {
    window.location.href = '/productos';
    return;
  }

  if (opcion === 'cf') {
    await _emitirARCA(facturaId, {
      cbte_tipo: 6,
      doc_tipo: 99,
      doc_nro: 0,
      receptor_nombre: 'CONSUMIDOR FINAL',
      receptor_cond_iva_id: 5
    });
    return;
  }

  const paso2 = await Swal.fire({
    ...swalBase,
    title: '<span style="font-size:1rem;color:#a5b4fc">Datos del receptor</span>',
    html: `
      <div style="display:flex;flex-direction:column;gap:14px;text-align:left;padding:4px 0">
        <div>
          <label style="font-size:.8rem;color:#9fb3ce;font-weight:700;letter-spacing:.04em">TIPO DE FACTURA</label>
          <div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;color:#f0f4ff;font-size:.9rem"><input type="radio" name="af-cbte" value="6" checked> Factura B</label>
            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;color:#f0f4ff;font-size:.9rem"><input type="radio" name="af-cbte" value="1"> Factura A</label>
          </div>
        </div>

        <div>
          <label style="font-size:.8rem;color:#9fb3ce;font-weight:700;letter-spacing:.04em">CUIT *</label>
          <div style="display:flex;gap:8px;margin-top:6px">
            <input id="af-cuit" type="text" maxlength="13" placeholder="Ej: 30718763718" autocomplete="off"
              style="flex:1;padding:10px 12px;background:#1a2a40;border:1px solid rgba(255,255,255,.14);border-radius:8px;color:#f0f4ff;font-size:.95rem;box-sizing:border-box">
            <button id="af-buscar-cuit" type="button" style="padding:0 13px;border-radius:8px;border:1px solid rgba(122,174,232,.45);background:rgba(31,72,126,.22);color:#c0d8f8;font-weight:800;cursor:pointer">
              Buscar
            </button>
          </div>
          <div id="af-buscar-status" style="display:none;margin-top:6px;font-size:.78rem;color:#9fb3ce"></div>
        </div>

        <div>
          <label style="font-size:.8rem;color:#9fb3ce;font-weight:700;letter-spacing:.04em">RAZÓN SOCIAL *</label>
          <input id="af-nombre" type="text" placeholder="Se completa al buscar o podés escribirla"
            style="width:100%;margin-top:6px;padding:10px 12px;background:#1a2a40;border:1px solid rgba(255,255,255,.14);border-radius:8px;color:#f0f4ff;font-size:.9rem;box-sizing:border-box">
        </div>

        <div>
          <label style="font-size:.8rem;color:#9fb3ce;font-weight:700;letter-spacing:.04em">CONDICIÓN IVA RECEPTOR *</label>
          <select id="af-cond" style="width:100%;margin-top:6px;padding:10px 12px;background:#1a2a40;border:1px solid rgba(255,255,255,.14);border-radius:8px;color:#f0f4ff;font-size:.9rem;box-sizing:border-box">
            <option value="5" selected>Consumidor Final (5)</option>
            <option value="4">IVA Sujeto Exento (4)</option>
            <option value="6">Responsable Monotributo (6)</option>
            <option value="1">IVA Responsable Inscripto (1)</option>
            <option value="13">Monotributista Social (13)</option>
            <option value="15">IVA No Alcanzado (15)</option>
            <option value="16">Monotributo Trabajador Independiente Promovido (16)</option>
          </select>
        </div>

        <div>
          <label style="font-size:.8rem;color:#9fb3ce;font-weight:700;letter-spacing:.04em">DOMICILIO</label>
          <input id="af-dom" type="text" placeholder="Opcional"
            style="width:100%;margin-top:6px;padding:10px 12px;background:#1a2a40;border:1px solid rgba(255,255,255,.14);border-radius:8px;color:#f0f4ff;font-size:.9rem;box-sizing:border-box">
        </div>

        <div id="af-err" style="display:none;color:#f87171;font-size:.82rem;padding:8px 12px;background:rgba(248,113,113,.08);border-radius:8px;border:1px solid rgba(248,113,113,.25)"></div>
      </div>`,
    confirmButtonText: 'Emitir comprobante',
    cancelButtonText: '← Volver',
    showCancelButton: true,
    reverseButtons: true,
    didOpen: () => {
      const cuitInput = document.getElementById('af-cuit');
      const nombreInput = document.getElementById('af-nombre');
      const domInput = document.getElementById('af-dom');
      const condSelect = document.getElementById('af-cond');
      const statusEl = document.getElementById('af-buscar-status');
      const errEl = document.getElementById('af-err');

      const setStatus = (msg, color = '#9fb3ce') => {
        statusEl.style.display = 'block';
        statusEl.style.color = color;
        statusEl.textContent = msg;
      };

      const setError = (msg) => {
        errEl.textContent = msg;
        errEl.style.display = 'block';
      };

      const limpiarError = () => {
        errEl.textContent = '';
        errEl.style.display = 'none';
      };

      const syncTipoYCond = () => {
        const cbte = Number(document.querySelector('input[name="af-cbte"]:checked')?.value || 6);
        if (cbte === 1) condSelect.value = '1';
        if (cbte === 6 && condSelect.value === '1') condSelect.value = '5';
      };

      document.querySelectorAll('input[name="af-cbte"]').forEach(r => r.addEventListener('change', syncTipoYCond));
      condSelect.addEventListener('change', () => {
        const cbte = Number(document.querySelector('input[name="af-cbte"]:checked')?.value || 6);
        if (cbte === 1 && condSelect.value !== '1') setError('Factura A requiere Responsable Inscripto (1).');
        else if (cbte === 6 && condSelect.value === '1') setError('Factura B no acepta Responsable Inscripto. Usá Factura A.');
        else limpiarError();
      });

      cuitInput.addEventListener('input', () => {
        cuitInput.value = cuitInput.value.replace(/\D/g, '').slice(0, 11);
      });

      document.getElementById('af-buscar-cuit')?.addEventListener('click', async () => {
        limpiarError();
        const cuit = (cuitInput.value || '').replace(/\D/g, '');
        if (cuit.length !== 11) {
          setError('Ingresá un CUIT válido de 11 dígitos.');
          return;
        }

        setStatus('Buscando datos del receptor…');
        try {
          const resp = await fetch(`/arca/receptor?doc_tipo=80&doc_nro=${encodeURIComponent(cuit)}&resolve=1`);
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(data.error || 'No se pudo consultar el padrón/cache.');

          const razon = data.razon_social || data.nombre || '';
          if (razon) nombreInput.value = razon;
          if (data.domicilio) domInput.value = data.domicilio;
          if (data.cond_iva_id && Number(data.cond_iva_id) > 0) condSelect.value = String(data.cond_iva_id);

          syncTipoYCond();
          setStatus(razon ? `Datos encontrados: ${razon}` : 'CUIT encontrado. Completá razón social si falta.', '#4ade80');
        } catch (err) {
          setStatus('No se pudo autocompletar. Podés cargar razón social manualmente.', '#fbbf24');
        }
      });
    },
    preConfirm: () => {
      const errEl = document.getElementById('af-err');
      errEl.style.display = 'none';

      const cbte_tipo = Number(document.querySelector('input[name="af-cbte"]:checked')?.value || 6);
      const receptor_cond_iva_id = Number(document.getElementById('af-cond')?.value || 0);
      const doc_nro = (document.getElementById('af-cuit')?.value || '').replace(/\D/g, '');
      const receptor_nombre = (document.getElementById('af-nombre')?.value || '').trim();
      const receptor_domicilio = (document.getElementById('af-dom')?.value || '').trim();

      const fail = (msg) => {
        errEl.textContent = msg;
        errEl.style.display = 'block';
        return false;
      };

      if (doc_nro.length !== 11) return fail('Ingresá un CUIT válido de 11 dígitos.');
      if (!receptor_nombre) return fail('Ingresá o buscá la razón social del receptor.');
      if (!receptor_cond_iva_id) return fail('Seleccioná la condición IVA del receptor.');
      if (cbte_tipo === 1 && receptor_cond_iva_id !== 1) return fail('Factura A requiere condición IVA: Responsable Inscripto (1).');
      if (cbte_tipo === 6 && receptor_cond_iva_id === 1) return fail('Factura B no acepta Responsable Inscripto. Usá Factura A.');

      return {
        cbte_tipo,
        doc_tipo: 80,
        doc_nro,
        receptor_nombre,
        receptor_cond_iva_id,
        receptor_domicilio
      };
    }
  });

  if (!paso2.isConfirmed) {
    window.location.href = '/productos';
    return;
  }

  await _emitirARCA(facturaId, paso2.value, false);
}

async function _emitirARCA(facturaId, payload, resolveReceptor = false) {
  Swal.fire({
    title: 'Emitiendo comprobante ARCA…',
    html: '<p style="color:#9fb3ce;font-size:.9rem">Conectando con WSFE · no cerrar esta ventana</p>',
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
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json().catch(() => ({ error: 'Respuesta inválida del servidor ARCA' }));

    if (resp.ok && data.estado === 'EMITIDO') {
      const tipoLabel = (Number(data.cbte_tipo) === 1 || Number(data.cbte_tipo) === 51) ? 'Factura A' : 'Factura B';
      await Swal.fire({
        icon: 'success',
        title: '<span style="color:#4ade80">Comprobante emitido</span>',
        html: `<div style="text-align:left;display:flex;flex-direction:column;gap:8px;margin-top:8px">
          <div style="display:flex;justify-content:space-between;padding:10px 14px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.22);border-radius:10px"><span style="color:#9fb3ce;font-size:.82rem;font-weight:700">CAE</span><strong style="color:#f0f4ff;font-family:monospace;font-size:.9rem">${data.cae || '-'}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:10px 14px;background:rgba(31,72,126,.14);border-radius:10px"><span style="color:#9fb3ce;font-size:.82rem;font-weight:700">Comprobante N°</span><strong style="color:#f0f4ff">${String(data.cbte_nro || '-').padStart(8, '0')}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:10px 14px;background:rgba(31,72,126,.14);border-radius:10px"><span style="color:#9fb3ce;font-size:.82rem;font-weight:700">Tipo</span><strong style="color:#f0f4ff">${tipoLabel}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:10px 14px;background:rgba(31,72,126,.14);border-radius:10px"><span style="color:#9fb3ce;font-size:.82rem;font-weight:700">Vto. CAE</span><strong style="color:#f0f4ff">${_formatFecha8(data.cae_vto)}</strong></div>
          <a href="/arca/pdf/${data.arca_id}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:6px;padding:13px 20px;border-radius:12px;background:rgba(31,72,126,.25);border:1.5px solid rgba(31,72,126,.5);color:#c0d8f8;font-size:.9rem;font-weight:800;text-decoration:none"><i class="fa-solid fa-print"></i>Imprimir / Ver PDF</a>
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
        title: '<span style="color:#fbbf24">Pendiente de confirmación</span>',
        html: `<p style="color:#9fb3ce;font-size:.88rem;margin-bottom:12px">WSFE no confirmó. La factura interna quedó guardada.</p><div style="padding:10px 14px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.22);border-radius:10px;font-size:.82rem;color:#fbbf24">${data.obs_msg || data.error || 'Sin detalle'}</div>`,
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
        html: `<p style="color:#9fb3ce;font-size:.88rem">Estado: <strong style="color:#f0f4ff">${data.estado || '-'}</strong>${data.cae ? `<br>CAE: <code style="color:#7aaee8">${data.cae}</code>` : ''}</p>`,
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
      html: `<p style="color:#9fb3ce;font-size:.85rem;margin-bottom:10px">La factura interna quedó guardada.</p><pre style="text-align:left;font-size:.75rem;max-height:180px;overflow:auto;background:rgba(217,4,41,.06);border:1px solid rgba(217,4,41,.24);color:#fca5a5;padding:10px;border-radius:8px;white-space:pre-wrap">${String(detalle).substring(0, 900)}</pre>`,
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
      html: `<p style="color:#9fb3ce;font-size:.85rem">No se pudo conectar. La factura interna quedó guardada.</p><code style="font-size:.78rem;color:#f87171">${err.message || String(err)}</code>`,
      background: '#111c30',
      color: '#f0f4ff',
      confirmButtonText: 'Ir a productos',
      customClass: { confirmButton: 'af-apps-confirm' },
      allowOutsideClick: false
    });
    window.location.href = '/productos';
  }
}

function _formatFecha8(f) {
  if (!f || String(f).length !== 8) return f || '-';
  return `${String(f).slice(6, 8)}/${String(f).slice(4, 6)}/${String(f).slice(0, 4)}`;
}
