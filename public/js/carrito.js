document.addEventListener('DOMContentLoaded', () => {
    const carritoContainer = document.getElementById('carrito-productos');

    carritoContainer.addEventListener('click', (e) => {
        // Actualizar cantidad (aumentar o disminuir)
        if (e.target.classList.contains('btn-cantidad')) {
            const productoId = e.target.getAttribute('data-id');
            const accion = e.target.classList.contains('aumentar') ? 'aumentar' : 'disminuir';
            actualizarCantidad(productoId, accion);
        }

        // Eliminar producto
        if (e.target.classList.contains('btn-eliminar')) {
            const productoId = e.target.getAttribute('data-id');
            eliminarProducto(productoId);
        }
    });

    // Función para actualizar la cantidad
    async function actualizarCantidad(id, accion) {
        try {
            if (!id) throw new Error('ID del producto no válido');

            const response = await fetch(`/carrito/actualizar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, accion })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error desconocido al actualizar');

            console.log('Cantidad actualizada:', data);
            window.location.reload();
        } catch (error) {
            console.error('Error al actualizar cantidad:', error);
            alert('Hubo un problema al actualizar el carrito.');
        }
    }

    // Función para eliminar el producto
    async function eliminarProducto(id) {
        try {
            if (!id) throw new Error('ID del producto no válido');

            const response = await fetch(`/carrito/eliminar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error desconocido al eliminar');

            console.log('Producto eliminado:', data);
            window.location.reload();
        } catch (error) {
            console.error('Error al eliminar producto:', error);
            alert('Hubo un problema al eliminar el producto.');
        }
    }
});
