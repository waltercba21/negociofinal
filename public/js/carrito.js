document.addEventListener('DOMContentLoaded', () => {
    const carritoContainer = document.getElementById('carrito-productos');

    carritoContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-cantidad')) {
            const productoId = e.target.getAttribute('data-id');
            const accion = e.target.classList.contains('aumentar') ? 'aumentar' : 'disminuir';

            actualizarCantidad(productoId, accion);
        }
    });

    // Función para actualizar la cantidad
    async function actualizarCantidad(id, accion) {
        try {
            const response = await fetch(`/carrito/actualizar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, accion })
            });

            if (!response.ok) throw new Error('Error al actualizar el carrito');

            // Recargar la página o actualizar dinámicamente la vista
            window.location.reload(); // Puedes optimizar esto con un cambio dinámico
        } catch (error) {
            console.error('Error:', error);
            alert('Hubo un problema al actualizar el carrito.');
        }
    }
});
