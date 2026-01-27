let productosSeleccionados = [];
let timer;
let lastResults = [];
let pedidoGuardado = false;

const entradaBusqueda = document.getElementById('entradaBusqueda');
const proveedorSelect = document.querySelector('.proveedores');

const contenedorProductos = document.getElementById('contenedor-productos'); // panel
const resultsList = document.getElementById('pmResultsList'); // lista interna

const tablaBody = document.getElementById('tabla-pedido-body');
const totalPedidoEl = document.getElementById('total-pedido');

const btnConfirmar = document.getElementById('btn-confirmar');
const btnClearSearch = document.getElementById('btnClearSearch');
const searchWrap = document.getElementById('pmSearchWrap');

const btnPdfProveedor = document.getElementById('btn-pdf-proveedor');
const btnContinuar = document.getElementById('btn-continuar');

const pedidoIdInput = document.getElementById('pedido_id');
const pedidoBadge = document.getElementById('pmPedidoBadge');

function fechaPedidoStr() {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

function proveedorValido(val) {
  return /^\d+$/.test(String(val || ''));
}

function clampInt(n, min, max) {
  const x = parseInt(n, 10);
  if (Number.isNaN(x)) return min;
  return Math.max(min, typeof max === 'number' ? Math.min(max, x) : x);
}

function formatearNumero(num) {
  const entero = Math.round(Number(num || 0));
  return entero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function money(num) {
  return `$${formatearNumero(num)}`;
}

function obtenerCodigoPorProveedor(producto) {
  return producto.codigo || '—';
}

function getSelById(id) {
  return productosSeleccionados.find(p => Number(p.id) === Number(id)) || null;
}

function calcularTotalesProducto(p) {
  const costo = Number(p.costo_neto) || 0;
  const cant = Number(p.cantidad) || 1;
  p.precioTotal = costo * cant;
}

function actualizarTotalPedido() {
  const total = productosSeleccionados.reduce((sum, p) => sum + (Number(p.precioTotal) || 0), 0);
  if (totalPedidoEl) totalPedidoEl.innerText = money(total);
}

function renderTabla() {
  if (!tablaBody) return;

  if (!productosSeleccionados.length) {
    tablaBody.innerHTML = `<tr><td colspan="6" class="pm-empty">No hay productos en el pedido.</td></tr>`;
    actualizarTotalPedido();
    return;
  }

  const rowsHtml = productosSeleccionados.map((p) => {
    const code = obtenerCodigoPorProveedor(p);
    const nombre = (p.nombre || '').toString();
    const unit = Number(p.costo_neto) || 0;
    const total = Number(p.precioTotal) || 0;

    return `
      <tr data-id="${p.id}">
        <td class="pm-num">${code}</td>
        <td class="pm-td-name" title="${nombre.replace(/"/g, '&quot;')}">${nombre}</td>
        <td class="pm-right pm-num">${money(unit)}</td>
        <td class="pm-right">
          <input
            class="pm-qty-input"
            type="number"
            min="1"
            step="1"
            inputmode="numeric"
            value="${p.cantidad}"
            aria-label="Cantidad"
          />
        </td>
        <td class="pm-right pm-num"><span class="row-total">${money(total)}</span></td>
        <td class="pm-right">
          <button class="pm-icon-btn" type="button" data-action="remove" aria-label="Eliminar">×</button>
        </td>
      </tr>
    `;
  }).join('');

  tablaBody.innerHTML = rowsHtml;
  actualizarTotalPedido();
}

function showPanel() {
  if (!contenedorProductos) return;
  contenedorProductos.hidden = false;
}

function hidePanel() {
  if (!contenedorProductos) return;
  contenedorProductos.hidden = true;
}

function setClearVisible() {
  if (!btnClearSearch || !entradaBusqueda) return;
  btnClearSearch.style.display = entradaBusqueda.value.trim().length ? 'inline-flex' : 'none';
}

function limpiarResultados() {
  lastResults = [];
  if (resultsList) resultsList.innerHTML = '';
  hidePanel();
}

function limpiarInputYResultados() {
  if (!entradaBusqueda) return;
  entradaBusqueda.value = '';
  setClearVisible();
  limpiarResultados();
}

function imgSrc(producto) {
  const imgs = producto.imagenes;
  if (imgs && Array.isArray(imgs) && imgs.length > 0) {
    const first = imgs[0];
    const name = first && typeof first === 'object' ? first.imagen : first;
    if (name) return `/uploads/productos/${name}`;
  }
  return '/ruta/imagen-defecto.jpg';
}

function renderResultados(productos) {
  if (!resultsList) return;

  lastResults = Array.isArray(productos) ? productos : [];

  if (!lastResults.length) {
    resultsList.innerHTML = `<div class="pm-empty">Sin resultados.</div>`;
    showPanel();
    return;
  }

  const html = lastResults.map((p) => {
    const sel = getSelById(p.id);
    const qtyValue = sel ? sel.cantidad : 1;

    return `
      <div class="pm-item" data-id="${p.id}">
        <img src="${imgSrc(p)}" alt="${(p.nombre || '').toString().replace(/"/g, '&quot;')}">
        <div>
          <div class="pm-item-name">${(p.nombre || '').toString()}</div>
          <div class="pm-item-meta">
            <span class="pm-pill">Cod: ${obtenerCodigoPorProveedor(p)}</span>
            &nbsp;•&nbsp; Unit: ${money(Number(p.costo_neto) || 0)}
            ${sel ? '&nbsp;•&nbsp;<span class="pm-pill">En pedido</span>' : ''}
          </div>
        </div>

        <input
          class="pm-qty"
          type="number"
          min="1"
          step="1"
          inputmode="numeric"
          value="${qtyValue}"
          aria-label="Cantidad para agregar"
        />

        <button
          class="pm-add"
          type="button"
          data-action="${sel ? 'update' : 'add'}"
          data-variant="${sel ? 'update' : 'add'}"
        >${sel ? 'Actualizar' : 'Agregar'}</button>
      </div>
    `;
  }).join('');

  resultsList.innerHTML = html;
  showPanel();
}

function getPedidoId() {
  const v = pedidoIdInput?.value;
  return proveedorValido(v) ? Number(v) : null;
}

function setPedidoId(id) {
  const newId = proveedorValido(id) ? String(id) : '';
  if (pedidoIdInput) pedidoIdInput.value = newId;

  if (pedidoBadge) {
    if (newId) {
      pedidoBadge.hidden = false;
      pedidoBadge.innerText = `Pedido #${newId}`;
    } else {
      pedidoBadge.hidden = true;
    }
  }
}

function enableSearch() {
  if (!entradaBusqueda) return;
  entradaBusqueda.disabled = false;
  entradaBusqueda.placeholder = 'Buscar por código o nombre...';
}

function disableSearch() {
  if (!entradaBusqueda) return;
  entradaBusqueda.disabled = true;
  entradaBusqueda.placeholder = 'Seleccioná un proveedor para buscar...';
}

async function buscarProductos() {
  const proveedor_id = proveedorSelect?.value;
  if (!proveedorValido(proveedor_id) || !entradaBusqueda) return;

  const q = entradaBusqueda.value.trim();
  setClearVisible();

  if (!q) {
    limpiarResultados();
    return;
  }

  const url = `/productos/api/buscar?q=${encodeURIComponent(q)}&proveedor_id=${encodeURIComponent(proveedor_id)}&limite=30`;

  try {
    const resp = await fetch(url);
    const productos = await resp.json().catch(() => []);
    renderResultados(productos || []);
  } catch (e) {
    console.error('Error buscando productos:', e);
    renderResultados([]);
  }
}

function marcarNoGuardado() {
  pedidoGuardado = false;
}

function upsertProductoDesdeResultado(producto, cantidad) {
  const cant = clampInt(cantidad, 1);

  const existente = getSelById(producto.id);
  if (existente) {
    existente.cantidad = cant;
    calcularTotalesProducto(existente);
  } else {
    const nuevo = { ...producto };
    nuevo.cantidad = cant;
    calcularTotalesProducto(nuevo);
    productosSeleccionados.push(nuevo);
  }

  marcarNoGuardado();
  renderTabla();

  if (entradaBusqueda && entradaBusqueda.value.trim()) {
    renderResultados(lastResults);
  }
}

function proveedorNombreSeleccionado() {
  const opt = proveedorSelect?.selectedOptions?.[0];
  if (!opt) return 'Proveedor';

  // Ej: "LAM (Desc: 61.52%)" => "LAM"
  return opt.textContent.replace(/\s*\(Desc:.*\)\s*$/i, '').trim();
}

function construirDatosPedido() {
  const proveedor_id = proveedorSelect?.value;

  if (!proveedorValido(proveedor_id)) {
    alert('Seleccioná un proveedor');
    return null;
  }

  if (productosSeleccionados.length === 0) {
    alert('No hay productos seleccionados');
    return null;
  }

  const total = productosSeleccionados.reduce((sum, p) => sum + (Number(p.precioTotal) || 0), 0);

  return {
    pedido_id: getPedidoId(),
    proveedor_id,
    total,
    productos: productosSeleccionados.map((p) => ({
      id: p.id,
      cantidad: p.cantidad,
      costo_neto: p.costo_neto,
      codigo: p.codigo,
    })),
  };
}

async function guardarPedidoSiHaceFalta() {
  if (pedidoGuardado) return { ok: true, savedNow: false };

  const datosPedido = construirDatosPedido();
  if (!datosPedido) return { ok: false, savedNow: false };

  try {
    const respuesta = await fetch('/productos/guardarPedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosPedido),
    });

    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      alert('Error al guardar el pedido: ' + (data.message || ''));
      return { ok: false, savedNow: false };
    }

    if (data && data.pedido_id) setPedidoId(data.pedido_id);

    pedidoGuardado = true;
    alert('Pedido guardado con éxito');
    return { ok: true, savedNow: true };
  } catch (error) {
    console.error('Error al guardar el pedido:', error);
    alert('Error en la conexión con el servidor');
    return { ok: false, savedNow: false };
  }
}

