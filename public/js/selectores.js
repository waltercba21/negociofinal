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
                var card = document.createElement('div');
                card.className = 'card';

                var cover = document.createElement('div');
                cover.className = 'cover__card';
                var img = document.createElement('img');
                img.src = "../../uploads/productos/" + producto.imagen;
                img.alt = "Imagen de " + producto.nombre;
                cover.appendChild(img);

                var titulo = document.createElement('h3');
                titulo.className = 'nombre';
                titulo.textContent = producto.nombre;

                var categoria = document.createElement('h6');
                categoria.className = 'categoria';
                categoria.textContent = producto.categoria;

                var descripcion = document.createElement('div');
                descripcion.className = 'descripcion';
                descripcion.style.display = 'none';
                descripcion.textContent = producto.descripcion;

                var precio = document.createElement('p');
                precio.className = 'precio';
                precio.textContent = "$" + producto.precio;

                var cantidad = document.createElement('div');
                cantidad.className = 'cantidad-producto';
                var link = document.createElement('a');
                link.href = "/productos/carrito/agregar/" + producto.id;
                link.className = 'agregar-carrito';
                link.textContent = 'Agregar al carrito';
                cantidad.appendChild(link);

                card.appendChild(cover);
                card.appendChild(titulo);
                card.appendChild(categoria);
                card.appendChild(descripcion);
                card.appendChild(precio);
                card.appendChild(cantidad);

                contenedorProductos.appendChild(card);
            });
        })
        .catch(function(error) {
            console.error('Error:', error);
        });
}