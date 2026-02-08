// ================================
// panelControl.js (UNIFICADO)
// ================================

// -----------------------------
// Helpers: selección + delete
// -----------------------------
function getSelectedIds() {
  return Array.from(document.querySelectorAll('.product-check'))
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

async function requestDelete(ids) {
  const res = await fetch('/productos/eliminarSeleccionados', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });

  const ct = res.headers.get('content-type') || '';
  let payload = null;

  if (ct.includes('application/json')) {
    payload = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => '');
    payload = { success: res.ok, message: text };
  }

  const ok = res.ok && (!payload || payload.success !== false);
  if (!ok) {
    const msg = (payload && (payload.message || payload.error)) || 'Error al eliminar productos.';
    throw new Error(msg);
  }

  return payload || { success: true };
}

function bindDeleteButton(scope = document) {
  const btn = scope.querySelector('#delete-selected');
  if (!btn || btn.dataset.bound === '1') return;

  btn.dataset.bound = '1';
  btn.addEventListener('click', async () => {
    const ids = getSelectedIds();

    if (ids.length === 0) {
      if (typeof Swal !== 'undefined') Swal.fire('Sin selección', 'No seleccionaste ningún producto.', 'info');
      else alert('No seleccionaste ningún producto.');
      return;
    }

    const confirmar = async () => {
      try {
        btn.disabled = true;
        await requestDelete(ids);
        if (typeof Swal !== 'undefined') await Swal.fire('Eliminados', 'Productos eliminados correctamente.', 'success');
        else alert('Productos eliminados correctamente.');
        location.reload();
      } catch (err) {
        console.error(err);
        if (typeof Swal !== 'undefined') Swal.fire('Error', String(err.message || 'Hubo un problema al eliminar.'), 'error');
        else alert('Error: ' + (err.message || 'Hubo un problema al eliminar.'));
      } finally {
        btn.disabled = false;
      }
    };

    if (typeof Swal !== 'undefined') {
      const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: 'Esta acción eliminará los productos seleccionados.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });
      if (result.isConfirmed) await confirmar();
    } else {
      if (confirm('¿Eliminar los productos seleccionados?')) await confirmar();
    }
  });
}

// -----------------------------
// Helpers: render cards
// -----------------------------
function firstImageFilename(producto) {
  const imgs = producto?.imagenes;
  if (!imgs) return null;

  // Si vienen como strings: ["a.jpg", "b.jpg"]
  if (Array.isArray(imgs) && typeof imgs[0] === 'string') return imgs[0] || null;

  // Si vienen como objetos: [{imagen:"a.jpg"}, ...]
  if (Array.isArray(imgs) && typeof imgs[0] === 'object') return imgs[0]?.imagen || null;

  // Si viene una sola
  if (typeof imgs === 'string') return imgs;

  return null;
}

function formatPrecio(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('es-AR');
}

function buildEditUrl(id, paginaActual, busquedaActual) {
  const qs = new URLSearchParams();
  if (paginaActual) qs.set('pagina', String(paginaActual));
  if (busquedaActual) qs.set('busqueda', busquedaActual);
  return `/productos/editar/${id}?${qs.toString()}`;
}

function renderPanelListado(contenedor, productos, { paginaActual = 1, busquedaActual = '' } = {}) {
  if (!contenedor) return;

  const lista = Array.isArray(productos) ? productos : [];

  if (lista.length === 0) {
    contenedor.innerHTML = `<div class="panel-alert">No hay productos para mostrar.</div>`;
    return;
  }

  let html = `
    <div class="panel-header">
      <div class="panel-col panel-col-small">✔</div>
      <div class="panel-col">Categoría</div>
      <div class="panel-col">Nombre</div>
      <div class="panel-col">Imagen</div>
      <div class="panel-col">Precio</div>
      <div class="panel-col">Acciones</div>
    </div>
  `;

  for (const p of lista) {
    const categoria = p.categoria || p.categoria_nombre || 'Sin categoría';
    const img = firstImageFilename(p);

    const imgHtml = img
      ? `<div class="panel-image-container">
           <img src="/uploads/productos/${img}" alt="Imagen de ${p.nombre || ''}" class="product-image" />
         </div>`
      : `<div class="panel-image-container"><span class="no-image">(Sin imagen)</span></div>`;

    const precio = (p.precio_venta != null && p.precio_venta !== '')
      ? '$' + parseInt(p.precio_venta, 10)
      : '$0';

    const qs = new URLSearchParams({ pagina: String(paginaActual || 1) });
    if (busquedaActual) qs.set('busqueda', busquedaActual);
    const action = `/productos/editar/${p.id}?${qs.toString()}`;

    html += `
      <div class="panel-row">
        <div class="panel-col panel-col-small">
          <input type="checkbox" class="product-check" value="${p.id}" />
        </div>

        <div class="panel-text-small-bold">${categoria}</div>
        <div class="panel-text-small-bold">${p.nombre || '-'}</div>

        <div class="panel-col">${imgHtml}</div>

        <div class="panel-col panel-price">${precio}</div>

        <div class="panel-col">
          <form method="get" action="${action}">
            <button class="btn-edit" type="submit">
              <i class="fas fa-edit"></i> Editar
            </button>
          </form>
        </div>
      </div>
    `;
  }

  html += `
    <div class="panel-actions">
      <button id="delete-selected" class="btn-delete" type="button">
        Eliminar seleccionados
      </button>
    </div>
  `;

  contenedor.innerHTML = html;
  bindDeleteButton(contenedor);
}


