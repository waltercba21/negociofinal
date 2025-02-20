document.addEventListener('DOMContentLoaded', () => {
    const carritoContainer = document.getElementById('carrito-productos');

    carritoContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-cantidad')) {
            const productoId = e.target.getAttribute('data-id');
            const accion = e.target.classList.contains('aumentar') ? 'aumentar' : 'disminuir';

            console.log('ID del producto:', productoId);
            console.log('Acción:', accion);

            actualizarCantidad(productoId, accion);
        }
    });

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
});
