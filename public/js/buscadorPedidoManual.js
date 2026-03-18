/**
 * buscadorPedidoManual.js
 * ─────────────────────────────────────────────────────────────
 * Lógica de la pantalla "Pedido a Proveedor":
 *  - Búsqueda de productos por proveedor (con debounce)
 *  - Agregar / actualizar / eliminar ítems del pedido
 *  - Guardar pedido en la API
 *  - Generar PDFs (interno y para proveedor)
 *  - Precargar un pedido existente (modo edición)
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ══════════════════════════════════════════════════════════════
   1. ESTADO
══════════════════════════════════════════════════════════════ */

/** @type {Array<Object>} Productos que el usuario agregó al pedido */
let productosSeleccionados = [];

/** @type {Array<Object>} Última búsqueda realizada (para re-renderizar) */
let lastResults = [];

/** @type {boolean} ¿El pedido ya fue guardado en la DB en esta sesión? */
let pedidoGuardado = false;

/** @type {number|null} Timer del debounce de búsqueda */
let debounceTimer = null;


/* ══════════════════════════════════════════════════════════════
   2. REFERENCIAS AL DOM
══════════════════════════════════════════════════════════════ */

const entradaBusqueda   = document.getElementById('entradaBusqueda');
const proveedorSelect   = document.querySelector('.proveedores');
const contenedorDropdown = document.getElementById('contenedor-productos');
const resultsList       = document.getElementById('pmResultsList');
const tablaBody         = document.getElementById('tabla-pedido-body');
const totalPedidoEl     = document.getElementById('total-pedido');
const itemCountEl       = document.getElementById('pmItemCount');
const btnConfirmar      = document.getElementById('btn-confirmar');
const btnPdfProveedor   = document.getElementById('btn-pdf-proveedor');
const btnContinuar      = document.getElementById('btn-continuar');
const btnClearSearch    = document.getElementById('btnClearSearch');
const searchWrap        = document.getElementById('pmSearchWrap');
const pedidoIdInput     = document.getElementById('pedido_id');
const pedidoBadge       = document.getElementById('pmPedidoBadge');


/* ══════════════════════════════════════════════════════════════
   3. UTILIDADES
══════════════════════════════════════════════════════════════ */

/**
 * Devuelve la fecha actual formateada como DD/MM/AAAA (zona AR).
 * @returns {string}
 */
function fechaActual() {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date());
}

/**
 * Verifica que un valor sea un ID de proveedor válido (número entero positivo).
 * @param {*} val
 * @returns {boolean}
 */
function proveedorValido(val) {
  return /^\d+$/.test(String(val || ''));
}

/**
 * Convierte un valor a entero dentro de un rango [min, max].
 * Si no es número retorna `min`.
 * @param {*}      n
 * @param {number} min
 * @param {number} [max]
 * @returns {number}
 */
function clampInt(n, min, max) {
  const x = parseInt(n, 10);
  if (Number.isNaN(x)) return min;
  return Math.max(min, typeof max === 'number' ? Math.min(max, x) : x);
}

/**
 * Formatea un número con separador de miles (punto) sin decimales.
 * @param {number} num
 * @returns {string}  Ej: 1.234.567
 */