// -----------------------------
// Search con paginación propia
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
  const contenedorProductos = document.querySelector('.panel-container');
  const inputBusqueda = document.getElementById('entradaBusqueda');
  const paginacionEl = document.querySelector('.panel-paginacion');

  if (!contenedorProductos) return;

  const urlParams = new URLSearchParams(window.location.search);

  // Guardar paginación original (server-render)
  const paginacionOriginalHTML = paginacionEl ? paginacionEl.innerHTML : '';

  function restoreServerPagination() {
    if (paginacionEl) paginacionEl.innerHTML = paginacionOriginalHTML;
  }

  // Guardar listado original (para restaurar al borrar búsqueda)
  const dataEl = document.getElementById('productos-data');
  let productosOriginales = [];
  if (dataEl) {
    try {
      productosOriginales = JSON.parse(dataEl.textContent);
    } catch (e) {
      console.warn('No se pudo parsear productos-data:', e);
      productosOriginales = [];
    }
  }

  const paginaActual = Number(urlParams.get('pagina') || 1) || 1;

  // --- Modo búsqueda (paginación propia) ---
  const PAGE_SIZE = 30;
  let searchResults = [];
  let searchPage = 1;

function renderSearchPagination() {
  if (!paginacionEl) return;

  const totalPages = Math.ceil(searchResults.length / PAGE_SIZE);

  if (totalPages <= 1) {
    paginacionEl.innerHTML = '';
    return;
  }

  const prev = (searchPage > 1)
    ? `<a href="#" data-page="${searchPage - 1}">&laquo;</a>`
    : `<span>&laquo;</span>`;

  const next = (searchPage < totalPages)
    ? `<a href="#" data-page="${searchPage + 1}">&raquo;</a>`
    : `<span>&raquo;</span>`;

  paginacionEl.innerHTML = `
    ${prev}
    <span class="active">${searchPage}</span>
    <span>de ${totalPages}</span>
    ${next}
  `;

  paginacionEl.querySelectorAll('a[data-page]').forEach(a => {
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const p = Number(a.dataset.page);
      if (!Number.isFinite(p) || p < 1 || p > totalPages) return;
      searchPage = p;
      renderSearchPage();
    });
  });
}

  function renderSearchPage() {
    const busquedaActual = (inputBusqueda?.value || '').trim();
    const start = (searchPage - 1) * PAGE_SIZE;
    const pageItems = searchResults.slice(start, start + PAGE_SIZE);

    renderPanelListado(contenedorProductos, pageItems, {
      paginaActual,
      busquedaActual
    });

    renderSearchPagination();
  }

  // Bind delete para el listado inicial server (por si existe botón en HTML)
  bindDeleteButton(document);

  let timer;
  inputBusqueda?.addEventListener('input', function (e) {
    clearTimeout(timer);

    timer = setTimeout(async () => {
      const busqueda = (e.target.value || '').trim();

      if (!busqueda) {
        restoreServerPagination();
        renderPanelListado(contenedorProductos, productosOriginales, {
          paginaActual,
          busquedaActual: ''
        });
        return;
      }

      try {
        const respuesta = await fetch('/productos/api/buscar?q=' + encodeURIComponent(busqueda) + '&limite=1000');
        searchResults = await respuesta.json();
      } catch (err) {
        console.error('Error al buscar productos:', err);
        searchResults = [];
      }

      if (!Array.isArray(searchResults) || searchResults.length === 0) {
        if (paginacionEl) paginacionEl.innerHTML = '';
        contenedorProductos.innerHTML = `<div class="panel-alert">No se encontraron productos para esta búsqueda.</div>`;
        return;
      }

      searchPage = 1;
      renderSearchPage();

    }, 300);
  });

  // Si viene ?busqueda=... (volver desde Editar), disparar búsqueda
  const searchValue = (urlParams.get('busqueda') || '').trim();
  if (searchValue && inputBusqueda) {
    inputBusqueda.value = searchValue;
    inputBusqueda.dispatchEvent(new Event('input'));
  }
});

// -----------------------------
// Validación PDF (si existe)
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-pdf-stock-proveedor');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    const requeridos = Array.from(form.querySelectorAll('.alertas-requeridos'));
    const faltan = requeridos.some(el => !String(el.value || '').trim());

    if (faltan) {
      e.preventDefault();
      if (typeof Swal !== 'undefined') Swal.fire('Faltan datos', 'Completá los campos requeridos para generar el PDF.', 'warning');
      else alert('Completá los campos requeridos para generar el PDF.');
    }
  });
});
