document.addEventListener('DOMContentLoaded', () => {
    const carritoContainer = document.getElementById('carrito-productos');

    carritoContainer.addEventListener('click', (e) => {
        // Actualizar cantidad (aumentar o disminuir)
        if (e.target.classList.contains('btn-cantidad')) {
            const productoId = e.target.getAttribute('data-id');
            const accion = e.target.classList.contains('aumentar') ? 'aumentar' : 'disminuir';
            actualizarCantidad(productoId, accion, e.target);
        }

        // Eliminar producto
        if (e.target.classList.contains('btn-eliminar')) {
            const productoId = e.target.getAttribute('data-id');
            eliminarProducto(productoId, e.target);
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

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error desconocido al actualizar');

            console.log('Cantidad actualizada:', data);

            // Actualizar cantidad en el DOM sin recargar
            const cantidadSpan = boton.parentElement.querySelector('span');
            let cantidadActual = parseInt(cantidadSpan.textContent, 10);
            
            if (accion === 'aumentar') cantidadActual++;
            if (accion === 'disminuir' && cantidadActual > 1) cantidadActual--;

            cantidadSpan.textContent = cantidadActual;

            // Actualizar el total dinámicamente
            const precio = parseFloat(boton.closest('tr').querySelector('td:nth-child(3)').textContent.replace('$', ''));
            const totalCell = boton.closest('tr').querySelector('td:nth-child(4)');
            totalCell.textContent = `$${(cantidadActual * precio).toFixed(2)}`;

        } catch (error) {
            console.error('Error al actualizar cantidad:', error);
            alert('Hubo un problema al actualizar el carrito.');
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

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error desconocido al eliminar');

            console.log('Producto eliminado:', data);

            // Eliminar la fila del producto sin recargar
            const fila = boton.closest('tr');
            fila.remove();

        } catch (error) {
            console.error('Error al eliminar producto:', error);
            alert('Hubo un problema al eliminar el producto.');
        }
    }
});
