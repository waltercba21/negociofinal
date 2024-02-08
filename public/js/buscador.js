const entrada = document.querySelector('#entradaBusqueda')
const contenedorProductos = document.querySelector('#contenedor-productos')

window.addEventListener('DOMContentLoaded', (e) => {
  cargarProductos()
})

async function cargarProductos() {
  const respuesta = await fetch('http://autofaros.com.ar/productos/api')
  const datos = await respuesta.json()

  if (Array.isArray(datos)) {
    mostrarProductos(datos)
  } else {
    console.error('Respuesta inesperada de la API:', datos)
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
      .then(respuesta => respuesta.json())
      .then(datos => {
        if (Array.isArray(datos)) {
          mostrarProductos(datos)
        } else {
          console.error('Respuesta inesperada de la API:', datos)
        }
      })
  } else {
    cargarProductos()
  }
})