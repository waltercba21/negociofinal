// ================================
// panelControl.js (versión corregida)
// ================================

// ---------------------------------------------
// Helpers: selección, request y binding único
// ---------------------------------------------
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

  // Robustez: aceptar JSON o texto
  const ct = res.headers.get('content-type') || '';
  let payload = null;

  if (ct.includes('application/json')) {
    payload = await res.json().catch(() => null);
  } else {
    const text = await res.text().catch(() => '');
    payload = { success: res.ok, message: text };
  }

  // Consideramos éxito si res.ok y (o no hay payload, o payload.success != false)
  const ok = res.ok && (!payload || payload.success !== false);
  if (!ok) {
    const msg = (payload && (payload.message || payload.error)) || 'Error al eliminar productos.';
    throw new Error(msg);
  }
  return payload || { success: true };
}

// Evitar dobles bindings: usar data-bound
function bindDeleteButton(scope = document) {
  const btn = scope.querySelector('#delete-selected');
  if (!btn || btn.dataset.bound === '1') return;

  btn.dataset.bound = '1';
  btn.addEventListener('click', async () => {
    const ids = getSelectedIds();

    if (ids.length === 0) {
      if (typeof Swal !== 'undefined') {
        Swal.fire('Sin selección', 'No seleccionaste ningún producto.', 'info');
      } else {
        alert('No seleccionaste ningún producto.');
      }
      return;
    }

    // Confirmación
    const confirmar = async () => {
      try {
        btn.disabled = true;
        const res = await requestDelete(ids);
        if (typeof Swal !== 'undefined') {
          await Swal.fire('Eliminados', 'Productos eliminados correctamente.', 'success');
        } else {
          alert('Productos eliminados correctamente.');
        }
        // Refrescamos la vista (mantiene querystring si lo hubiera)
        location.reload();
      } catch (err) {
        console.error(err);
        if (typeof Swal !== 'undefined') {
          Swal.fire('Error', String(err.message || 'Hubo un problema al eliminar.'), 'error');
        } else {
          alert('Error: ' + (err.message || 'Hubo un problema al eliminar.'));
        }
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
// -------------------------------------------------------------------
// 1) Buscador dinámico + render (mismo markup que EJS)
// -------------------------------------------------------------------
function firstImageFilename(prod) {
  const imgs = prod?.imagenes;
  if (!imgs || !Array.isArray(imgs) || imgs.length === 0) return null;

  const first = imgs[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object' && typeof first.imagen === 'string') return first.imagen;

  return null;
}

function formatPrecio(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 'N/A';
  return '$' + Math.trunc(n).toLocaleString('de-DE');
}

function buildEditUrl(id, paginaActual, busquedaActual) {
  const p = Number.isFinite(Number(paginaActual)) && Number(paginaActual) > 0 ? Number(paginaActual) : 1;
  const b = (busquedaActual || '').trim();
  const qs = new URLSearchParams({ pagina: String(p) });
  if (b) qs.set('busqueda', b);
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

    const precio = formatPrecio(p.precio_venta);
    const editUrl = buildEditUrl(p.id, paginaActual, busquedaActual);

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
          <a class="btn-edit" href="${editUrl}">
            <i class="fas fa-edit"></i> Editar
          </a>
        </div>
      </div>
    `;
  }

  html += `
    <div class="panel-actions">
      <button id="delete-selected" class="btn-delete" type="button">Eliminar seleccionados</button>
    </div>
  `;

  contenedor.innerHTML = html;
  bindDeleteButton(contenedor);
}

// -------------------------------------------------------------------
// 1) Buscador dinámico + render (grid del EJS) + paginado en búsqueda
// -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);

  const contenedorProductos = document.querySelector('.panel-container');
  const inputBusqueda = document.getElementById('entradaBusqueda');

  const paginacionEl = document.querySelector('.panel-paginacion');
  const paginacionOriginalHTML = paginacionEl ? paginacionEl.innerHTML : '';

  const paginaActual = Number(urlParams.get('pagina') || 1) || 1;

  const PAGE_SIZE = 30; // igual al server
  let searchResults = [];
  let searchPage = 1;

  // Guardar listado original (JSON embebido por EJS)
  let productosOriginales = [];
  const dataEl = document.getElementById('productos-data');
  if (dataEl) {
    try {
      productosOriginales = JSON.parse(dataEl.textContent) || [];
    } catch (e) {
      console.warn('No se pudo parsear productos-data:', e);
      productosOriginales = [];
    }
  }
  window.productosOriginales = productosOriginales;

  function restoreServerPagination() {
    if (paginacionEl) paginacionEl.innerHTML = paginacionOriginalHTML;
  }

  function firstImageFilename(prod) {
    const imgs = prod?.imagenes;
    if (!imgs || !Array.isArray(imgs) || imgs.length === 0) return null;

    const first = imgs[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && typeof first.imagen === 'string') return first.imagen;
    return null;
  }

  function renderPanelListado(productos, busquedaActual) {
    if (!contenedorProductos) return;

    const lista = Array.isArray(productos) ? productos : [];

    if (lista.length === 0) {
      contenedorProductos.innerHTML = `<div class="panel-alert">No hay productos para mostrar.</div>`;
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
        ? `$${parseInt(p.precio_venta, 10)}`
        : '$0';

      const qs = new URLSearchParams({ pagina: String(paginaActual) });
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
        <button id="delete-selected" class="btn-delete" type="button">Eliminar seleccionados</button>
      </div>
    `;

    contenedorProductos.innerHTML = html;
    bindDeleteButton(contenedorProductos);
  }

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
        searchPage = Number(a.dataset.page) || 1;
        renderSearchPage();
      });
    });
  }

  function renderSearchPage() {
    const busquedaActual = (inputBusqueda?.value || '').trim();
    const start = (searchPage - 1) * PAGE_SIZE;
    const pageItems = searchResults.slice(start, start + PAGE_SIZE);

    renderPanelListado(pageItems, busquedaActual);
    renderSearchPagination();
  }

  // Botón eliminar del listado inicial (server-render)
  bindDeleteButton(document);

  let timer;
  inputBusqueda?.addEventListener('input', (e) => {
    clearTimeout(timer);

    timer = setTimeout(async () => {
      const busqueda = (e.target.value || '').trim();

      // Si está vacío: restaurar listado original + paginación server
      if (!busqueda) {
        restoreServerPagination();
        renderPanelListado(productosOriginales, '');
        return;
      }

      // Modo búsqueda: traer resultados + paginado client-side
      try {
        const resp = await fetch('/productos/api/buscar?q=' + encodeURIComponent(busqueda) + '&limite=1000');
        searchResults = await resp.json();
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

  // Si viene ?busqueda=... en la URL (volver desde Editar), disparar búsqueda
  const searchValue = (urlParams.get('busqueda') || '').trim();
  if (searchValue && inputBusqueda) {
    inputBusqueda.value = searchValue;
    inputBusqueda.dispatchEvent(new Event('input'));
  }
});


// ----------------------------------------------------------
// 3) Lógica del formulario de reportes PDF (validaciones)
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  let form = document.getElementById('form-pdf-stock-proveedor')
           || document.querySelector('form[action="/productos/generarPDFProveedor"]');

  if (!form) return;

  const selProv = document.getElementById('pdf-prov-proveedor') || document.getElementById('proveedor');
  const selCat  = document.getElementById('pdf-prov-categoria') || document.getElementById('categoria');

  const radiosTipo = form.querySelectorAll('input[name="tipo"]');
  const alertBox = document.getElementById('alertas-requeridos') || null;

  function reglas(tipo) {
    return {
      requiereProveedor: ['pedido', 'asignado', 'asignadoPorCategoria', 'categoriaProveedorMasBarato', 'asignadoCompleto'].includes(tipo),
      requiereCategoria: ['porCategoria', 'asignadoPorCategoria', 'categoriaProveedorMasBarato'].includes(tipo),
    };
  }

  function validar() {
    const tipo = form.querySelector('input[name="tipo"]:checked')?.value || 'stock';
    const r = reglas(tipo);
    const faltas = [];

    const provVal = selProv?.value ?? 'TODOS';
    const catVal  = selCat?.value ?? 'TODAS';

    if (r.requiereProveedor && (provVal === 'TODOS' || provVal === '')) {
      faltas.push('Seleccioná un proveedor.');
    }
    if (r.requiereCategoria && (catVal === 'TODAS' || catVal === '')) {
      faltas.push('Seleccioná una categoría.');
    }

    if (alertBox) {
      if (faltas.length) {
        alertBox.textContent = 'Faltan datos: ' + faltas.join(' ');
        alertBox.classList.remove('d-none');
      } else {
        alertBox.classList.add('d-none');
        alertBox.textContent = '';
      }
    }
    return faltas.length === 0;
  }

  radiosTipo.forEach(r => r.addEventListener('change', validar));
  selProv?.addEventListener('change', validar);
  selCat?.addEventListener('change', validar);

  form.addEventListener('submit', (e) => {
    if (!validar()) {
      e.preventDefault();
      e.stopPropagation();
      if (!alertBox && typeof Swal !== 'undefined') {
        Swal.fire('Datos incompletos', 'Revisá proveedor y/o categoría según el tipo elegido.', 'warning');
      }
    }
  });
});
