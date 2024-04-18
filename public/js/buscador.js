let entrada;
let contenedorProductosBuscador;
let categoriaSelect;
let marcaSelect;
let modeloSelect;

document.addEventListener('DOMContentLoaded', function() {
  entrada = document.querySelector('#entradaBusqueda');
  contenedorProductosBuscador = document.querySelector('#contenedor-productos');

  if (!entrada || !contenedorProductosBuscador ) {
    console.error('No se encontraron los elementos necesarios en el DOM');
    return;
  }
  cargarProductos();
  entrada.addEventListener('input', buscarProductos);
});
function buscarProductos() {
  const consulta = entrada.value;

  let url = 'http://www.autofaros.com.ar/productos/api/';
  if (consulta) {
    url += `buscar?query=${consulta}`;
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