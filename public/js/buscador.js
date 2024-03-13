let entrada;
let contenedorProductos;
let categoriaSelect;
let marcaSelect;
let modeloSelect;

document.addEventListener('DOMContentLoaded', function() {
  contenedorProductos = document.querySelector('#contenedor-productos');

  if (!contenedorProductos) {
    console.error('No se encontró el contenedor de productos en el DOM');
    return;
  }

  cargarProductos();

  entrada = document.querySelector('#entradaBusqueda');
  categoriaSelect = document.querySelector('#categoria_id');
  marcaSelect = document.querySelector('#marca_id');
  modeloSelect = document.querySelector('#modelo_id');

  if (entrada && categoriaSelect && marcaSelect && modeloSelect) {
    entrada.addEventListener('input', buscarProductos);
    categoriaSelect.addEventListener('change', buscarProductos);
    marcaSelect.addEventListener('change', buscarProductos);
    modeloSelect.addEventListener('change', buscarProductos);

    marcaSelect.addEventListener('change', function() {
      const marcaId = this.value;
  
      modeloSelect.innerHTML = '<option value="">Selecciona un modelo...</option>';

      if (marcaId) {
        fetch(`http://www.autofaros.com.ar/modelos/${marcaId}`, {mode:'cors', credentials:'include'})
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(datos => {
          if (datos && Array.isArray(datos.modelosPorMarca)) {
            datos.modelosPorMarca.forEach(modelo => {
              const option = document.createElement('option');
              option.value = modelo.id;
              option.textContent = modelo.nombre;
              modeloSelect.appendChild(option);
            });
          } else {
            console.error('La respuesta de la API no tiene la estructura esperada');
          }
        })
        .catch(error => {
          console.error('Hubo un problema con la solicitud: ' + error);
        });
      }
    });
  }
});

function buscarProductos() {
  const consulta = entrada.value;
  const categoria = categoriaSelect.value;
  const marca = marcaSelect.value;
  const modelo = modeloSelect.value;

  let url = 'http://www.autofaros.com.ar/productos/api/buscar?';

  if (consulta) {
    url += `query=${consulta}&`;
  }
  if (categoria) {
    url += `categoria=${categoria}&`;
  }
  if (marca) {
    url += `marca=${marca}&`;
  }
  if (modelo) {
    url += `modelo=${modelo}&`;
  }

  fetch(url, {mode:'cors', credentials:'include'})
  .then(response => response.json())
  .then(datos => {
    console.log('Datos:', datos.productos);
    mostrarProductos(datos.productos);
  })
  .catch(error => {
    console.error('Hubo un problema con la solicitud: ' + error);
  });
}

function cargarProductos() {
  fetch('http://www.autofaros.com.ar/productos/api', {mode:'cors',credentials:'include'})
  .then(response => response.json())
  .then(datos => {
    console.log('Datos:', datos.productos);
    mostrarProductos(datos.productos);
  })
  .catch(error => {
    console.error('Hubo un problema con la solicitud: ' + error);
  });
}

function mostrarProductos(productos) {
  contenedorProductos.innerHTML = '';
  productos.forEach(producto => {
    const tarjetaProducto = `
    <div class="card"> 
    <div class="cover__card">
      <img src="../../images/${producto.imagen}" alt="Imagen de ${producto.nombre}">
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
      <p class="precio">$${producto.precio}</p>
    </div>
    <div class="cantidad-producto">
      <a href="/productos/carrito/agregar/${producto.id}" class="agregar-carrito">Agregar al carrito</a>
    </div>
  </div>
`;
    contenedorProductos.innerHTML += tarjetaProducto;
  });
}