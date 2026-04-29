// buscadorPresupuesto.js — v2026-04-29-enhanced

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

  // Verificar si el producto ya está en la tabla → incrementar cantidad
  for (let i = 0; i < filas.length; i++) {
    if (filas[i].cells[1].textContent.trim() === String(codigoProducto).trim()) {
      const inputQty = filas[i].cells[4].querySelector('input');
      const stockNum = parseInt(filas[i].cells[5].textContent) || 0;
      if (inputQty) {
        const actual = parseInt(inputQty.value) || 1;
        if (actual < stockNum) {
          inputQty.value = actual + 1;
          updateSubtotal(filas[i]);
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

  const stockNum = parseInt(stockActual) || 0;

  filaDisponible.dataset.productoId = productoId;

  const imgElement = filaDisponible.cells[0].querySelector("img");
  if (imagenProducto && imgElement) {
    imgElement.src = imagenProducto;
    imgElement.style.display = "block";
  }

  filaDisponible.cells[1].textContent = codigoProducto;

  const esPrueba = nombreProducto.trim().toUpperCase() === 'PRODUCTO PRUEBA';
  if (esPrueba) {
    filaDisponible.cells[2].innerHTML =
      `<input type="text"
              class="presupuesto-tabla__desc-input"
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
      filaDisponible.cells[4].innerHTML = `<input type="number" min="1" value="0" class="presupuesto-tabla__input presupuesto-tabla__input--qty" disabled />`;
      filaDisponible.cells[5].textContent = "0";
      filaDisponible.cells[6].textContent = "";
      if (imgElement) imgElement.style.display = "none";
      botonEliminar.style.display = "none";
      calcularTotal();
      _actualizarContadoresEnResultados();
    });
  }

  filaDisponible.classList.add('row-new');
  setTimeout(() => filaDisponible.classList.remove('row-new'), 500);
}

// ── Estado global del buscador avanzado ───────────────────────────────────
let _productosEnBusqueda = [];

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

function _actualizarContadoresEnResultados() {
  const enTabla = _obtenerProductosEnTabla();
  document.querySelectorAll('.resultado-busqueda').forEach(el => {
    const cod = el.dataset.codigo;
    const badgeEl  = el.querySelector('.srb-badge');
    const deleteBtn = el.querySelector('.srb-delete');
    const qtyMinus  = el.querySelector('.srb-qty-minus');
    const qtyPlus   = el.querySelector('.srb-qty-plus');
    const qtyVal    = el.querySelector('.srb-qty-val');

    if (enTabla[cod]) {
      const info = enTabla[cod];
      if (badgeEl)   { badgeEl.textContent = info.cantidad; badgeEl.style.display = 'inline-flex'; }
      if (deleteBtn)  deleteBtn.style.display = 'flex';
      if (qtyMinus)   qtyMinus.style.display  = 'flex';
      if (qtyPlus)    qtyPlus.style.display   = 'flex';
      if (qtyVal)     { qtyVal.textContent = info.cantidad; qtyVal.style.display = 'inline-block'; }
      el.classList.add('en-tabla');
    } else {
      if (badgeEl)    { badgeEl.textContent = ''; badgeEl.style.display = 'none'; }
      if (deleteBtn)   deleteBtn.style.display = 'none';
      if (qtyMinus)    qtyMinus.style.display  = 'none';
      if (qtyPlus)     qtyPlus.style.display   = 'none';
      if (qtyVal)      qtyVal.style.display    = 'none';
      el.classList.remove('en-tabla');
    }
  });
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
      const descInput   = filas[i].cells[2].querySelector('input.presupuesto-tabla__desc-input');
      const descripcion = descInput
        ? (descInput.value.trim() || 'PRODUCTO PRUEBA')
        : filas[i].cells[2].textContent.trim();
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
        invoiceItems.push({
          producto_id: productoId || codigo,
          descripcion,
          es_producto_prueba: !!descInput,
          precio_unitario,
          cantidad,
          subtotal
        });
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

  // ══════════════════════════════════════════════════════════════════════════
  // BUSCADOR AVANZADO — mantiene texto, controles qty y borrar desde dropdown
  // ══════════════════════════════════════════════════════════════════════════

  const entradaBusqueda    = document.getElementById('entradaBusqueda');
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  let timeoutId;
  let _searchTimer = null;
  let _searchController = null;
  let _keepResultsOpen = false;

  function crearElementoResultado(producto, enTabla) {
    const cod = producto.codigo;
    const enTablaInfo = enTabla[cod];

    const resultado = document.createElement('div');
    resultado.classList.add('resultado-busqueda');
    if (enTablaInfo) resultado.classList.add('en-tabla');
    resultado.dataset.id           = producto.id;
    resultado.dataset.codigo       = cod;
    resultado.dataset.nombre       = producto.nombre;
    resultado.dataset.precio_venta = producto.precio_venta;
    resultado.dataset.stock_actual = producto.stock_actual;
    if (producto.imagenes && producto.imagenes.length > 0) {
      resultado.dataset.imagen = '/uploads/productos/' + producto.imagenes[0].imagen;
    }

    // Lado izquierdo: imagen + nombre
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

    const badge = document.createElement('span');
    badge.classList.add('srb-badge');
    badge.textContent = enTablaInfo ? enTablaInfo.cantidad : '';
    badge.style.display = enTablaInfo ? 'inline-flex' : 'none';
    izquierda.appendChild(badge);

    resultado.appendChild(izquierda);

    // Lado derecho: controles
    const derecha = document.createElement('div');
    derecha.classList.add('srb-controles');

    const btnMinus = document.createElement('button');
    btnMinus.type = 'button';
    btnMinus.classList.add('srb-qty-minus', 'srb-btn');
    btnMinus.innerHTML = '<i class="fa-solid fa-minus"></i>';
    btnMinus.style.display = enTablaInfo ? 'flex' : 'none';
    btnMinus.title = 'Restar 1 unidad';

    const qtyVal = document.createElement('span');
    qtyVal.classList.add('srb-qty-val');
    qtyVal.textContent = enTablaInfo ? enTablaInfo.cantidad : '';
    qtyVal.style.display = enTablaInfo ? 'inline-block' : 'none';

    const btnPlus = document.createElement('button');
    btnPlus.type = 'button';
    btnPlus.classList.add('srb-qty-plus', 'srb-btn');
    btnPlus.innerHTML = '<i class="fa-solid fa-plus"></i>';
    btnPlus.style.display = enTablaInfo ? 'flex' : 'none';
    btnPlus.title = 'Agregar 1 unidad';

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.classList.add('srb-delete', 'srb-btn');
    btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i>';
    btnDelete.style.display = enTablaInfo ? 'flex' : 'none';
    btnDelete.title = 'Quitar del presupuesto';

    derecha.appendChild(btnMinus);
    derecha.appendChild(qtyVal);
    derecha.appendChild(btnPlus);
    derecha.appendChild(btnDelete);
    resultado.appendChild(derecha);

    // Eventos
    izquierda.addEventListener('click', () => {
      agregarProductoATabla(
        resultado.dataset.id,
        resultado.dataset.codigo,
        resultado.dataset.nombre,
        resultado.dataset.precio_venta,
        resultado.dataset.stock_actual,
        resultado.dataset.imagen
      );
      _actualizarContadoresEnResultados();
      entradaBusqueda.focus();
    });

    btnPlus.addEventListener('mousedown', e => { e.preventDefault(); _keepResultsOpen = true; });
    btnPlus.addEventListener('click', (e) => {
      e.stopPropagation();
      agregarProductoATabla(
        resultado.dataset.id,
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

    resultado.addEventListener('mouseenter', function () {
      document.querySelectorAll('.resultado-busqueda').forEach(r => r.classList.remove('hover-activo'));
      this.classList.add('hover-activo');
    });
    resultado.addEventListener('mouseleave', function () {
      this.classList.remove('hover-activo');
    });

    return resultado;
  }

  function renderResultados(productos) {
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

  entradaBusqueda.addEventListener('input', (e) => {
    const busqueda = e.target.value.trim();

    if (_searchController) { _searchController.abort(); _searchController = null; }
    clearTimeout(_searchTimer);

    if (!busqueda) {
      resultadosBusqueda.innerHTML = '';
      resultadosBusqueda.style.display = 'none';
      _productosEnBusqueda = [];
      return;
    }

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
      }
    }, 280);
  });

  entradaBusqueda.addEventListener('blur', () => {
    if (_keepResultsOpen) return;
    timeoutId = setTimeout(() => {
      resultadosBusqueda.style.display = 'none';
    }, 200);
  });

  entradaBusqueda.addEventListener('focus', () => {
    clearTimeout(timeoutId);
    if (_productosEnBusqueda.length > 0 && entradaBusqueda.value.trim()) {
      renderResultados(_productosEnBusqueda);
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

  // Navegación con teclado
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