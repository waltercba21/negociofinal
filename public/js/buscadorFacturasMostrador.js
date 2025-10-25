function fechaHoyYYYYMMDD(timeZone = 'America/Argentina/Cordoba') {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

// Evitar Enter que envía el form, pero permitimos Enter en el buscador
document.getElementById('invoice-form').addEventListener('keydown', function(e) {
  const isSearch = e.target && e.target.id === 'entradaBusqueda';
  if (e.key === 'Enter' && !isSearch) {
    e.preventDefault();
    return false;
  }
});

document.getElementById('invoice-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  // Validación método de pago
  const metodosPagoSeleccionados = document.querySelector('input[name="metodosPago"]:checked');
  if (!metodosPagoSeleccionados) {
    Swal.fire({ title: 'Error', text: 'Debe seleccionar un método de pago antes de continuar.', icon: 'warning', confirmButtonText: 'Entendido' });
    return;
  }

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
      Swal.fire({ title: 'Stock insuficiente', text: `No hay stock suficiente para el producto en la fila ${i + 1}. Tiene ${stock}, y desea facturar ${cantidad}.`, icon: 'error', confirmButtonText: 'Entendido' });
      return;
    }

    const subtotal = precio_unitario * cantidad;

    if (codigo !== '' && descripcion !== '' && precio_unitario > 0 && cantidad > 0) {
      invoiceItems.push({ producto_id: codigo, descripcion, precio_unitario, cantidad, subtotal });
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

  try {
    const response = await fetch('/productos/procesarFormularioFacturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombreCliente: document.getElementById('nombre-cliente').value.trim(),
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

// --- Protege la fecha contra cambios no intencionales ---
function setupFechaProtegida(fechaInput, mensaje = 'CUIDADO: ESTÁ POR CAMBIAR LA FECHA') {
  if (!fechaInput) return;

  let base = fechaInput.value;
  let prev = base;

  fechaInput.addEventListener('focus', () => { prev = fechaInput.value; });
  fechaInput.addEventListener('mousedown', () => { prev = fechaInput.value; });

  async function confirmarCambio() {
    const nueva = fechaInput.value;
    if (!nueva || nueva === prev) return;

    const { isConfirmed } = await Swal.fire({
      title: '⚠️ Atención',
      text: `${mensaje}. La fecha habitual es ${base}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'No, mantener',
      reverseButtons: true,
      focusCancel: true
    });

    if (isConfirmed) {
      base = nueva;
      fechaInput.dispatchEvent(new Event('change'));
    } else {
      fechaInput.value = prev;
      fechaInput.dispatchEvent(new Event('change'));
    }
  }

  fechaInput.addEventListener('change', confirmarCambio);
  fechaInput.addEventListener('input', confirmarCambio);
}

// =================== MODAL: helpers ===================
const ModalBusqueda = (() => {
  const modal = document.getElementById('modal-busqueda');
  const grid  = document.getElementById('modal-resultados-grid');
  const qEl   = document.getElementById('modal-busqueda-query');
  const cEl   = document.getElementById('modal-busqueda-count');

  function open(query, productos) {
    // Orden z-index para evitar “pantalla negra”
    const backdrop = modal.querySelector('.modal-backdrop');
    const dialog   = modal.querySelector('.modal-dialog');
    if (backdrop) backdrop.style.zIndex = '1';
    if (dialog)   dialog.style.zIndex   = '2';

    qEl.textContent = query ? `Coincidencias para: “${query}”` : 'Resultados';
    cEl.textContent = `(${productos.length} ítems)`;

    grid.innerHTML = '';
    productos.forEach(p => grid.appendChild(cardFromProducto(p)));

    modal.classList.add('abierto');
    modal.setAttribute('aria-hidden', 'false');

    // Bloquear scroll del body mientras el modal esté abierto
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    setTimeout(() => grid.focus(), 0);
  }

  function close() {
    modal.classList.remove('abierto');
    modal.setAttribute('aria-hidden', 'true');
    grid.innerHTML = '';

    // Restaurar scroll
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

function cardFromProducto(producto) {
  const el = document.createElement('div');
  el.className = 'card-prod';
  el.tabIndex = 0;

  // Normalizo posibles campos que devuelva tu API
  const id     = producto.id ?? producto.producto_id ?? '';
  const codigo = producto.codigo ?? producto.codigo_proveedor ?? '';
  const nombre = producto.nombre ?? producto.descripcion ?? '';
  const precio = producto.precio_venta ?? producto.precio ?? 0;
  const stock  = producto.stock_actual ?? producto.stock ?? 0;
  const img    = (producto.imagenes && producto.imagenes[0] && producto.imagenes[0].imagen)
    ? '/uploads/productos/' + producto.imagenes[0].imagen
    : '';

  // Guardamos TODO lo útil en data-*
  el.dataset.id            = id;
  el.dataset.codigo        = codigo;
  el.dataset.nombre        = nombre;
  el.dataset.precio_venta  = precio;
  el.dataset.stock_actual  = stock;
  if (img) el.dataset.imagen = img;

  // Thumb
  const thumb = document.createElement('img');
  thumb.className = 'card-thumb';
  thumb.src = img || '';
  thumb.alt = nombre || 'Producto';
  if (!img) thumb.style.display = 'none';

  // Body (más rico)
  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = nombre;

  // Precio grande
  const price = document.createElement('div');
  price.className = 'price-strong';
  try { price.textContent = parseFloat(precio).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }); }
  catch { price.textContent = precio; }

  // Metas: código y stock
  const meta = document.createElement('div');
  meta.className = 'card-meta';

  const bCodigo = document.createElement('span');
  bCodigo.className = 'badge';
  bCodigo.textContent = codigo ? `Código: ${codigo}` : 'Sin código';

  const bStock = document.createElement('span');
  bStock.className = 'badge';
  bStock.textContent = `Stock: ${stock}`;

  meta.appendChild(bCodigo);
  meta.appendChild(bStock);

  body.appendChild(title);
  body.appendChild(price);
  body.appendChild(meta);

  el.appendChild(thumb);
  el.appendChild(body);

  // Acción primaria: pick
  function pick() {
    // Usamos id como producto_id (back-end lo espera), y en descripción anexamos el código visible
    agregarProductoATabla(
      el.dataset.id || el.dataset.codigo || '',            // producto_id preferido
      el.dataset.nombre + (el.dataset.codigo ? ` (${el.dataset.codigo})` : ''),
      el.dataset.precio_venta,
      el.dataset.stock_actual,
      el.dataset.imagen
    );
    ModalBusqueda.close();
  }

  el.addEventListener('click', pick);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') pick(); });

  return el;
}
// Delegación de eventos en el grid (back-up sólido)
(function(){
  const grid = document.getElementById('modal-resultados-grid');
  if (!grid) return;
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card-prod');
    if (!card) return;
    // Simulamos el pick de la tarjeta
    agregarProductoATabla(
      card.dataset.id || card.dataset.codigo || '',
      (card.dataset.nombre || '') + (card.dataset.codigo ? ` (${card.dataset.codigo})` : ''),
      card.dataset.precio_venta,
      card.dataset.stock_actual,
      card.dataset.imagen
    );
    ModalBusqueda.close();
  });
})();


  // Botones y fondo para cerrar
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', close);
  });
  document.addEventListener('keydown', (e) => {
    const visible = modal.classList.contains('abierto');
    if (visible && e.key === 'Escape') close();
  });

  return { open, close };
})();

document.addEventListener('DOMContentLoaded', () => {
  Swal.fire({
    title: 'Está en la sección de Facturas',
    text: 'Recuerde que está realizando una factura, no un presupuesto.',
    icon: 'info',
    confirmButtonText: 'Entendido'
  });

  const fechaPresupuestoInput = document.getElementById('fecha-presupuesto');
  if (fechaPresupuestoInput) {
    fechaPresupuestoInput.value = fechaHoyYYYYMMDD();
    setupFechaProtegida(fechaPresupuestoInput, 'CUIDADO: ESTÁ POR CAMBIAR LA FECHA DE LA FACTURA');
  }

  const entradaBusqueda = document.getElementById('entradaBusqueda');
  const resultadosBusqueda = document.getElementById('resultadosBusqueda'); // legacy oculto
  if (resultadosBusqueda) {
    resultadosBusqueda.innerHTML = '';
    resultadosBusqueda.style.display = 'none';
  }

  // ✅ Ahora NO abrimos el modal al tipear.
  //   El usuario puede escribir frases largas sin perder el foco.

  // Enter para abrir modal con resultados
  entradaBusqueda.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const query = (entradaBusqueda.value || '').trim();
    if (!query) return;

    try {
      const url = '/productos/api/buscar?q=' + encodeURIComponent(query);
      const respuesta = await fetch(url);
      const productos = await respuesta.json();
      ModalBusqueda.open(query, Array.isArray(productos) ? productos : []);
    } catch (err) {
      console.error('[BUSCADOR] Error buscando productos (Enter):', err);
      Swal.fire('Error', 'No se pudieron cargar los resultados de búsqueda', 'error');
    }
  });

  // (Opcional) Si agregás un botón “Buscar”, se soporta aquí:
  const btnBuscar = document.getElementById('btnBuscarBuscador');
  if (btnBuscar) {
    btnBuscar.addEventListener('click', async () => {
      const query = (entradaBusqueda.value || '').trim();
      if (!query) return;
      try {
        const url = '/productos/api/buscar?q=' + encodeURIComponent(query);
        const respuesta = await fetch(url);
        const productos = await respuesta.json();
        ModalBusqueda.open(query, Array.isArray(productos) ? productos : []);
      } catch (err) {
        console.error('[BUSCADOR] Error buscando productos (click):', err);
        Swal.fire('Error', 'No se pudieron cargar los resultados de búsqueda', 'error');
      }
    });
  }
});

function agregarProductoATabla(codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto) {
  const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
  const filas = tablaFactura.rows;
  let filaDisponible = null;

  for (let i = 0; i < filas.length; i++) {
    if (!filas[i].cells[1].textContent.trim()) { filaDisponible = filas[i]; break; }
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
  } else if (imgElement) {
    imgElement.style.display = "none";
    imgElement.removeAttribute('src');
  }

  filaDisponible.cells[1].textContent = codigoProducto || '';
  filaDisponible.cells[2].textContent = nombreProducto || '';

 // 🔥 También recalculamos si el precio es editable por el vendedor
const inputPrecio = filaDisponible.cells[3].querySelector("input");
if (inputPrecio) {
  // Cambios en precio NO verifican stock
  inputPrecio.addEventListener('input', function () {
    updateSubtotal(filaDisponible, false);
  });
}

  const inputCantidad = filaDisponible.cells[4].querySelector("input");
 if (inputCantidad) {
  inputCantidad.value = 1;
  inputCantidad.disabled = false;
  // Recalcula siempre que cambie la cantidad (y valida stock)
  inputCantidad.addEventListener('input', function () {
    updateSubtotal(filaDisponible, true);
  });
}

  filaDisponible.cells[5].textContent = (parseInt(stockActual) || 0);

  const subtotalInicial = (parseFloat(precioVenta) || 0) * 1;
  filaDisponible.cells[6].textContent = subtotalInicial.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

  calcularTotal();

  const botonEliminar = filaDisponible.cells[7].querySelector("button");
  if (botonEliminar) {
    botonEliminar.style.display = "block";
    botonEliminar.classList.add("boton-eliminar-factura");
    botonEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    botonEliminar.replaceWith(botonEliminar.cloneNode(true));
    const nuevoBoton = filaDisponible.cells[7].querySelector("button");
    nuevoBoton.addEventListener("click", function () {
      filaDisponible.cells[1].textContent = "";
      filaDisponible.cells[2].textContent = "";
      if (inputPrecio) inputPrecio.value = "";
      if (inputCantidad) inputCantidad.value = "";
      filaDisponible.cells[5].textContent = "";
      filaDisponible.cells[6].textContent = "";
      if (imgElement) { imgElement.style.display = "none"; imgElement.removeAttribute('src'); }
      nuevoBoton.style.display = "none";
      calcularTotal();
    });
  }
}

function updateSubtotal(row, verificarStock = true) {
  const inputPrecio = row.cells[3].querySelector('input');
  const inputCantidad = row.cells[4].querySelector('input');
  const stockActualCell = row.cells[5];

  if (!inputPrecio || !inputCantidad || !stockActualCell) {
    console.error("Error: No se encontraron los elementos necesarios en la fila.");
    return;
  }

  let precio = parseFloat(inputPrecio.value.replace(/\$|\./g, '').replace(',', '.'));
  let cantidad = parseInt(inputCantidad.value);
  let stockActual = parseInt(stockActualCell.textContent.replace(/\$|\./g, '').replace(',', '.'));

  precio = !isNaN(precio) ? precio : 0;
  cantidad = !isNaN(cantidad) ? cantidad : 1;
  stockActual = !isNaN(stockActual) ? stockActual : 0;

  const subtotal = precio * cantidad;
  row.cells[6].textContent = subtotal.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

  if (verificarStock && document.activeElement === inputCantidad) {
    if (cantidad > stockActual) {
      Swal.fire({ title: 'ALERTA', text: 'NO HAY STOCK DISPONIBLE. Solo hay ' + stockActual + ' unidades en stock.', icon: 'error', confirmButtonText: 'Entendido' });
      inputCantidad.value = stockActual > 0 ? stockActual : 1;
      cantidad = parseInt(inputCantidad.value);
    }

    const stockRestante = stockActual - cantidad;
    const stockMinimo = 5;

    if (stockRestante <= stockMinimo && stockRestante >= 0) {
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

  interesAmountInput.value = interes.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  totalAmountInput.value = total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

// Bloquea Enter fuera del buscador
document.querySelectorAll('input:not(#entradaBusqueda)').forEach(input => {
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      return false;
    }
  });
});
// Guard de arranque: aseguro modal cerrado y scroll normal
document.addEventListener('DOMContentLoaded', () => {
  const m = document.getElementById('modal-busqueda');
  if (m) {
    m.classList.remove('abierto');
    m.setAttribute('aria-hidden', 'true');
  }
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
});
