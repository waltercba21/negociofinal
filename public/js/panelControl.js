document.getElementById('contenedor-productos').addEventListener('change', function(event) {
    if (event.target.matches('.product-check')) {
        var checks = document.querySelectorAll('.product-check');
        for (var i = 0; i < checks.length; i++) {
            checks[i].checked = event.target.checked;
        }
    }
});

document.getElementById('contenedor-productos').addEventListener('click', function(event) {
    if (event.target.matches('#delete-selected')) {
        var checks = document.querySelectorAll('.product-check');
        var ids = [];
        for (var i = 0; i < checks.length; i++) {
            if (checks[i].checked) {
                ids.push(checks[i].value);
            }
        }
        fetch('/productos/eliminarSeleccionados', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids: ids }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            } else {
                console.error('Error al eliminar los productos:', data.error);
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    }
});
let timer;
document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
  console.log('Evento input detectado');
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value;
    console.log('Valor de búsqueda:', busqueda);
    const contenedorProductos = document.getElementById('contenedor-productos');
    console.log('Contenedor de productos:', contenedorProductos);
    contenedorProductos.innerHTML = '';
    let productos = [];
    if (!busqueda.trim()) {
      productos = productosOriginales.slice(0, 12);
      console.log('Productos originales:', productos);
    } else {
      let url = '/productos/api/buscar?q=' + busqueda;
      console.log('URL de búsqueda:', url);
      const respuesta = await fetch(url);
      const data = await respuesta.json();
      console.log(data);
      productos = data;     
      console.log('Productos de la búsqueda:', productos);
    }
    productos.forEach((producto, index) => {
        console.log('Procesando producto', index, producto);
        const imagen = producto.imagenes && producto.imagenes.length > 0 ? `/uploads/productos/${producto.imagenes[0].imagen}` : '/ruta/valida/a/imagen/por/defecto.jpg';
        const precio_venta = producto.precio_venta ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}` : 'Precio no disponible';
        console.log('Imagen:', imagen);
        console.log('Precio de venta:', precio_venta);
        const filaProducto = document.createElement('tr');
        filaProducto.innerHTML = `
          <td><input type="checkbox" class="product-check" value="${producto.id}"></td>
          <td>${producto.categoria_nombre}</td>
          <td>${producto.nombre}</td>
          <td><img class="img-thumbnail" width='150' src="${imagen}" alt="Imagen de ${producto.nombre}"></td>
          <td>${precio_venta}</td>
          <td>
            <div class="btn-group-vertical" role="group" aria-label="Vertical button group">
              <form class="form-inline" method="get" action="/productos/editar/${producto.id}?pagina=${paginaActual}">
                <button class="btn btn-warning" type="submit">Editar</button>
              </form>
            </div> 
          </td>
        `;
        contenedorProductos.appendChild(filaProducto);
        console.log('Producto agregado al contenedor:', filaProducto);
      });
    });
  }, 300);