function formatearNumero(num) {
  return Math.round(Number(num || 0))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formatea como moneda ARS: "$1.234".
 * @param {number} num
 * @returns {string}
 */
function money(num) {
  return `$${formatearNumero(num)}`;
}

/**
 * Igual que `money`, pero devuelve "—" si el valor es 0 o inválido.
 * @param {number} num
 * @returns {string}
 */
function moneyOrDash(num) {
  const x = Number(num);
  return Number.isFinite(x) && x > 0 ? money(x) : '—';
}

/**
 * Devuelve el código del producto (o "—" si no existe).
 * @param {Object} producto
 * @returns {string}
 */
function getCodigo(producto) {
  return producto.codigo || '—';
}

/**
 * Construye la URL de la imagen principal del producto.
 * @param {Object} producto
 * @returns {string}
 */
function imgSrc(producto) {
  const imgs = producto.imagenes;
  if (Array.isArray(imgs) && imgs.length > 0) {
    const first = imgs[0];
    const name  = first && typeof first === 'object' ? first.imagen : first;
    if (name) return `/uploads/productos/${name}`;
  }
  return '/ruta/imagen-defecto.jpg';
}


/* ══════════════════════════════════════════════════════════════
   4. GESTIÓN DE ESTADO DEL PEDIDO
══════════════════════════════════════════════════════════════ */

/**
 * Busca un producto en `productosSeleccionados` por su ID.
 * @param {number|string} id
 * @returns {Object|null}
 */
function getProductoById(id) {
  return productosSeleccionados.find(p => Number(p.id) === Number(id)) || null;
}

/**
 * Recalcula `precioTotal` de un producto según su costo y cantidad.
 * Muta el objeto directamente.
 * @param {Object} p
 */
function recalcularTotales(p) {
  p.precioTotal = (Number(p.costo_neto) || 0) * (Number(p.cantidad) || 1);
}

/**
 * Agrega un producto nuevo o actualiza la cantidad si ya existe.
 * @param {Object} producto  Datos del producto desde la API
 * @param {number} cantidad
 */
function upsertProducto(producto, cantidad) {
  const cant     = clampInt(cantidad, 1);
  const existente = getProductoById(producto.id);

  if (existente) {
    existente.cantidad = cant;
    recalcularTotales(existente);
  } else {
    const nuevo = { ...producto, cantidad: cant };
    recalcularTotales(nuevo);
    productosSeleccionados.push(nuevo);
  }

  renderTabla();

  // Si el dropdown está visible, actualizarlo para reflejar "En pedido"
  if (entradaBusqueda?.value.trim()) {
    renderResultados(lastResults);
  }
}

/**
 * Elimina un producto del pedido por ID.
 * @param {number|string} id
 */
function eliminarProducto(id) {
  productosSeleccionados = productosSeleccionados.filter(
    p => Number(p.id) !== Number(id)
  );
  renderTabla();
  if (contenedorDropdown && !contenedorDropdown.hidden) {
    renderResultados(lastResults);
  }
}


/* ══════════════════════════════════════════════════════════════
   5. RENDERIZADO — TABLA DEL PEDIDO
══════════════════════════════════════════════════════════════ */

/**
 * Actualiza el total general en el footer de la tabla.
 */
function actualizarTotal() {
  const total = productosSeleccionados.reduce(
    (sum, p) => sum + (Number(p.precioTotal) || 0), 0
  );
  if (totalPedidoEl) totalPedidoEl.textContent = money(total);
}

/**
 * Actualiza el contador de ítems en la cabecera de la tabla.
 */
function actualizarContador() {
  if (!itemCountEl) return;
  const n = productosSeleccionados.length;
  itemCountEl.textContent = n > 0 ? `${n} producto${n > 1 ? 's' : ''}` : '';
}

/**
 * Re-renderiza todo el cuerpo de la tabla y actualiza totales.
 */
function renderTabla() {
  if (!tablaBody) return;

  if (!productosSeleccionados.length) {
    tablaBody.innerHTML = `
      <tr class="pm-empty-row">
        <td colspan="6">
          <span class="pm-empty-icon">📦</span>
          Todavía no hay productos en el pedido.
        </td>
      </tr>`;
    actualizarTotal();
    actualizarContador();
    return;
  }

  tablaBody.innerHTML = productosSeleccionados.map(p => `
    <tr data-id="${p.id}">
      <td class="pm-td-code">${getCodigo(p)}</td>
      <td class="pm-td-name" title="${(p.nombre || '').replace(/"/g, '&quot;')}">${p.nombre || ''}</td>
      <td class="pm-td-right pm-td-money">${moneyOrDash(p.costo_neto)}</td>
      <td class="pm-td-right">
        <input
          class="pm-qty-table"
          type="number"
          min="1"
          step="1"
          inputmode="numeric"
          value="${p.cantidad}"
          aria-label="Cantidad"
        >
      </td>
      <td class="pm-td-right pm-td-money">
        <span class="row-total pm-td-total-value">${money(p.precioTotal)}</span>
      </td>
      <td class="pm-td-right">
        <button class="pm-btn-remove" type="button" data-action="remove" aria-label="Eliminar producto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join('');

  actualizarTotal();
  actualizarContador();
}


/* ══════════════════════════════════════════════════════════════
   6. RENDERIZADO — DROPDOWN DE RESULTADOS
══════════════════════════════════════════════════════════════ */

function abrirDropdown()  { if (contenedorDropdown) contenedorDropdown.hidden = false; }
function cerrarDropdown() { if (contenedorDropdown) contenedorDropdown.hidden = true;  }

/**
 * Muestra / oculta el botón "×" del buscador según si hay texto.
 */
function actualizarBtnClear() {
  if (!btnClearSearch || !entradaBusqueda) return;
  btnClearSearch.style.display =
    entradaBusqueda.value.trim().length ? 'inline-flex' : 'none';
}

/**
 * Limpia los resultados del dropdown y lo cierra.
 */
function limpiarResultados() {
  lastResults = [];
  if (resultsList) resultsList.innerHTML = '';
  cerrarDropdown();
}

/**
 * Limpia el input de búsqueda y cierra el dropdown.
 */
function limpiarBusqueda() {
  if (!entradaBusqueda) return;
  entradaBusqueda.value = '';
  actualizarBtnClear();
  limpiarResultados();
}

/**
 * Renderiza los resultados de búsqueda en el dropdown.
 * @param {Array<Object>} productos
 */
function renderResultados(productos) {
  if (!resultsList) return;

  lastResults = Array.isArray(productos) ? productos : [];

  if (!lastResults.length) {
    resultsList.innerHTML = `<div class="pm-empty-msg">Sin resultados para esta búsqueda.</div>`;
    abrirDropdown();
    return;
  }

  resultsList.innerHTML = lastResults.map(p => {
    const enPedido = getProductoById(p.id);
    const qty      = enPedido ? enPedido.cantidad : 1;

    return `
      <div class="pm-result-item" data-id="${p.id}">
        <img class="pm-result-img" src="${imgSrc(p)}" alt="${(p.nombre || '').replace(/"/g, '&quot;')}">

        <div>
          <div class="pm-result-name">${p.nombre || ''}</div>
          <div class="pm-result-meta">
            <span class="pm-pill">Cód: ${getCodigo(p)}</span>
            <span>Unit: ${moneyOrDash(p.costo_neto)}</span>
            ${enPedido ? '<span class="pm-pill pm-pill--success">✓ En pedido</span>' : ''}
          </div>
        </div>

        <input
          class="pm-qty-mini"
          type="number"
          min="1"
          step="1"
          inputmode="numeric"
          value="${qty}"
          aria-label="Cantidad"
        >

        <button
          class="pm-btn-add"
          type="button"
          data-action="${enPedido ? 'update' : 'add'}"
          data-variant="${enPedido ? 'update' : 'add'}"
        >${enPedido ? 'Actualizar' : 'Agregar'}</button>
      </div>
    `;
  }).join('');

  abrirDropdown();
}


/* ══════════════════════════════════════════════════════════════
   7. BÚSQUEDA DE PRODUCTOS (API)
══════════════════════════════════════════════════════════════ */

/**
 * Llama a la API y renderiza los resultados.
 * Solo se ejecuta si hay un proveedor seleccionado y texto en el buscador.
 */
async function buscarProductos() {
  if (!proveedorSelect || !entradaBusqueda) return;

  const proveedorId = proveedorSelect.value;
  if (!proveedorValido(proveedorId)) return;

  const q = entradaBusqueda.value.trim();
  actualizarBtnClear();

  if (!q) {
    limpiarResultados();
    return;
  }

  const url =
    `/productos/api/buscar?q=${encodeURIComponent(q)}&proveedor_id=${encodeURIComponent(proveedorId)}&limite=30`;

  const resp     = await fetch(url);
  const productos = await resp.json();

  renderResultados(productos || []);
}


/* ══════════════════════════════════════════════════════════════
   8. GESTIÓN DEL BADGE Y ESTADO "PEDIDO GUARDADO"
══════════════════════════════════════════════════════════════ */

/**
 * Actualiza el badge "#123" y el input hidden con el ID del pedido.
 * @param {number|null} id
 */
function setPedidoId(id) {
  if (pedidoIdInput) pedidoIdInput.value = id ? String(id) : '';
  if (pedidoBadge) {
    if (id) {
      pedidoBadge.removeAttribute('hidden');
      pedidoBadge.textContent = `#${id}`;
    } else {
      pedidoBadge.setAttribute('hidden', '');
      pedidoBadge.textContent = '';
    }
  }
}

