// Variables globales para los selectores
var categoriaSelect, marcaSelect, modeloSelect, contenedorProductos;

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
    var categoriaId = categoriaSelect.value;
    var marcaId = marcaSelect.value;
    var modeloId = modeloSelect.value;

    fetch('/productos/lista?categoria=' + categoriaId + '&marca=' + marcaId + '&modelo=' + modeloId)
        .then(function(response) {
            return response.json();
        })
        .then(function(productos) {
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

// Inicialización de los selectores y el contenedor de productos
document.addEventListener('DOMContentLoaded', function() {
    categoriaSelect = document.getElementById('categoria_id');
    marcaSelect = document.getElementById('id_marca');
    modeloSelect = document.getElementById('modelo_id');
    contenedorProductos = document.getElementById('contenedor-productos');

    // Evento de cambio para el selector de marca
    marcaSelect.addEventListener('change', function() {
        buscarModelos.call(this);
    });

    // Evento de cambio para los otros selectores
    categoriaSelect.addEventListener('change', buscarProductos);
    modeloSelect.addEventListener('change', buscarProductos);
});