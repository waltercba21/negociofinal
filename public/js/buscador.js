const entrada = document.querySelector('#entradaBusqueda')
const contenedorProductos = document.querySelector('#contenedor-productos')

window.addEventListener('DOMContentLoaded', (e) => {
  cargarProductos()
})

async function cargarProductos() {
  try {
    const respuesta = await fetch('http://autofaros.com.ar/productos/api')
    if (!respuesta.ok) {
      throw new Error(`HTTP error! status: ${respuesta.status}`);
    }
    const datos = await respuesta.json()

    if (Array.isArray(datos)) {
      mostrarProductos(datos)
    } else {
      console.error('Respuesta inesperada de la API:', datos)
    }
  } catch (e) {
    console.error('Hubo un problema con la solicitud fetch: ' + e.message);
  }
}

function mostrarProductos(productos) {
  contenedorProductos.innerHTML = ''
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
`
    contenedorProductos.innerHTML += tarjetaProducto
  })
}

entrada.addEventListener('input', e => {
  const consulta = e.target.value
  if (consulta) {
    fetch(`http://autofaros.com.ar/productos/api/buscar?query=${consulta}`)
      .then(respuesta => {
        if (!respuesta.ok) {
          throw new Error(`HTTP error! status: ${respuesta.status}`);
        }
        return respuesta.json()
      })
      .then(datos => {
        if (Array.isArray(datos)) {
          mostrarProductos(datos)
        } else {
          console.error('Respuesta inesperada de la API:', datos)
        }
      })
      .catch(e => {
        console.error('Hubo un problema con la solicitud fetch: ' + e.message);
      })
  } else {
    cargarProductos()
  }
})