function resetAll() {
  productosSeleccionados = [];
  lastResults = [];
  pedidoGuardado = false;

  renderTabla();
  limpiarInputYResultados();

  if (proveedorSelect) proveedorSelect.selectedIndex = 0;

  setPedidoId(null);
  disableSearch();
  hidePanel();
}

function generarPDFInterno() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const provName = proveedorNombreSeleccionado();
  const fecha = fechaPedidoStr();

  doc.setFontSize(16);
  doc.text(`PEDIDO INTERNO - ${provName}`, 10, 12);

  doc.setFontSize(11);
  doc.text(`Fecha: ${fecha}`, 10, 20);

  const headers = [['Código', 'Producto', 'Costo Neto', 'Cantidad', 'Precio Total']];
  const rows = productosSeleccionados.map((p) => [
    obtenerCodigoPorProveedor(p),
    p.nombre,
    money(Number(p.costo_neto) || 0),
    String(p.cantidad),
    money(Number(p.precioTotal) || 0),
  ]);

  doc.autoTable({ head: headers, body: rows, startY: 26 });

  const total = productosSeleccionados.reduce((sum, p) => sum + (Number(p.precioTotal) || 0), 0);
  doc.setFontSize(12);
  doc.text(`Total Pedido: ${money(total)}`, 10, doc.previousAutoTable.finalY + 10);

  doc.save('pedido_confirmado.pdf');
}

