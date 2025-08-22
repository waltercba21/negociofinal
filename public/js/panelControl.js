// ================================
// panelControl.js
// ================================

// -------------------------------------------------------------------
// 1) Buscador dinámico + render de resultados + eliminar seleccionados
//    (Código existente, conservado tal cual y con mínimos comentarios)
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
          <button id="delete-selected" class="btn-delete btn btn-danger">
            Eliminar seleccionados
          </button>
        </div>`;
      contenedorProductos.insertAdjacentHTML('beforeend', eliminarHTML);

      // Asignar evento al nuevo botón
      document.getElementById('delete-selected')?.addEventListener('click', function () {
        const checks = document.querySelectorAll('.product-check');
        const ids = Array.from(checks).filter(cb => cb.checked).map(cb => cb.value);

        if (ids.length === 0) {
          Swal.fire('Sin selección', 'No seleccionaste ningún producto.', 'info');
          return;
        }

        Swal.fire({
          title: '¿Estás seguro?',
          text: "Esta acción eliminará los productos seleccionados.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'Cancelar'
        }).then((result) => {
          if (result.isConfirmed) {
            fetch('/productos/eliminarSeleccionados', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids })
            })
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  Swal.fire('Eliminados', 'Productos eliminados correctamente.', 'success')
                    .then(() => location.reload());
                } else {
                  throw new Error(data.message || 'Error al eliminar productos.');
                }
              })
              .catch(err => {
                console.error(err);
                Swal.fire('Error', 'Hubo un problema al eliminar.', 'error');
              });
          }
        });
      });

    }, 300);
  });
});

// ----------------------------------------------------------
// 2) Inicializaciones que estaban inline en panelControl.ejs
//    - Prefill del buscador con busquedaActual
//    - Carga de productosOriginales desde <script id="productos-data">
//    Las movemos acá para no mezclar lógica en la vista.
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Lee la data embebida del servidor si existe
  const dataEl = document.getElementById('productos-data');
  if (dataEl) {
    try {
      // Exponer como global (si lo estabas usando así) o mantener en este scope
      window.productosOriginales = JSON.parse(dataEl.textContent);
    } catch (e) {
      console.warn('No se pudo parsear productos-data:', e);
    }
  }

  // Prefill del buscador (usa variables globales si el EJS las deja)
  const inputBusqueda = document.getElementById('entradaBusqueda');
  // Estas variables se definen en el EJS; si no existen, no pasa nada.
  const busquedaActual = (typeof busquedaActualDesdeServidor !== 'undefined' && busquedaActualDesdeServidor)
    ? JSON.parse(busquedaActualDesdeServidor)
    : (typeof window.busquedaActualDesdeServidor !== 'undefined' ? window.busquedaActualDesdeServidor : '');

  if (busquedaActual && inputBusqueda) {
    inputBusqueda.value = busquedaActual;
    inputBusqueda.dispatchEvent(new Event('input'));
  }
});

// ----------------------------------------------------------
// 3) NUEVO: Lógica del formulario de reportes PDF (Stock/Proveedor)
//    - Valida requisitos según el "tipo" elegido
//    - Previene envíos sin proveedor/categoría cuando son obligatorios
//    - Compatible con el bloque HTML nuevo (ids con prefijo "pdf-")
//      y también con el bloque actual (ids genéricos "proveedor"/"categoria")
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Intenta primero con los IDs "nuevos" del contenedor que te pasé
  let form = document.getElementById('form-pdf-stock-proveedor')
           || document.querySelector('form[action="/productos/generarPDFProveedor"]');

  if (!form) return; // no hay formulario de PDFs en esta vista

  // Selects (prefijo nuevo o fallback a ids antiguos)
  const selProv = document.getElementById('pdf-prov-proveedor') || document.getElementById('proveedor');
  const selCat  = document.getElementById('pdf-prov-categoria') || document.getElementById('categoria');

  const radiosTipo = form.querySelectorAll('input[name="tipo"]');

  // Caja de alerta si existe; si no, usamos SweetAlert2 para avisar
  const alertBox = document.getElementById('alertas-requeridos') || null;

  // Reglas por tipo
  function reglas(tipo) {
    return {
      requiereProveedor: ['pedido', 'asignado', 'asignadoPorCategoria', 'categoriaProveedorMasBarato', 'asignadoCompleto'].includes(tipo),
      requiereCategoria: ['porCategoria', 'asignadoPorCategoria', 'categoriaProveedorMasBarato'].includes(tipo),
      // Si usás el contenedor nuevo, podrías ocultar categoría en ciertos tipos por UX (lo dejamos solo validado)
    };
  }

  // Valida al vuelo
  function validar() {
    const tipo = form.querySelector('input[name="tipo"]:checked')?.value || 'stock';
    const r = reglas(tipo);
    const faltas = [];

    // Normalizamos valores "Todos/Todas"
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

  // Eventos
  radiosTipo.forEach(r => r.addEventListener('change', validar));
  selProv?.addEventListener('change', validar);
  selCat?.addEventListener('change', validar);

  // Validación final en submit
  form.addEventListener('submit', (e) => {
    if (!validar()) {
      e.preventDefault();
      e.stopPropagation();
      // Si no hay alertBox en el HTML, usamos SweetAlert para avisar
      if (!alertBox && typeof Swal !== 'undefined') {
        Swal.fire('Datos incompletos', 'Revisá proveedor y/o categoría según el tipo elegido.', 'warning');
      }
    }
  });
});
