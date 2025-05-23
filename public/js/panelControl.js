document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const searchValue = urlParams.get('busqueda');
  const contenedorProductos = document.querySelector('.panel-container');
  const inputBusqueda = document.getElementById('entradaBusqueda');

  if (searchValue) {
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
