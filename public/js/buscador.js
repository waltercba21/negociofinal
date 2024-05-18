let entrada;
let contenedorProductosBuscador;
let categoriaSelect;
let marcaSelect;
let modeloSelect;
let ultimaSolicitud = 0;
let timeout = null;
let controller = new AbortController();

document.addEventListener('DOMContentLoaded', function() {
  entrada = document.querySelector('#entradaBusqueda');
  contenedorProductosBuscador = document.querySelector('#contenedor-productos');
  categoriaSelect = document.querySelector('#categoria_id');
  marcaSelect = document.querySelector('#id_marca');
  modeloSelect = document.querySelector('#modelo_id');

  if (!entrada || !contenedorProductosBuscador || !categoriaSelect || !marcaSelect || !modeloSelect) {
    console.error('No se encontraron los elementos necesarios en el DOM');
    return;
  }
  cargarProductos();
  entrada.addEventListener('input', buscarProductos);
  categoriaSelect.addEventListener('change', buscarProductos);
  marcaSelect.addEventListener('change', cargarModelosYBuscarProductos);
  modeloSelect.addEventListener('change', buscarProductos);
});
function buscarProductos() {
  clearTimeout(timeout);
  timeout = setTimeout(function () {
    controller.abort();
    controller = new AbortController();
    const consulta = entrada.value;
    const categoria = categoriaSelect.value;
    const marca = marcaSelect.value;
    const modelo = modeloSelect.value;
    
    let url = 'http://www.autofaros.com.ar/productos/api/buscar';
    let params = new URLSearchParams(); 
    if (consulta) {
      params.append('query', consulta);
    }
    if (categoria) {
      params.append('categoria', categoria);
    }
    if (marca) {
      params.append('marca', marca);
    }
    if (modelo) {
      params.append('modelo', modelo);
    }
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    ultimaSolicitud++;
    const solicitudActual = ultimaSolicitud;
    fetch(url, {mode:'cors', credentials:'include', signal: controller.signal}) 
    .then(response => {
      if (!response.ok) {
        throw new Error('Error HTTP: ' + response.status);
      }
      return response.json();
    })
    .then(datos => {
      if (solicitudActual === ultimaSolicitud) {
        mostrarProductos(datos.productos);
      }
    })
    .catch(error => {
      if (error.name === 'AbortError') {
        console.log('Solicitud abortada');
      } else {
        console.error('Hubo un problema con la solicitud: ' + error);
      }
    });
  }, 500);
}

function cargarProductos() {
  buscarProductos();
}

function mostrarProductos(productos) {
  contenedorProductosBuscador.innerHTML = '';
  if (productos.length === 0) {
    contenedorProductosBuscador.innerHTML = '<p>No se encontraron productos que coincidan con los criterios seleccionados.</p>';
  } else {
    productos.forEach(producto => {
      const imagen = producto.imagen ? `../../uploads/productos/${producto.imagen}` : 'ruta/a/imagen/por/defecto.jpg'; 
      const precio_venta = (producto.precio_venta || producto.precio_venta === 0) ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}` : 'Precio no disponible';
      const tarjetaProducto = `
      <div class="card"> 
      <div class="cover__card">
        <img src="${imagen}" alt="Imagen de ${producto.nombre}">
      </div>
      <div class="titulo-producto">
        <h3 class="nombre">${producto.nombre}</h3>
      </div>
      <hr>
      <div class="categoria-producto">
        <h6 class="categoria">${producto.categoria}</h6>
      </div>
      <hr>
      <div class="precio-producto">
        <p class="precio">${precio_venta}</p>
      </div>
      <div class="cantidad-producto">
        <a href="/productos/carrito/agregar/${producto.id}" class="agregar-carrito">Agregar al carrito</a>
      </div>
    </div>
  `;
      contenedorProductosBuscador.innerHTML += tarjetaProducto;
    });
  }
}