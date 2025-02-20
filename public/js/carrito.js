document.addEventListener('DOMContentLoaded', () => {
    const carritoContainer = document.getElementById('carrito-productos');
    const totalCarritoElement = document.getElementById('total-carrito');

    // Función para actualizar el total del carrito
    function actualizarTotal() {
        let total = 0;
        const filas = document.querySelectorAll('table tbody tr');

        // Si no hay productos, establecer el total en $0.00
        if (filas.length === 0) {
            totalCarritoElement.textContent = '$0.00';
            return;
        }

        filas.forEach(fila => {
            const subTotalCell = fila.querySelector('td:nth-child(5)');
            if (subTotalCell) {
                const subTotal = parseFloat(subTotalCell.textContent.replace('$', '').trim()) || 0;
                total += subTotal;
            }
        });

        totalCarritoElement.textContent = `$${total.toFixed(2)}`;
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
            console.log('Cantidad actualizada:', nuevaCantidad);

            // Actualizar cantidad en el DOM
            const cantidadSpan = boton.parentElement.querySelector('span');
            cantidadSpan.textContent = nuevaCantidad;

            // Actualizar el subtotal dinámicamente
            const precio = parseFloat(boton.closest('tr').querySelector('td:nth-child(4)').textContent.replace('$', '')) || 0;
            const totalCell = boton.closest('tr').querySelector('td:nth-child(5)');
            totalCell.textContent = `$${(nuevaCantidad * precio).toFixed(2)}`;

            // Actualizar el total del carrito
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
            console.log('Producto eliminado:', mensaje);

            // Obtener la fila antes de eliminarla
            const fila = boton.closest('tr');

            // Actualizar el total antes de eliminar la fila
            actualizarTotal();

            // Eliminar la fila solo si existe
            if (fila) fila.remove();

        } catch (error) {
            console.error('Error al eliminar producto:', error);
            alert(`Hubo un problema al eliminar el producto: ${error.message}`);
        }
    }

    // Inicializa el total al cargar la página
    actualizarTotal();
});
