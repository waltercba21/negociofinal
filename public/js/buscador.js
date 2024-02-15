import axios from 'axios';

let entrada;
let contenedorProductos;

window.addEventListener('DOMContentLoaded', (e) => {
  entrada = document.querySelector('#entradaBusqueda');
  contenedorProductos = document.querySelector('#contenedor-productos');

  if (!entrada || !contenedorProductos) {
    console.error('No se encontraron los elementos entradaBusqueda y/o contenedor-productos en el DOM');
    return;
  }

  cargarProductos();

  entrada.addEventListener('input', e => {
    const consulta = e.target.value;
    console.log('Consulta:', consulta);
    if (consulta) {
      axios.get(`www.autofaros.com.ar/productos/api/buscar?query=${consulta}`)
      .then(respuesta => {
        console.log('Respuesta:', respuesta);
        if (respuesta.status !== 200) {
          throw new Error(`HTTP error! status: ${respuesta.status}`);
        }
        if (respuesta.data.hasOwnProperty('productos')) {
          console.log('Datos:', respuesta.data.productos);
          mostrarProductos(respuesta.data.productos);
        } else {
          console.error('Respuesta inesperada de la API:', respuesta.data);
        }
      })
      .catch(e => {
        console.error('Hubo un problema con la solicitud axios: ' + e.message);
      });
    } else {
      cargarProductos();
    }
  });
});

async function cargarProductos() {
  try {
    const respuesta = await axios.get('http://www.autofaros.com.ar/productos/api/carrito');
    console.log('Respuesta:', respuesta);
    if (respuesta.status !== 200) {
      throw new Error(`HTTP error! status: ${respuesta.status}`);
    }
    if (respuesta.data.hasOwnProperty('productos')) {
      console.log('Datos:', respuesta.data.productos);
      mostrarProductos(respuesta.data.productos);
    } else {
      console.error('Respuesta inesperada de la API:', respuesta.data);
    }
  } catch (e) {
    console.error('Hubo un problema con la solicitud axios: ' + e.message);
  }
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