/**
 * Lee el ID del pedido desde el input hidden.
 * @returns {number|null}
 */
function getPedidoId() {
  const v = String(pedidoIdInput?.value || '').trim();
  return /^\d+$/.test(v) ? Number(v) : null;
}

/**
 * Devuelve el nombre del proveedor seleccionado (sin el tramo "— Desc: XX%").
 * @returns {string}
 */
function nombreProveedor() {
  const opt = proveedorSelect?.selectedOptions?.[0];
  if (!opt) return 'Proveedor';
  return opt.textContent.replace(/\s*—\s*Desc:.*$/i, '').trim();
}


/* ══════════════════════════════════════════════════════════════
   9. GUARDAR PEDIDO EN LA API
══════════════════════════════════════════════════════════════ */

/**
 * Valida los datos mínimos del pedido y construye el payload.
 * @returns {Object|null}  null si la validación falla.
 */
function construirPayload() {
  const proveedor_id = proveedorSelect?.value;

  if (!proveedorValido(proveedor_id)) {
    alert('Seleccioná un proveedor antes de continuar.');
    return null;
  }
  if (!productosSeleccionados.length) {
    alert('Agregá al menos un producto al pedido.');
    return null;
  }

  const total = productosSeleccionados.reduce(
    (sum, p) => sum + (Number(p.precioTotal) || 0), 0
  );

  return {
    pedido_id: getPedidoId(),
    proveedor_id,
    total,
    productos: productosSeleccionados.map(p => ({
      id:        p.id,
      cantidad:  p.cantidad,
      costo_neto: p.costo_neto,
      codigo:    p.codigo,
    })),
  };
}

