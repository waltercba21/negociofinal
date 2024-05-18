let entrada;
let contenedorProductosBuscador;
let categoriaSelect;
let marcaSelect;
let modeloSelect;
let ultimaSolicitud = 0;
let timeout = null;

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

function cargarModelosYBuscarProductos() {
  // Limpia el select de modelos
  modeloSelect.innerHTML = '';
  
  // Obtiene los modelos para la marca seleccionada
  fetch(`/productos/modelos/${marcaSelect.value}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Error HTTP: ' + response.status);
      }
      return response.json();
    })
    .then(modelos => {
      // Añade los modelos al select
      modelos.forEach(modelo => {
        let option = document.createElement('option');
        option.value = modelo.id;
        option.text = modelo.nombre; 
        modeloSelect.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Hubo un problema con la solicitud: ' + error);
    });

  buscarProductos();
}

function buscarProductos() {
  clearTimeout(timeout);

  timeout = setTimeout(function () {
    const consulta = entrada.value;
    const categoria = categoriaSelect.value;
    const marca = marcaSelect.value;
    const modelo = modeloSelect.value;

    // Si la consulta está vacía, carga todos los productos
    if (!consulta) {
      cargarProductos();
      return;
    }

    let url = 'http://www.autofaros.com.ar/productos/api/buscar';
    let params = new URLSearchParams(); // Crea una nueva instancia de URLSearchParams
    params.append('query', consulta);
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
    fetch(url, {mode:'cors', credentials:'include'})
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
      console.error('Hubo un problema con la solicitud: ' + error);
    });
  }, 500);
}

function cargarProductos() {
  fetch('http://www.autofaros.com.ar/productos/api', {mode:'cors',credentials:'include'})
  .then(response => response.json())
  .then(datos => {
    mostrarProductos(datos.productos);  
  })
  .catch(error => {
    console.error('Hubo un problema con la solicitud: ' + error);
  });
}

function mostrarProductos(productos) {
  contenedorProductosBuscador.innerHTML = '';
  if (productos.length === 0) {
    contenedorProductosBuscador.innerHTML = '<p>No se encontraron productos que coincidan con los criterios seleccionados.</p>';
  } else {
    productos.forEach(producto => {
      const imagen = producto.imagen ? `../../uploads/productos/${producto.imagen}` : 'ruta/a/imagen/por/defecto.jpg'; // Asegúrate de reemplazar 'ruta/a/imagen/por/defecto.jpg' con la ruta a una imagen por defecto
      const precio_venta = producto.precio_venta ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}` : 'Precio no disponible';
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