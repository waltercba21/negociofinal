// buscadorPresupuesto.js — v2026-04-29-v2

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

  let precio      = parseFloat(inputPrecio.value.replace(/\$|\./g, '').replace(',', '.'));
  let cantidad    = parseInt(inputCantidad.value);
  let stockActual = parseInt(stockActualCell.textContent.replace(/\$|\./g, '').replace(',', '.'));

  precio      = !isNaN(precio)      ? precio      : 0;
  cantidad    = !isNaN(cantidad)    ? cantidad    : 1;
  stockActual = !isNaN(stockActual) ? stockActual : 0;

  row.cells[6].textContent = formatCurrencyCL(precio * cantidad);

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
  const filas = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  let total = 0;
  for (let i = 0; i < filas.length; i++) {
    let subtotal = parseFloat(filas[i].cells[6].textContent.replace(/\$|\./g, '').replace(',', '.'));
    total += !isNaN(subtotal) ? subtotal : 0;
  }
  const totalAmountInput = document.getElementById('total-amount');
  if (totalAmountInput) totalAmountInput.value = formatCurrencyCL(total);
}

function agregarProductoATabla(productoId, codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto, cantidadInicial) {
  const cantAgregar = parseInt(cantidadInicial) || 1;
  const tbody = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
  const filas = tbody.rows;

  // Si ya está en tabla (por ID de BD) → actualizar cantidad
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

  let filaDisponible = null;
  for (let i = 0; i < filas.length; i++) {
    if (!filas[i].dataset.productoId) { filaDisponible = filas[i]; break; }
  }
  if (!filaDisponible) { Swal.fire("Límite alcanzado", "Solo se pueden agregar hasta 10 productos.", "warning"); return; }

  const stockNum     = parseInt(stockActual) || 0;
  const cantaInicial = Math.max(1, Math.min(cantAgregar, stockNum));

  // Guardar ID de BD como clave única en la fila
  filaDisponible.dataset.productoId = String(productoId);

  const imgElement = filaDisponible.cells[0].querySelector("img");
  if (imagenProducto && imgElement) { imgElement.src = imagenProducto; imgElement.style.display = "block"; }

  filaDisponible.cells[1].textContent = codigoProducto;

  const esPrueba = nombreProducto.trim().toUpperCase() === 'PRODUCTO PRUEBA';
  if (esPrueba) {
    filaDisponible.cells[2].innerHTML = `<input type="text" class="presupuesto-tabla__desc-input" placeholder="Escribir nombre del producto…" value="" autocomplete="off" />`;
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

  filaDisponible.cells[4].innerHTML = `
    <div class="qty-control">
      <button type="button" class="qty-btn qty-btn--minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button>
      <input type="number" min="1" max="${stockNum}" value="${cantaInicial}" class="presupuesto-tabla__input presupuesto-tabla__input--qty" />
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
      filaDisponible.cells[4].innerHTML   = `<input type="number" min="1" value="0" class="presupuesto-tabla__input presupuesto-tabla__input--qty" disabled />`;
      filaDisponible.cells[5].textContent = "0";
      filaDisponible.cells[6].textContent = "";
      if (imgElement) imgElement.style.display = "none";
      botonEliminar.style.display = "none";
      calcularTotal();
      renderResultados(_productosEnBusqueda);
    });
  }

  filaDisponible.classList.add('row-new');
  setTimeout(() => filaDisponible.classList.remove('row-new'), 500);
}

// ── Helpers buscador ────────────────────────────────────────────────────────
let _productosEnBusqueda = [];

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

  document.getElementById('invoice-form').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); return false; } });

  // ── Submit ────────────────────────────────────────────────────────────────
  document.getElementById('invoice-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const filas = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    const invoiceItems = [];

    for (let i = 0; i < filas.length; i++) {
      const productoId  = filas[i].dataset.productoId || '';
      const codigo      = filas[i].cells[1].textContent.trim();
      const descInput   = filas[i].cells[2].querySelector('input.presupuesto-tabla__desc-input');
      const descripcion = descInput ? (descInput.value.trim() || 'PRODUCTO PRUEBA') : filas[i].cells[2].textContent.trim();
      const precioInput = filas[i].cells[3].querySelector('input').value;
      let precio_unitario = parseFloat(precioInput.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim());
      let cantidad = parseInt(filas[i].cells[4].querySelector('input').value);
      const stock  = parseInt(filas[i].cells[5].textContent.trim());

      precio_unitario = !isNaN(precio_unitario) ? precio_unitario : 0;
      cantidad        = !isNaN(cantidad)         ? cantidad        : 1;

      if (cantidad > stock) {
        Swal.fire({ title: 'Stock insuficiente', text: `No hay stock en fila ${i + 1}. Tiene ${stock}, quiere ${cantidad}.`, icon: 'error', confirmButtonText: 'Entendido' });
        return;
      }

      const subtotal = precio_unitario * cantidad;
      if (codigo !== '' && descripcion !== '' && precio_unitario > 0 && cantidad > 0) {
        invoiceItems.push({ producto_id: productoId || codigo, descripcion, es_producto_prueba: !!descInput, precio_unitario, cantidad, subtotal });
      }
    }

    if (invoiceItems.length === 0) {
      Swal.fire({ title: 'Error', text: 'Debe agregar al menos un producto válido.', icon: 'error', confirmButtonText: 'Entendido' });
      return;
    }

    const totalFacturaElement = document.getElementById('total-amount');
    let totalFactura = '0';
    if (totalFacturaElement) totalFactura = totalFacturaElement.value.replace(/\./g, '').replace(',', '.').replace('$', '').trim();

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

  function crearElementoResultado(producto, enTabla) {
    const id       = String(producto.id);
    const cod      = String(producto.codigo ?? '').trim();
    const stockMax = parseInt(producto.stock_actual) || 0;
    const info     = enTabla[id] || null;

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

    // Imagen
    const imgWrap = document.createElement('div');
    imgWrap.classList.add('srb-img-wrap');
    if (producto.imagenes && producto.imagenes.length > 0) {
      const img = document.createElement('img');
      img.src = '/uploads/productos/' + producto.imagenes[0].imagen;
      img.loading = 'lazy'; img.decoding = 'async';
      img.classList.add('srb-img');
      imgWrap.appendChild(img);
    } else {
      imgWrap.innerHTML = '<span class="srb-img-placeholder"><i class="fa-solid fa-image"></i></span>';
    }
    resultado.appendChild(imgWrap);

    // Nombre + precio
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

    // Badge
    const badge = document.createElement('span');
    badge.classList.add('srb-badge');
    badge.textContent  = info ? info.cantidad : '';
    badge.style.display = info ? 'inline-flex' : 'none';
    resultado.appendChild(badge);

    // Controles
    const controles = document.createElement('div');
    controles.classList.add('srb-controles');

    const btnMinus = document.createElement('button');
    btnMinus.type = 'button'; btnMinus.classList.add('srb-qty-minus', 'srb-btn');
    btnMinus.innerHTML = '<i class="fa-solid fa-minus"></i>';

    const qtyInput = document.createElement('input');
    qtyInput.type     = 'number';
    qtyInput.min      = '0';
    qtyInput.max      = String(stockMax || 999);
    qtyInput.value    = info ? String(info.cantidad) : '1';
    qtyInput.tabIndex = -1;
    qtyInput.setAttribute('form', '');
    qtyInput.classList.add('srb-qty-input');

    const btnPlus = document.createElement('button');
    btnPlus.type = 'button'; btnPlus.classList.add('srb-qty-plus', 'srb-btn');
    btnPlus.innerHTML = '<i class="fa-solid fa-plus"></i>';

    const btnAgregar = document.createElement('button');
    btnAgregar.type = 'button'; btnAgregar.classList.add('srb-agregar', 'srb-btn');
    btnAgregar.innerHTML = '<i class="fa-solid fa-cart-plus"></i><span>Agregar</span>';
    btnAgregar.style.display = info ? 'none' : 'flex';

    const btnQuitar = document.createElement('button');
    btnQuitar.type = 'button'; btnQuitar.classList.add('srb-delete', 'srb-btn');
    btnQuitar.innerHTML = '<i class="fa-solid fa-trash"></i><span>Quitar</span>';
    btnQuitar.style.display = info ? 'flex' : 'none';

    controles.appendChild(btnMinus);
    controles.appendChild(qtyInput);
    controles.appendChild(btnPlus);
    controles.appendChild(btnAgregar);
    controles.appendChild(btnQuitar);
    resultado.appendChild(controles);

    // ── Bloquear propagación en TODOS los eventos de controles ──────────────
    // mousedown: preventDefault evita que el buscador pierda el foco al hacer click en los controles
    [btnMinus, btnPlus, btnAgregar, btnQuitar, qtyInput].forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        _keepOpen = true;
      });
    });

    // Variables fijadas en el closure — deben estar ANTES de los listeners
    const _id     = producto.id;
    const _cod    = cod;
    const _nombre = producto.nombre;
    const _precio = producto.precio_venta;
    const _stock  = producto.stock_actual;
    const _imagen = resultado.dataset.imagen || '';

    qtyInput.addEventListener('input', e => {
      e.stopImmediatePropagation();
      let v = Math.max(1, Math.min(parseInt(qtyInput.value) || 1, stockMax));
      qtyInput.value = v;
      if (resultado.classList.contains('en-tabla')) { _setQtyEnTabla(_id, v); renderResultados(_productosEnBusqueda); }
    });
    qtyInput.addEventListener('keydown', e => { e.stopImmediatePropagation(); if (e.key === 'Enter') e.preventDefault(); });

    btnMinus.addEventListener('click', e => {
      e.stopImmediatePropagation();
      const v = parseInt(qtyInput.value) || 1;
      if (resultado.classList.contains('en-tabla')) {
        if (v <= 1) { _quitarDeTabla(_id); }
        else        { qtyInput.value = v - 1; _setQtyEnTabla(_id, v - 1); }
        renderResultados(_productosEnBusqueda);
      } else {
        if (v > 1) qtyInput.value = v - 1;
      }
      entradaBusqueda.focus(); _keepOpen = false;
    });

    btnPlus.addEventListener('click', e => {
      e.stopImmediatePropagation();
      const v = parseInt(qtyInput.value) || 1;
      if (v >= stockMax) { Swal.fire({ title: 'Stock máximo', text: `Solo hay ${stockMax} unidades.`, icon: 'warning', confirmButtonText: 'Entendido' }); }
      else {
        qtyInput.value = v + 1;
        if (resultado.classList.contains('en-tabla')) { _setQtyEnTabla(_id, v + 1); renderResultados(_productosEnBusqueda); }
      }
      entradaBusqueda.focus(); _keepOpen = false;
    });

    btnAgregar.addEventListener('click', e => {
      e.stopImmediatePropagation();
      const qty = parseInt(qtyInput.value) || 1;
      agregarProductoATabla(_id, _cod, _nombre, _precio, _stock, _imagen, qty);
      renderResultados(_productosEnBusqueda);
      entradaBusqueda.focus(); _keepOpen = false;
    });

    btnQuitar.addEventListener('click', e => {
      e.stopImmediatePropagation();
      _quitarDeTabla(_id);
      renderResultados(_productosEnBusqueda);
      entradaBusqueda.focus(); _keepOpen = false;
    });

    resultado.addEventListener('mouseenter', function () { document.querySelectorAll('.resultado-busqueda').forEach(r => r.classList.remove('hover-activo')); this.classList.add('hover-activo'); });
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

  function renderResultados(productos) {
    _productosEnBusqueda = productos;
    resultadosBusqueda.innerHTML = '';
    if (!productos.length) { resultadosBusqueda.style.display = 'none'; return; }
    const enTabla = _obtenerIdsEnTabla();
    productos.forEach(p => resultadosBusqueda.appendChild(crearElementoResultado(p, enTabla)));
    resultadosBusqueda.style.display = 'block';
  }

  entradaBusqueda.addEventListener('input', e => {
    const busqueda = e.target.value.trim();
    resultadosBusqueda.innerHTML = ''; resultadosBusqueda.style.display = 'none';
    if (_searchController) { _searchController.abort(); _searchController = null; }
    clearTimeout(_searchTimer);
    if (!busqueda) { _productosEnBusqueda = []; return; }
    const q = busqueda;
    _searchTimer = setTimeout(async () => {
      _searchController = new AbortController();
      try {
        const resp = await fetch('/productos/api/buscar?q=' + encodeURIComponent(busqueda), { signal: _searchController.signal });
        const productos = await resp.json();
        renderResultados(productos);
      } catch (err) {
        if (err.name !== 'AbortError') console.error('[Buscador]', err);
      }
    }, 280);
  });

  entradaBusqueda.addEventListener('blur', () => {
    if (_keepOpen) return;
    timeoutId = setTimeout(() => { resultadosBusqueda.style.display = 'none'; }, 200);
  });
  entradaBusqueda.addEventListener('focus', () => {
    clearTimeout(timeoutId);
    if (_productosEnBusqueda.length > 0 && entradaBusqueda.value.trim()) renderResultados(_productosEnBusqueda);
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
    if      (e.key === 'ArrowDown') { e.preventDefault(); const n = items[Math.min(idx+1, items.length-1)]; items.forEach(r => r.classList.remove('hover-activo')); n.classList.add('hover-activo'); n.scrollIntoView({ block:'nearest' }); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); const n = items[Math.max(idx-1, 0)];              items.forEach(r => r.classList.remove('hover-activo')); n.classList.add('hover-activo'); n.scrollIntoView({ block:'nearest' }); }
    else if (e.key === 'Enter' && activo) { e.preventDefault(); activo.querySelector('.srb-agregar')?.click(); }
    else if (e.key === 'Escape') { resultadosBusqueda.style.display = 'none'; }
  });

  // Tabla existente
  document.querySelectorAll('#tabla-factura tbody tr').forEach(row => {
    const ic = row.cells[4].querySelector('input');
    const ip = row.cells[3].querySelector('input');
    if (ic) ic.addEventListener('input', () => updateSubtotal(row));
    if (ip) ip.addEventListener('input', () => updateSubtotal(row, false));
  });

  document.querySelectorAll('input:not(#entradaBusqueda):not(#headerEntradaBusqueda)').forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); return false; } });
  });

}); // END DOMContentLoaded