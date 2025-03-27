document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const searchValue = urlParams.get('busqueda');
  const contenedorProductos = document.getElementById('contenedor-productos');
  const checkAll = document.getElementById('check-all');
  const deleteSelectedButton = document.getElementById('delete-selected');
  const inputBusqueda = document.getElementById('entradaBusqueda');

  if (searchValue) {
    inputBusqueda.value = searchValue;
    inputBusqueda.dispatchEvent(new Event('input'));
  }

  // ✅ Seleccionar/deseleccionar todos los checkboxes
  checkAll.addEventListener('change', function (event) {
    const checks = document.querySelectorAll('.product-check');
    for (let i = 0; i < checks.length; i++) {
      checks[i].checked = event.target.checked;
    }
  });

  // ✅ Control del checkbox individual → checkbox general
  contenedorProductos.addEventListener('change', function (event) {
    if (event.target.matches('.product-check')) {
      const checks = document.querySelectorAll('.product-check');
      let allChecked = true;
      for (let i = 0; i < checks.length; i++) {
        if (!checks[i].checked) {
          allChecked = false;
          break;
        }
      }
      checkAll.checked = allChecked;
    }
  });

  // ✅ Eliminar productos seleccionados
  deleteSelectedButton.addEventListener('click', function () {
    const checks = document.querySelectorAll('.product-check');
    const ids = [];
    for (let i = 0; i < checks.length; i++) {
      if (checks[i].checked) {
        ids.push(checks[i].value);
      }
    }

    if (ids.length > 0) {
      Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción eliminará los productos seleccionados y no se puede deshacer.",
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
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids }),
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.success) {
                Swal.fire(
                  '¡Eliminado!',
                  'Los productos seleccionados han sido eliminados.',
                  'success'
                ).then(() => {
                  location.reload();
                });
              } else {
                Swal.fire('Error', 'Hubo un error al eliminar los productos.', 'error');
              }
            })
            .catch((error) => {
              Swal.fire('Error', 'Hubo un error al procesar la solicitud.', 'error');
              console.error('Error:', error);
            });
        }
      });
    } else {
      Swal.fire('Sin selección', 'No hay productos seleccionados para eliminar.', 'info');
    }
  });

  // ✅ Buscador dinámico
  let timer;
  inputBusqueda.addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const busqueda = e.target.value.trim();
      contenedorProductos.innerHTML = '';
      let productos = [];

      if (!busqueda) {
        productos = productosOriginales.slice(0, 12);
      } else {
        const url = '/productos/api/buscar?q=' + encodeURIComponent(busqueda);
        try {
          const respuesta = await fetch(url);
          productos = await respuesta.json();
        } catch (err) {
          console.error('Error al buscar productos:', err);
        }
      }

      if (productos.length === 0) {
        contenedorProductos.innerHTML = '<tr><td colspan="6">No se encontraron productos para esta búsqueda.</td></tr>';
        return;
      }

      productos.forEach((producto) => {
        const imagen = producto.imagenes && producto.imagenes.length > 0
          ? `/uploads/productos/${producto.imagenes[0].imagen}`
          : '/ruta/valida/a/imagen/por/defecto.jpg';

        const precio_venta = producto.precio_venta
          ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}`
          : 'Precio no disponible';

        const filaProducto = document.createElement('tr');
        filaProducto.innerHTML = `
          <td><input type="checkbox" class="product-check" value="${producto.id}"></td>
          <td>${producto.categoria_nombre}</td>
          <td>${producto.nombre}</td>
          <td><img class="img-thumbnail" width='150' src="${imagen}" alt="Imagen de ${producto.nombre}"></td>
          <td>${precio_venta}</td>
          <td>
            <div class="btn-group-vertical" role="group" aria-label="Vertical button group">
              <form class="form-inline" method="get" action="/productos/editar/${producto.id}?pagina=1&busqueda=${encodeURIComponent(busqueda)}">
                <button class="btn btn-warning" type="submit">Editar</button>
              </form>
            </div>
          </td>
        `;
        contenedorProductos.appendChild(filaProducto);
      });
    }, 300);
  });
});
