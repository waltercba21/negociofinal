// Función para realizar la búsqueda y actualizar la vista de productos
function buscarProductos() {
    var categoriaId = document.getElementById('categoria_id').value;
    var marcaId = document.getElementById('id_marca').value;
    var modeloId = document.getElementById('modelo_id').value;
    fetch('/productos/buscar?categoria_id=' + categoriaId + '&marca_id=' + marcaId + '&modelo_id=' + modeloId)
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(function(productos) {
            console.log(productos); 

            // Actualizar la interfaz de usuario con los productos devueltos
            var contenedorProductos = document.getElementById('contenedor-productos');
            contenedorProductos.innerHTML = '';
            productos.forEach(function(producto) {
                var div = document.createElement('div');
                div.className = 'card';
                div.innerHTML = `
                    <div class="cover__card">
                        <img src="../../uploads/productos/${producto.imagen}" alt="Imagen de ${producto.nombre}">
                    </div>
                    <div class="titulo-producto">
                        <h3 class="nombre">${producto.nombre}</h3>
                    </div>
                    <hr>
                    <div class="categoria-producto">
                        <h6 class="categoria">${producto.categoria}</h6>
                    </div>
                    <div class="descripcion" style="display: none;">
                        ${producto.descripcion}
                    </div>
                    <div class="precio-producto">
                        <p class="precio">$${producto.precio}</p>
                    </div>
                    <div class="cantidad-producto">
                        <a href="/productos/carrito/agregar/${producto.id}" class="agregar-carrito">Agregar al carrito</a>
                    </div>
                `;
                contenedorProductos.appendChild(div);
            });
        })
        .catch(function(error) {
            console.error('Error:', error);
        });
}

// Evento de cambio para cada selector
document.getElementById('categoria_id').addEventListener('change', buscarProductos);
document.getElementById('id_marca').addEventListener('change', buscarProductos);
document.getElementById('modelo_id').addEventListener('change', buscarProductos);