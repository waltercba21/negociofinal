$(document).ready(function() {
    // Obtén los elementos del DOM
    const categoriaSelector = $('#categoria_id');
    const marcaSelector = $('#id_marca');
    const modeloSelector = $('#modelo_id');
    const contenedorProductos = $('#contenedor-productos');
    const entrada = $('#entradaBusqueda');
  
    // Función para realizar la solicitud AJAX
    function obtenerProductosFiltrados() {
        const categoria = $('#categoria_id').val();
        const marca = $('#id_marca').val();
        const modelo = $('#modelo_id').val();
        const consulta = $('#entradaBusqueda').val();
  
        console.log(`Realizando solicitud con categoria: ${categoria}, marca: ${marca}, modelo: ${modelo}, consulta: ${consulta}`);
  
        $.get('/productos/api/buscar', { categoria, marca, modelo, query: consulta }, function(data) {
            console.log('Datos recibidos:', data);
            renderizarProductos(data.productos);
        });
    }
  
    // Función para renderizar los productos
    function renderizarProductos(productos) {
        // Limpia el contenedor de productos
        contenedorProductos.empty();

        if (productos.length === 0) {
            contenedorProductos.append('<p>No se encontraron productos que coincidan con los criterios seleccionados.</p>');
            return;
        }
        // Genera el HTML para cada producto
        productos.forEach(producto => {
            console.log('Renderizando producto:', producto);
            const imagenUrl = producto.imagen ? `/uploads/productos/${producto.imagen}` : '/ruta/valida/a/imagen/por/defecto.jpg';
            const productoHTML = `
                <div class="card">
                    <div class="cover__card">
                        <img src="${imagenUrl}" alt="Imagen de ${producto.nombre}">
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
                </div>
            `;

            // Agrega el producto al contenedor
            contenedorProductos.append(productoHTML);
        });
    }

    // Manejadores de eventos para los selectores
    $(document).on('change', '#categoria_id', obtenerProductosFiltrados);
    $(document).on('change', '#id_marca', function() {
        // Limpia el select de modelos
        $('#modelo_id').empty();
  
        // Obtiene los modelos para la marca seleccionada
        $.get(`/productos/modelos/${$(this).val()}`, function(data) {
            console.log('Modelos recibidos:', data);
            // Añade los modelos al select
            data.modelos.forEach(modelo => {
                $('#modelo_id').append(new Option(modelo.nombre, modelo.id));
            });
  
            // Realiza la búsqueda
            obtenerProductosFiltrados();
        });

        // Realiza la búsqueda basada en la marca seleccionada
        obtenerProductosFiltrados();
    });
    modeloSelector.change(obtenerProductosFiltrados);
    entrada.on('input', obtenerProductosFiltrados);
});