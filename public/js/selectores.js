// Función para buscar modelos basados en la marca seleccionada
function buscarModelos() {
    var marcaId = this.value;
    console.log(marcaId); // Log del ID de la marca
    fetch('/productos/modelos/' + marcaId)
        .then(function(response) {
            return response.json();
        })
        .then(function(modelos) {
            console.log(modelos); // Log de los modelos obtenidos
            var modeloSelect = document.getElementById('modelo_id');
            modeloSelect.innerHTML = '';
            modelos.forEach(function(modelo) {
                var option = document.createElement('option');
                option.value = modelo.id;
                option.textContent = modelo.nombre;
                modeloSelect.appendChild(option);
            });
            // Llama a buscarProductos después de que el selector de modelos se haya actualizado
            buscarProductos();
        })
        .catch(function(error) {
            console.error('Error:', error);
        });
}

// Función para realizar la búsqueda y actualizar la vista de productos
function buscarProductos() {
    var categoriaId = document.getElementById('categoria_id').value;
    var marcaId = document.getElementById('id_marca').value;
    var modeloId = document.getElementById('modelo_id').value;

    fetch('/productos/buscar?categoria=' + categoriaId + '&marca=' + marcaId + '&modelo=' + modeloId)
        .then(function(response) {
            return response.json();
        })
        .then(function(productos) {
            var contenedorProductos = document.getElementById('contenedor-productos');
            contenedorProductos.innerHTML = '';
            productos.forEach(function(producto) {
                var tarjetaProducto = document.createElement('div');
                tarjetaProducto.className = 'card';
                tarjetaProducto.innerHTML = `
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
                contenedorProductos.appendChild(tarjetaProducto);
            });
        })
        .catch(function(error) {
            console.error('Error:', error);
        });
}

// Evento de cambio para el selector de marca
document.getElementById('id_marca').addEventListener('change', function() {
    buscarModelos.call(this);
});

// Evento de cambio para los otros selectores
document.getElementById('categoria_id').addEventListener('change', buscarProductos);
document.getElementById('modelo_id').addEventListener('change', buscarProductos);