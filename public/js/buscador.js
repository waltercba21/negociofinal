let entrada;
let contenedorProductosBuscador;
let categoriaSelect;
let marcaSelect;
let modeloSelect;

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
  marcaSelect.addEventListener('change', function() {
    // Limpia el select de modelos
    modeloSelect.innerHTML = '';
    
    // Obtiene los modelos para la marca seleccionada
    fetch(`http://www.autofaros.com.ar/marcas/${marcaSelect.value}/modelos`, {mode:'cors', credentials:'include'})
      .then(response => {
        if (!response.ok) {
          throw new Error('Error HTTP: ' + response.status);
        }
        return response.json();
      })
      .then(datos => {
        // Añade los modelos al select
        datos.modelos.forEach(modelo => {
          let option = document.createElement('option');
          option.value = modelo.id;
          option.text = modelo.nombre;
          modeloSelect.appendChild(option);
        });
      })
      .catch(error => {
        console.error('Hubo un problema con la solicitud: ' + error);
      });

    // Realiza la búsqueda
    buscarProductos();
  });
  modeloSelect.addEventListener('change', buscarProductos);
});

function buscarProductos() {
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
  fetch(url, {mode:'cors', credentials:'include'})
  .then(response => {
    if (!response.ok) {
      throw new Error('Error HTTP: ' + response.status);
    }
    return response.json();
  })
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
  contenedorProductosBuscador.innerHTML = '';
  productos.forEach(producto => {
    const tarjetaProducto = `
    <div class="card"> 
    <div class="cover__card">
      <img src="../../uploads/productos/${producto.imagen}" alt="Imagen de ${producto.nombre}">
    </div>
    <div class="titulo-producto">
      <h3 class="nombre">${producto.nombre}</h3>
    </div>
    <hr>
    <div class="categoria-producto">
      <h6 class="categoria">${producto.categoria_nombre}</h6>
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
    contenedorProductosBuscador.innerHTML += tarjetaProducto;
  });
}