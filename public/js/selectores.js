document.addEventListener('DOMContentLoaded', function() {
  const categoriaSelect = document.getElementById('categoria_id');
  const contenedorProductos = document.getElementById('contenedor-productos');

  categoriaSelect.addEventListener('change', function() {
      const categoriaId = this.value;

      fetch('/productos/api/buscar', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ categoria_id: categoriaId })
      })
      .then(response => response.json())
      .then(data => {
          // Limpiar el contenedor de productos
          contenedorProductos.innerHTML = '';

          // Añadir los nuevos productos al contenedor
          data.productos.forEach(producto => {
              const productoDiv = document.createElement('div');
              productoDiv.classList.add('card');

              // Aquí puedes construir la tarjeta del producto
              // usando los datos del producto

              contenedorProductos.appendChild(productoDiv);
          });
      })
      .catch(error => console.error('Error:', error));
  });
});