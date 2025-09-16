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
// 1) Buscador dinámico + render de resultados
// -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const searchValue = urlParams.get('busqueda');
  const contenedorProductos = document.querySelector('.panel-container');
  const inputBusqueda = document.getElementById('entradaBusqueda');

  if (searchValue && inputBusqueda) {
    inputBusqueda.value = searchValue;
  }

  let timer;
  inputBusqueda?.addEventListener('input', function (e) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const busqueda = e.target.value.trim();
      contenedorProductos.innerHTML = '';

      let productos = [];
      if (!busqueda) return;

      try {
        const respuesta = await fetch('/productos/api/buscar?q=' + encodeURIComponent(busqueda));
        productos = await respuesta.json();
      } catch (err) {
        console.error('Error al buscar productos:', err);
      }

      if (productos.length === 0) {
        contenedorProductos.innerHTML = '<div class="alert alert-warning text-center mt-4">No se encontraron productos para esta búsqueda.</div>';
        return;
      }

      // Render encabezado
      const encabezado = `
        <div class="row fw-bold border-bottom py-2 text-center d-none d-md-flex">
          <div class="col-md-1">✔</div>
          <div class="col-md-2">Categoría</div>
          <div class="col-md-3">Nombre</div>
          <div class="col-md-2">Imagen</div>
          <div class="col-md-2">Precio</div>
          <div class="col-md-2">Acciones</div>
        </div>`;
      contenedorProductos.insertAdjacentHTML('beforeend', encabezado);

      const paginaActual = 1;
      const busquedaActual = document.getElementById('entradaBusqueda')?.value.trim() || '';

      // Render productos
      productos.forEach(producto => {
        const categoria = producto.categoria_nombre || 'Sin categoría';
        let imagenURL = '/img/default.jpg';

        if (producto.imagenes && producto.imagenes.length > 0) {
          const primera = producto.imagenes[0];
          imagenURL = typeof primera === 'string'
            ? `/uploads/productos/${primera}`
            : (primera.imagen ? `/uploads/productos/${primera.imagen}` : imagenURL);
        }

        const precio = producto.precio_venta
          ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}`
          : 'Precio no disponible';

        const action = `/productos/editar/${producto.id}?pagina=${paginaActual}&busqueda=${encodeURIComponent(busquedaActual)}`;

        const fila = `
          <div class="row align-items-center border rounded p-2 mb-2 shadow-sm gx-2">
            <div class="col-12 col-md-1 text-center">
              <input type="checkbox" class="form-check-input product-check" value="${producto.id}" />
            </div>
            <div class="col-12 col-md-2 text-center fw-bold">${categoria}</div>
            <div class="col-12 col-md-3 text-center">${producto.nombre}</div>
            <div class="col-12 col-md-2 text-center">
              <img src="${imagenURL}" alt="Imagen de ${producto.nombre}" class="img-thumbnail" style="max-width: 80px;" />
            </div>
            <div class="col-12 col-md-2 text-center fw-semibold text-success">${precio}</div>
            <div class="col-12 col-md-2 text-center">
              <a href="${action}" class="btn btn-sm btn-warning">
                <i class="fas fa-edit"></i> Editar
              </a>
            </div>
          </div>`;
        contenedorProductos.insertAdjacentHTML('beforeend', fila);
      });

      // Insertar botón Eliminar
      const eliminarHTML = `
        <div class="panel-actions mt-3 text-center">
          <button id="delete-selected" class="btn-delete btn btn-danger" type="button">
            Eliminar seleccionados
          </button>
        </div>`;
      contenedorProductos.insertAdjacentHTML('beforeend', eliminarHTML);

      // ✅ Conectar el botón de esta sección dinámica
      bindDeleteButton(contenedorProductos);

    }, 300);
  });

  // ✅ Conectar el botón del listado inicial (EJS) por si no se usa el buscador
  bindDeleteButton(document);
});

// ----------------------------------------------------------
// 2) Inicializaciones (prefill buscador + carga de productos)
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const dataEl = document.getElementById('productos-data');
  if (dataEl) {
    try {
      window.productosOriginales = JSON.parse(dataEl.textContent);
    } catch (e) {
      console.warn('No se pudo parsear productos-data:', e);
    }
  }

  const inputBusqueda = document.getElementById('entradaBusqueda');
  const busquedaActual = (typeof busquedaActualDesdeServidor !== 'undefined' && busquedaActualDesdeServidor)
    ? JSON.parse(busquedaActualDesdeServidor)
    : (typeof window.busquedaActualDesdeServidor !== 'undefined' ? window.busquedaActualDesdeServidor : '');

  if (busquedaActual && inputBusqueda) {
    inputBusqueda.value = busquedaActual;
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