/**
 * Guarda el pedido en la DB si todavía no fue guardado en esta sesión.
 * @returns {Promise<{ok: boolean}>}
 */
async function guardarPedido() {
  if (pedidoGuardado) return { ok: true };

  const payload = construirPayload();
  if (!payload) return { ok: false };

  try {
    const resp = await fetch('/productos/guardarPedido', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      alert('Error al guardar el pedido: ' + (errData.message || 'error desconocido'));
      return { ok: false };
    }

    const data = await resp.json().catch(() => ({}));
    if (data?.pedido_id) setPedidoId(data.pedido_id);

    pedidoGuardado = true;
    alert('Pedido guardado con éxito.');
    return { ok: true };

  } catch (err) {
    console.error('guardarPedido:', err);
    alert('No se pudo conectar con el servidor. Intentá nuevamente.');
    return { ok: false };
  }
}


/* ══════════════════════════════════════════════════════════════
   10. GENERACIÓN DE PDF
══════════════════════════════════════════════════════════════ */

/**
 * Genera el PDF interno (con costos y totales).
 */
function generarPDFInterno() {
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF();
  const prov = nombreProveedor();
  const fecha = fechaActual();

  doc.setFontSize(16);
  doc.text(`PEDIDO INTERNO — ${prov}`, 10, 12);
  doc.setFontSize(11);
  doc.text(`Fecha: ${fecha}`, 10, 20);

  const total = productosSeleccionados.reduce(
    (sum, p) => sum + (Number(p.precioTotal) || 0), 0
  );

  doc.autoTable({
    head: [['Código', 'Producto', 'Costo neto', 'Cantidad', 'Total']],
    body: productosSeleccionados.map(p => [
      getCodigo(p),
      p.nombre,
      moneyOrDash(p.costo_neto),
      String(p.cantidad),
      money(Number(p.precioTotal) || 0),
    ]),
    startY: 26,
  });

  doc.setFontSize(12);
  doc.text(
    `Total pedido: ${money(total)}`,
    10,
    doc.previousAutoTable.finalY + 10
  );

  doc.save(`pedido_interno_${prov.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Genera el PDF para el proveedor (sin costos, solo código/producto/cantidad).
 */
function generarPDFProveedor() {
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF();
  const prov = nombreProveedor();
  const fecha = fechaActual();

  doc.setFontSize(16);
  doc.text(`PEDIDO PARA "${prov}"`, 10, 12);
  doc.setFontSize(11);
  doc.text(`Fecha: ${fecha}`, 10, 20);

  doc.autoTable({
    head: [['Código', 'Producto', 'Cantidad']],
    body: productosSeleccionados.map(p => [
      getCodigo(p),
      p.nombre,
      String(p.cantidad),
    ]),
    startY: 26,
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 125 },
      2: { cellWidth: 25, halign: 'right' },
    },
  });

  doc.save(`pedido_${prov.replace(/\s+/g, '_')}.pdf`);
}


/* ══════════════════════════════════════════════════════════════
   11. RESETEAR TODO
══════════════════════════════════════════════════════════════ */

/**
 * Limpia el estado completo de la pantalla (nuevo pedido desde cero).
 */
function resetAll() {
  productosSeleccionados = [];
  lastResults            = [];
  pedidoGuardado         = false;

  setPedidoId(null);
  renderTabla();
  limpiarBusqueda();

  if (proveedorSelect) proveedorSelect.selectedIndex = 0;

  if (entradaBusqueda) {
    entradaBusqueda.disabled    = true;
    entradaBusqueda.placeholder = 'Seleccioná un proveedor para buscar…';
  }

  cerrarDropdown();
}


/* ══════════════════════════════════════════════════════════════
   12. EVENT LISTENERS
══════════════════════════════════════════════════════════════ */

/* ── Cambio de proveedor ─────────────────────────────────────── */
proveedorSelect?.addEventListener('change', () => {
  // Un pedido = un proveedor; si cambia, se resetean los productos
  productosSeleccionados = [];
  pedidoGuardado         = false;
  setPedidoId(null);
  renderTabla();
  limpiarBusqueda();

  if (entradaBusqueda) {
    const valido = proveedorValido(proveedorSelect.value);
    entradaBusqueda.disabled    = !valido;
    entradaBusqueda.placeholder = valido
      ? 'Buscar por código o nombre…'
      : 'Seleccioná un proveedor para buscar…';
    if (valido) entradaBusqueda.focus();
  }
});

/* ── Input búsqueda con debounce ─────────────────────────────── */
entradaBusqueda?.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => buscarProductos().catch(console.error), 220);
});

/* Reabre el dropdown si ya había resultados al volver al input */
entradaBusqueda?.addEventListener('focus', () => {
  if (entradaBusqueda.value.trim() && lastResults.length) abrirDropdown();
});

/* ── Limpiar búsqueda ────────────────────────────────────────── */
btnClearSearch?.addEventListener('click', () => {
  limpiarBusqueda();
  entradaBusqueda?.focus();
});

/* ── Cerrar dropdown al hacer click fuera ────────────────────── */
document.addEventListener('mousedown', e => {
  if (searchWrap && !searchWrap.contains(e.target)) cerrarDropdown();
});

/* ── Clicks en el dropdown (delegación) ─────────────────────── */
resultsList?.addEventListener('click', e => {
  const item = e.target.closest('.pm-result-item');
  if (!item) return;

  const id       = Number(item.dataset.id);
  const producto = lastResults.find(p => Number(p.id) === id);
  if (!producto) return;

  const btn = e.target.closest('button.pm-btn-add');
  if (!btn) return;

  const qtyInput = item.querySelector('.pm-qty-mini');
  const cantidad = qtyInput ? qtyInput.value : 1;

  upsertProducto(producto, cantidad);
});

/* Evita que el foco salte al clickear en inputs/botones del dropdown */
contenedorDropdown?.addEventListener('mousedown', e => {
  if (e.target.closest('input, button, a, select')) return;
  e.preventDefault();
});

/* ── Tabla: cambio de cantidad (en tiempo real) ──────────────── */
tablaBody?.addEventListener('input', e => {
  const input = e.target.closest('.pm-qty-table');
  if (!input) return;

  const tr  = input.closest('tr');
  const id  = tr?.dataset?.id;
  if (!id) return;

  const p = getProductoById(id);
  if (!p) return;

  // Permite campo vacío mientras escribe, sin forzar a "1" de inmediato
  if (input.value === '') return;

  p.cantidad = clampInt(input.value, 1);
  recalcularTotales(p);

  const spanTotal = tr.querySelector('.row-total');
  if (spanTotal) spanTotal.textContent = money(p.precioTotal);

  actualizarTotal();

  // Sincroniza el dropdown si está abierto
  if (contenedorDropdown && !contenedorDropdown.hidden) {
    renderResultados(lastResults);
  }
});

/* Corrige el valor vacío al salir del input */
tablaBody?.addEventListener('change', e => {
  const input = e.target.closest('.pm-qty-table');
  if (!input) return;
  if (input.value === '' || Number(input.value) < 1) input.value = 1;
});

/* ── Tabla: eliminar fila ────────────────────────────────────── */
tablaBody?.addEventListener('click', e => {
  const btn = e.target.closest('button[data-action="remove"]');
  if (!btn) return;

  const id = btn.closest('tr')?.dataset?.id;
  if (id) eliminarProducto(id);
});

/* ── Botones de cabecera ─────────────────────────────────────── */
btnConfirmar?.addEventListener('click', async () => {
  const { ok } = await guardarPedido();
  if (ok) generarPDFInterno();
});

btnPdfProveedor?.addEventListener('click', async () => {
  const { ok } = await guardarPedido();
  if (ok) generarPDFProveedor();
});

btnContinuar?.addEventListener('click', () => {
  if (confirm('¿Limpiar el pedido actual y empezar uno nuevo?')) resetAll();
});


/* ══════════════════════════════════════════════════════════════
   13. INICIALIZACIÓN (preload al cargar en modo edición)
══════════════════════════════════════════════════════════════ */

(function init() {
  // Estado inicial del buscador
  if (entradaBusqueda) {
    entradaBusqueda.disabled    = true;
    entradaBusqueda.placeholder = 'Seleccioná un proveedor para buscar…';
  }
  cerrarDropdown();
  actualizarBtnClear();
  renderTabla();

  // Precargar datos si venimos desde Historial → Editar
  const preload = window.__PEDIDO_PRELOAD__;
  if (!preload || typeof preload !== 'object') return;

  // Restaurar proveedor seleccionado
  if (proveedorSelect && proveedorValido(preload.proveedorId)) {
    proveedorSelect.value = String(preload.proveedorId);
    if (entradaBusqueda) {
      entradaBusqueda.disabled    = false;
      entradaBusqueda.placeholder = 'Buscar por código o nombre…';
    }
  }

  // Restaurar ID del pedido
  if (preload.pedidoId) {
    setPedidoId(preload.pedidoId);
    pedidoGuardado = true; // ya existe en la DB
  }

  // Restaurar ítems del pedido
  if (Array.isArray(preload.items) && preload.items.length) {
    productosSeleccionados = preload.items.map(it => {
      const p = { ...it, cantidad: clampInt(it.cantidad, 1) };
      recalcularTotales(p);
      return p;
    });
    renderTabla();
  }
})();
