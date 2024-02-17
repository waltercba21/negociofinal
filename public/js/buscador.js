let entrada;
let contenedorProductos;

document.addEventListener('DOMContentLoaded', function() {
  entrada = document.querySelector('#entradaBusqueda');
  contenedorProductos = document.querySelector('#contenedor-productos');

  if (!entrada || !contenedorProductos) {
    console.error('No se encontraron los elementos entradaBusqueda y/o contenedor-productos en el DOM');
    return;
  }

  cargarProductos();

  entrada.addEventListener('input', function(e) {
    const consulta = e.target.value;
    console.log('Consulta:', consulta);
    if (consulta) {
      fetch(`http://www.autofaros.com.ar/productos/api/buscar?query=${consulta}`, {mode:'cors', credentials:'include'})
      .then(response => response.json())
      .then(datos => {
        console.log('Datos:', datos.productos);
        mostrarProductos(datos.productos);
      })
      .catch(error => {
        console.error('Hubo un problema con la solicitud: ' + error);
      });
    } else {
      cargarProductos();
    }
  });
});

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