function generarPDFProveedor() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const provName = proveedorNombreSeleccionado();
  const fecha = fechaPedidoStr();

  doc.setFontSize(16);
  doc.text(`PEDIDO PARA "${provName}"`, 10, 12);

  doc.setFontSize(11);
  doc.text(`Fecha: ${fecha}`, 10, 20);

  const headers = [['Código', 'Producto', 'Cantidad']];
  const rows = productosSeleccionados.map((p) => [
    obtenerCodigoPorProveedor(p),
    p.nombre,
    String(p.cantidad),
  ]);

  doc.autoTable({
    head: headers,
    body: rows,
    startY: 26,
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 125 },
      2: { cellWidth: 25, halign: 'right' },
    },
  });

  doc.save('pedido_para_proveedor.pdf');
}

function getPreload() {
  if (window.__PEDIDO_PRELOAD__ && typeof window.__PEDIDO_PRELOAD__ === 'object') {
    return window.__PEDIDO_PRELOAD__;
  }
  const el = document.getElementById('pedido-preload');
  if (!el) return null;
  try {
    return JSON.parse(el.textContent || '');
  } catch {
    return null;
  }
}

// --- Estado inicial
disableSearch();
hidePanel();
setClearVisible();
renderTabla();

// --- Preload (editar pedido desde historial)
(function aplicarPreloadEdicion() {
  const preload = getPreload();
  if (!preload || !preload.pedidoId) {
    // si el EJS marcó proveedor selected, habilitar búsqueda
    if (proveedorValido(proveedorSelect?.value)) enableSearch();
    return;
  }

  setPedidoId(preload.pedidoId);

  if (proveedorValido(preload.proveedorId) && proveedorSelect) {
    proveedorSelect.value = String(preload.proveedorId);
    enableSearch();
  } else {
    disableSearch();
  }

  if (Array.isArray(preload.items) && preload.items.length) {
    productosSeleccionados = preload.items.map((it) => {
      const p = { ...it };
      p.cantidad = clampInt(p.cantidad, 1);
      calcularTotalesProducto(p);
      return p;
    });
    renderTabla();
  }

  // ya existe en DB al entrar por "Editar"
  pedidoGuardado = true;
})();

