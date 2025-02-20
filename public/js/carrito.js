document.addEventListener('DOMContentLoaded', () => {
    const alertaCantidad = document.querySelector('.cantidad-alerta');

    // Función para actualizar el globo de notificación (productos únicos en el carrito)
    function actualizarGlobo(cantidad) {
        console.log(`Actualizando globo de notificación con cantidad: ${cantidad}`);
        if (alertaCantidad) {
            if (cantidad > 0) {
                alertaCantidad.textContent = cantidad;
                alertaCantidad.style.display = 'inline-block';
            } else {
                alertaCantidad.style.display = 'none';
            }
        }
    }

    // Función para obtener la cantidad total del carrito (desde el servidor)
    async function obtenerCantidadCarrito() {
        console.log('Obteniendo cantidad total del carrito...');
        try {
            const response = await fetch('/carrito/cantidad');
            if (!response.ok) throw new Error('Error al obtener la cantidad');

            const { cantidadCarrito } = await response.json();
            console.log(`Cantidad obtenida del carrito: ${cantidadCarrito}`);
            actualizarGlobo(cantidadCarrito);
        } catch (error) {
            console.error('Error al obtener la cantidad del carrito:', error);
        }
    }

    // Llamar a la función al cargar la página para actualizar el globo
    obtenerCantidadCarrito();

    // Si estamos en la vista del carrito, manejamos actualizaciones dinámicas
    const carritoContainer = document.getElementById('carrito-productos');
    const totalCarritoElement = document.getElementById('total-carrito');

    if (carritoContainer && totalCarritoElement) {
        console.log('Vista de carrito detectada, manejando actualización de total...');

        // Función para actualizar el total del carrito
        function actualizarTotal() {
            console.log('Actualizando total del carrito...');
            let total = 0;
            let cantidadTotal = 0;
            let cantidadUnica = 0;

            const filas = document.querySelectorAll('table tbody tr');

            if (filas.length === 0) {
                console.log('Carrito vacío, actualizando total a $0.00');
                totalCarritoElement.textContent = '$0.00';
                actualizarGlobo(0);
                return;
            }

            filas.forEach(fila => {
                const subTotalCell = fila.querySelector('td:nth-child(5)');
                const cantidadCell = fila.querySelector('.cantidad-producto');

                if (!subTotalCell || !cantidadCell) return;

                const subTotal = parseFloat(subTotalCell.textContent.replace('$', '').trim()) || 0;
                const cantidad = parseInt(cantidadCell.textContent) || 0;

                total += subTotal;
                cantidadTotal += cantidad;
                cantidadUnica++;  // Contar cada fila como un producto único
            });

            console.log(`Total del carrito calculado: $${total.toFixed(2)}, cantidad total: ${cantidadTotal}, cantidad única: ${cantidadUnica}`);
            totalCarritoElement.textContent = `$${total.toFixed(2)}`;
            actualizarGlobo(cantidadUnica);  // Actualizar el globo con productos únicos
        }

        // Manejar clics en aumentar, disminuir y eliminar
        carritoContainer.addEventListener('click', async (e) => {
            const boton = e.target;

            if (boton.classList.contains('btn-cantidad')) {
                const productoId = boton.getAttribute('data-id');
                const accion = boton.classList.contains('aumentar') ? 'aumentar' : 'disminuir';
                console.log(`Clic en botón de cantidad. Producto ID: ${productoId}, Acción: ${accion}`);
                await actualizarCantidad(productoId, accion, boton);
            }

            if (boton.classList.contains('btn-eliminar')) {
                const productoId = boton.getAttribute('data-id');
                console.log(`Clic en botón de eliminar. Producto ID: ${productoId}`);
                await eliminarProducto(productoId, boton);
            }
        });

        // Función para actualizar la cantidad de un producto
        async function actualizarCantidad(id, accion, boton) {
            console.log(`Actualizando cantidad de producto. ID: ${id}, Acción: ${accion}`);
            try {
                const response = await fetch('/carrito/actualizar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, accion })
                });

                if (!response.ok) throw new Error('Error al actualizar');

                const { nuevaCantidad } = await response.json();
                console.log(`Cantidad actualizada con éxito. Nueva cantidad: ${nuevaCantidad}`);

                const cantidadSpan = boton.parentElement.querySelector('.cantidad-producto');
                if (cantidadSpan) cantidadSpan.textContent = nuevaCantidad;

                // Recalcular el subtotal del producto
                const precio = parseFloat(boton.closest('tr').querySelector('td:nth-child(4)').textContent.replace('$', '')) || 0;
                const totalCell = boton.closest('tr').querySelector('td:nth-child(5)');
                if (totalCell) totalCell.textContent = `$${(nuevaCantidad * precio).toFixed(2)}`;

                // Actualizar el total general y el globo
                actualizarTotal();
                obtenerCantidadCarrito(); // Llamar nuevamente para actualizar el globo
            } catch (error) {
                console.error('Error al actualizar cantidad:', error);
                alert(`Error: ${error.message}`);
            }
        }

        // Función para eliminar un producto
        async function eliminarProducto(id, boton) {
            console.log(`Eliminando producto con ID: ${id}`);
            try {
                const response = await fetch('/carrito/eliminar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });

                if (!response.ok) throw new Error('Error al eliminar');

                const fila = boton.closest('tr');
                if (fila) fila.remove();

                actualizarTotal(); // Actualiza el total y el globo
                obtenerCantidadCarrito(); // Llamar nuevamente para actualizar el globo
            } catch (error) {
                console.error('Error al eliminar producto:', error);
                alert(`Error: ${error.message}`);
            }
        }

        // Inicializa el total en la vista del carrito
        actualizarTotal();
    }
});
