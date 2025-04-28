document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const searchValue = urlParams.get('busqueda');
  const contenedorProductos = document.querySelector('.panel-container');
  const checkAll = document.getElementById('check-all');
  const deleteSelectedButton = document.getElementById('delete-selected');
  const inputBusqueda = document.getElementById('entradaBusqueda');

  if (searchValue) {
    inputBusqueda.value = searchValue;
    console.log("🧩 Busqueda detectada en la URL:", searchValue);
  }
  
  checkAll?.addEventListener('change', function (event) {
    const checks = document.querySelectorAll('.product-check');
    checks.forEach(cb => cb.checked = event.target.checked);
  });

  contenedorProductos?.addEventListener('change', function (event) {
    if (event.target.matches('.product-check')) {
      const checks = document.querySelectorAll('.product-check');
      const allChecked = Array.from(checks).every(cb => cb.checked);
      checkAll.checked = allChecked;
    }
  });

  deleteSelectedButton?.addEventListener('click', function () {
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

      const paginaActual = urlParams.get('pagina') || 1;

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

        const action = `/productos/editar/${producto.id}?pagina=${paginaActual}&busqueda=${encodeURIComponent(busqueda)}`;

        console.log("🔗 Editar generado:");
        console.log("🧠 Producto:", producto.nombre);
        console.log("📄 Página actual:", paginaActual);
        console.log("🔎 Búsqueda actual:", busqueda);
        console.log("🔗 URL:", action);

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
              <form method="get" action="${action}">
                <button class="btn btn-sm btn-warning">
                  <i class="fas fa-edit"></i> Editar
                </button>
              </form>
            </div>
          </div>`;
        contenedorProductos.insertAdjacentHTML('beforeend', fila);
      });
    }, 300);
  });
});
