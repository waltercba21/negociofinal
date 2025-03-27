document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const searchValue = urlParams.get('busqueda');
  var contenedorProductos = document.getElementById('contenedor-productos');
  var checkAll = document.getElementById('check-all');
  var deleteSelectedButton = document.getElementById('delete-selected');

  if (searchValue) {
    document.getElementById('entradaBusqueda').value = searchValue;
    document.getElementById('entradaBusqueda').dispatchEvent(new Event('input'));
  }
  // Evento para seleccionar/deseleccionar todos los checkboxes
  checkAll.addEventListener('change', function (event) {
    var checks = document.querySelectorAll('.product-check');
    for (var i = 0; i < checks.length; i++) {
      checks[i].checked = event.target.checked;
    }
  });

  contenedorProductos.addEventListener('change', function (event) {
    if (event.target.matches('.product-check')) {
      var checks = document.querySelectorAll('.product-check');
      var allChecked = true;
      for (var i = 0; i < checks.length; i++) {
        if (!checks[i].checked) {
          allChecked = false;
          break;
        }
      }
      checkAll.checked = allChecked;
    }
  });

  deleteSelectedButton.addEventListener('click', function (event) {
    var checks = document.querySelectorAll('.product-check');
    var ids = [];
    for (var i = 0; i < checks.length; i++) {
      if (checks[i].checked) {
        ids.push(checks[i].value);
      }
    }

    if (ids.length > 0) {
      // Mostrar advertencia con SweetAlert2
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
          // Si el usuario confirma, realiza la eliminación
          fetch('/productos/eliminarSeleccionados', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids: ids }),
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.success) {
                Swal.fire(
                  '¡Eliminado!',
                  'Los productos seleccionados han sido eliminados.',
                  'success'
                ).then(() => {
                  location.reload(); // Recargar la página después de la confirmación de eliminación
                });
              } else {
                Swal.fire(
                  'Error',
                  'Hubo un error al eliminar los productos.',
                  'error'
                );
              }
            })
            .catch((error) => {
              Swal.fire(
                'Error',
                'Hubo un error al procesar la solicitud.',
                'error'
              );
              console.error('Error:', error);
            });
        }
      });
    } else {
      Swal.fire(
        'Sin selección',
        'No hay productos seleccionados para eliminar.',
        'info'
      );
    }
  });
});


let timer;
let paginaActual = 1;
document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value;
    const contenedorProductos = document.getElementById('contenedor-productos');
    contenedorProductos.innerHTML = '';
    let productos = [];
    if (!busqueda.trim()) {
      productos = productosOriginales.slice(0, 12);
    } else {
      let url = '/productos/api/buscar?q=' + busqueda;
      const respuesta = await fetch(url);
      const data = await respuesta.json();
      productos = data;
    }
    paginaActual = Math.ceil(productos.length / 10);
    productos.forEach((producto, index) => {
      const imagen =
        producto.imagenes && producto.imagenes.length > 0
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
            <form class="form-inline" method="get" action="/productos/editar/${producto.id}?pagina=${paginaActual}&busqueda=${encodeURIComponent(busqueda)}">
              <button class="btn btn-warning" type="submit">Editar</button>
            </form>
          </div>
        </td>
      `;
      contenedorProductos.appendChild(filaProducto);
    });
  }, 300);
});
