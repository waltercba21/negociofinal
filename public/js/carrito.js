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

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Error desconocido al actualizar');

        console.log('Cantidad actualizada:', data);
        window.location.reload(); // O actualiza dinámicamente la vista
    } catch (error) {
        console.error('Error al actualizar cantidad:', error);
        alert('Hubo un problema al actualizar el carrito.');
    }
}

});
