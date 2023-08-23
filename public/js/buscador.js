const input = document.querySelector('#searchInput')
const productosContainer = document.querySelector('#contenedor-productos')

window.addEventListener('DOMContentLoaded', (e) => {
  loadProducts()
})

async function loadProducts() {
  const response = await fetch('http://localhost:3000/productos/api/buscar')
  const data = await response.json()
  console.log('Data from API:', data)
  displayProducts(data.productos)  // Accede a la propiedad 'productos' del objeto
}

function displayProducts(productos) {
  productosContainer.innerHTML = ''
  productos.forEach(producto => {
    const productCard = `
      <div class="card"> 
        <div class="imagen-producto">
          <img src="../../images/${producto.imagen}" alt="Imagen de ${producto.nombre}">
        </div>
        <div class="titulo-producto">
          <h3 class="nombre">${producto.nombre}</h3>
        </div> 
        <div class="precio-producto">
          <p class="precio">$${producto.precio}</p>
        </div>
      </div>
    `
    productosContainer.innerHTML += productCard
  })
}

input.addEventListener('input', e => {
  const query = e.target.value
  if (query) {
    fetch(`http://localhost:3000/productos/api/buscar?query=${query}`)
      .then(response => response.json())
      .then(data => {
        displayProducts(data)
      })
  } else {
    // Aquí puedes decidir qué hacer cuando el campo de entrada está vacío.
    // Por ejemplo, podrías cargar todos los productos o limpiar los resultados de búsqueda.
  }
})