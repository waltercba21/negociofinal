document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const searchValue = urlParams.get('busqueda');
  const contenedorProductos = document.getElementById('contenedor-productos');
  const checkAll = document.getElementById('check-all');
  const deleteSelectedButton = document.getElementById('delete-selected');
  const inputBusqueda = document.getElementById('entradaBusqueda');

  console.log('🔎 Valor de "busqueda" desde la URL:', searchValue);

  if (searchValue) {
    inputBusqueda.value = searchValue;
    console.log('📦 productosOriginales:', typeof productosOriginales, productosOriginales?.length);
    inputBusqueda.dispatchEvent(new Event('input'));
    history.replaceState(null, '', `${window.location.pathname}?busqueda=${encodeURIComponent(searchValue)}`);
  }

  checkAll.addEventListener('change', function (event) {
    const checks = document.querySelectorAll('.product-check');
    for (let i = 0; i < checks.length; i++) {
      checks[i].checked = event.target.checked;
    }
  });

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.success) {
                Swal.fire('¡Eliminado!', 'Los productos seleccionados han sido eliminados.', 'success')
                  .then(() => location.reload());
              } else {
                Swal.fire('Error', 'Hubo un error al eliminar los productos.', 'error');
              }
            })
            .catch((error) => {
              Swal.fire('Error', 'Hubo un error al procesar la solicitud.', 'error');
              console.error('❌ Error:', error);
            });
        }
      });
    } else {
      Swal.fire('Sin selección', 'No hay productos seleccionados para eliminar.', 'info');
    }
  });

  let timer;
  inputBusqueda.addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const busqueda = e.target.value.trim();
      contenedorProductos.innerHTML = '';
      let productos = [];

      console.log('🧠 Disparando búsqueda por:', busqueda);

      if (!busqueda) {
        console.log('📄 Sin búsqueda: mostrando productos originales.');
        if (typeof productosOriginales !== 'undefined') {
          productos = productosOriginales.slice(0, 12);
        } else {
          productos = [];
        }
      } else {
        const url = '/productos/api/buscar?q=' + encodeURIComponent(busqueda);
        try {
          const respuesta = await fetch(url);
          productos = await respuesta.json();
          console.log('✅ Productos encontrados por API:', productos.length);
        } catch (err) {
          console.error('❌ Error al buscar productos:', err);
        }
      }

      if (productos.length === 0) {
        contenedorProductos.innerHTML = '<tr><td colspan="6">No se encontraron productos para esta búsqueda.</td></tr>';
        return;
      }

      productos.forEach((producto) => {
        let imagenURL = '/ruta/valida/a/imagen/por/defecto.jpg';
        if (producto.imagenes && producto.imagenes.length > 0) {
          if (typeof producto.imagenes[0] === 'string') {
            imagenURL = `/uploads/productos/${producto.imagenes[0]}`;
          } else if (typeof producto.imagenes[0].imagen === 'string') {
            imagenURL = `/uploads/productos/${producto.imagenes[0].imagen}`;
          }
        }

        const precio_venta = producto.precio_venta
          ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}`
          : 'Precio no disponible';

        const pagina = 1;
        const action = `/productos/editar/${producto.id}?pagina=${pagina}&busqueda=${encodeURIComponent(busqueda || '')}`;

        const filaProducto = document.createElement('tr');
        filaProducto.innerHTML = `
          <td><input type="checkbox" class="product-check" value="${producto.id}"></td>
          <td>${producto.categoria_nombre}</td>
          <td>${producto.nombre}</td>
          <td><img class="img-thumbnail" width="150" src="${imagenURL}" alt="Imagen de ${producto.nombre}"></td>
          <td>${precio_venta}</td>
          <td>
            <div class="btn-group-vertical" role="group" aria-label="Vertical button group">
              <a href="${action}" class="btn btn-warning">Editar</a>
            </div>
          </td>
        `;
        contenedorProductos.appendChild(filaProducto);
      });
    }, 300);
  });
});
