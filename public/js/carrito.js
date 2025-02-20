document.addEventListener('DOMContentLoaded', () => {
    const carritoContainer = document.getElementById('carrito-productos');
    const totalCarritoElement = document.getElementById('total-carrito');
    const alertaCantidad = document.querySelector('.cantidad-alerta');

    // Función para actualizar el total del carrito
    function actualizarTotal() {
        let total = 0;
        let cantidadTotal = 0;

        const filas = document.querySelectorAll('table tbody tr');

        if (filas.length === 0) {
            totalCarritoElement.textContent = '$0.00';
            actualizarGlobo(0); // Si no hay productos, mostrar 0 en el globo
            return;
        }

        filas.forEach(fila => {
            const subTotalCell = fila.querySelector('td:nth-child(5)');
            const cantidadCell = fila.querySelector('.cantidad-producto');

            const subTotal = parseFloat(subTotalCell.textContent.replace('$', '').trim()) || 0;
            const cantidad = parseInt(cantidadCell.textContent) || 0;

            total += subTotal;
            cantidadTotal += cantidad; // Sumar la cantidad total de productos
        });

        totalCarritoElement.textContent = `$${total.toFixed(2)}`;
        actualizarGlobo(cantidadTotal);
    }

    // Función para actualizar el globo de notificación
    function actualizarGlobo(cantidad) {
        if (cantidad > 0) {
            alertaCantidad.textContent = cantidad;
            alertaCantidad.style.display = 'inline-block';
        } else {
            alertaCantidad.style.display = 'none';
        }
    }

    carritoContainer.addEventListener('click', async (e) => {
        const boton = e.target;

        // Actualizar cantidad (aumentar o disminuir)
        if (boton.classList.contains('btn-cantidad')) {
            const productoId = boton.getAttribute('data-id');
            const accion = boton.classList.contains('aumentar') ? 'aumentar' : 'disminuir';
            await actualizarCantidad(productoId, accion, boton);
        }

        // Eliminar producto
        if (boton.classList.contains('btn-eliminar')) {
            const productoId = boton.getAttribute('data-id');
            await eliminarProducto(productoId, boton);
        }
    });

    // Función para actualizar la cantidad dinámicamente
    async function actualizarCantidad(id, accion, boton) {
        try {
            if (!id) throw new Error('ID del producto no válido');

            const response = await fetch(`/carrito/actualizar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, accion })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error desconocido al actualizar');
            }

            const { nuevaCantidad } = await response.json();

            // Actualizar cantidad en el DOM
            const cantidadSpan = boton.parentElement.querySelector('.cantidad-producto');
            cantidadSpan.textContent = nuevaCantidad;

            // Actualizar el subtotal dinámicamente
            const precio = parseFloat(boton.closest('tr').querySelector('td:nth-child(4)').textContent.replace('$', '')) || 0;
            const totalCell = boton.closest('tr').querySelector('td:nth-child(5)');
            totalCell.textContent = `$${(nuevaCantidad * precio).toFixed(2)}`;

            // Actualizar el total del carrito y el globo
            actualizarTotal();

        } catch (error) {
            console.error('Error al actualizar cantidad:', error);
            alert(`Hubo un problema al actualizar el carrito: ${error.message}`);
        }
    }

    // Función para eliminar un producto dinámicamente
    async function eliminarProducto(id, boton) {
        try {
            if (!id) throw new Error('ID del producto no válido');

            const response = await fetch(`/carrito/eliminar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error desconocido al eliminar');
            }

            const { mensaje } = await response.json();

            // Eliminar la fila del producto
            const fila = boton.closest('tr');
            if (fila) fila.remove();

            // Actualizar el total del carrito y el globo
            actualizarTotal();

        } catch (error) {
            console.error('Error al eliminar producto:', error);
            alert(`Hubo un problema al eliminar el producto: ${error.message}`);
        }
    }

    // Inicializa el total al cargar la página
    actualizarTotal();
});