// --- Proveedor change: resetea productos (1 proveedor por pedido)
proveedorSelect?.addEventListener('change', () => {
  productosSeleccionados = [];
  renderTabla();
  limpiarInputYResultados();
  marcarNoGuardado();

  if (proveedorValido(proveedorSelect.value)) {
    enableSearch();
    entradaBusqueda.focus();
  } else {
    disableSearch();
  }
});

// --- Input búsqueda con debounce
entradaBusqueda?.addEventListener('input', () => {
  setClearVisible();
  clearTimeout(timer);
  timer = setTimeout(() => {
    buscarProductos().catch(console.error);
  }, 220);
});

entradaBusqueda?.addEventListener('focus', () => {
  if (entradaBusqueda.value.trim() && (lastResults.length || (resultsList?.innerHTML || '').trim().length)) showPanel();
});

btnClearSearch?.addEventListener('click', () => {
  limpiarInputYResultados();
  entradaBusqueda?.focus();
});

// --- Cerrar panel al click fuera (sin borrar lo escrito)
document.addEventListener('mousedown', (e) => {
  if (!searchWrap) return;
  if (!searchWrap.contains(e.target)) {
    hidePanel();
  }
});

// --- Click en resultados (delegación)
resultsList?.addEventListener('click', (e) => {
  const item = e.target.closest('.pm-item');
  if (!item) return;

  const id = Number(item.dataset.id);
  const producto = lastResults.find(p => Number(p.id) === id);
  if (!producto) return;

  const btn = e.target.closest('button.pm-add');
  if (!btn) return;

  const qtyInput = item.querySelector('.pm-qty');
  const cantidad = qtyInput ? qtyInput.value : 1;

  upsertProductoDesdeResultado(producto, cantidad);
});

// ✅ No bloquear foco: permite escribir en inputs y clickear botones
contenedorProductos?.addEventListener('mousedown', (e) => {
  if (e.target.closest('input, button, a, select, textarea, label')) return;
  e.preventDefault();
});

// --- Tabla: cambiar cantidad escribiendo (sin re-render completo)
tablaBody?.addEventListener('input', (e) => {
  const input = e.target.closest('.pm-qty-input');
  if (!input) return;

  const tr = input.closest('tr');
  const id = tr?.dataset?.id;
  if (!id) return;

  const p = getSelById(id);
  if (!p) return;

  const val = input.value;
  if (val === '') return;

  p.cantidad = clampInt(val, 1);
  calcularTotalesProducto(p);

  const rowTotal = tr.querySelector('.row-total');
  if (rowTotal) rowTotal.textContent = money(p.precioTotal);
  actualizarTotalPedido();

  marcarNoGuardado();
  if (!contenedorProductos?.hidden) renderResultados(lastResults);
});

tablaBody?.addEventListener('change', (e) => {
  const input = e.target.closest('.pm-qty-input');
  if (!input) return;
  if (input.value === '' || Number(input.value) < 1) input.value = 1;
});

tablaBody?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="remove"]');
  if (!btn) return;

  const tr = btn.closest('tr');
  const id = tr?.dataset?.id;
  if (!id) return;

  productosSeleccionados = productosSeleccionados.filter(p => Number(p.id) !== Number(id));
  renderTabla();
  marcarNoGuardado();

  if (!contenedorProductos?.hidden) renderResultados(lastResults);
});

// --- Botones PDF + reset
btnConfirmar?.addEventListener('click', async () => {
  const { ok } = await guardarPedidoSiHaceFalta();
  if (!ok) return;
  generarPDFInterno();
});

btnPdfProveedor?.addEventListener('click', async () => {
  const { ok } = await guardarPedidoSiHaceFalta();
  if (!ok) return;
  generarPDFProveedor();
});

btnContinuar?.addEventListener('click', () => {
  resetAll();
});
