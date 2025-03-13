document.addEventListener('DOMContentLoaded', () => {
    const alertaCantidad = document.querySelector('.cantidad-alerta');
    const btnContinuarEnvio = document.getElementById("continuar-envio");
    
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
            console.log(`Cantidad obtenida del carrito: ${cantidadUnica}`);
            actualizarGlobo(cantidadUnica);
        } catch (error) {
            console.error('Error al obtener la cantidad del carrito:', error);
        }
    }

    // Llamar a la función al cargar la página para actualizar el globo
    obtenerCantidadCarrito();

    const carritoContainer = document.getElementById('carrito-productos');
    const totalCarritoElement = document.getElementById('total-carrito');

    if (carritoContainer && totalCarritoElement) {
        console.log('Vista de carrito detectada, manejando actualización de total...');
        
        // Función para actualizar el total del carrito
        async function actualizarTotal() {
            console.log('Actualizando total del carrito...');
            let total = 0;
            let cantidadTotal = 0;
            let cantidadUnica = 0;

            // Aquí recuperamos los datos de los productos del carrito desde el servidor
            try {
                const response = await fetch('/carrito/productos');
                if (!response.ok) throw new Error('Error al obtener los productos del carrito');
                const productos = await response.json();

                // Recorrer los productos y calcular el total
                productos.forEach(producto => {
                    total += producto.subtotal;
                    cantidadTotal += producto.cantidad;
                    cantidadUnica++;  // Contamos cada producto único
                });

                console.log(`Total del carrito calculado: $${total.toFixed(2)}, cantidad total: ${cantidadTotal}, cantidad única: ${cantidadUnica}`);
                totalCarritoElement.textContent = `$${total.toFixed(2)}`;
                actualizarGlobo(cantidadUnica);
            } catch (error) {
                console.error('Error al calcular el total del carrito:', error);
            }
        }

        // Llamamos a actualizarTotal() al cargar la página para obtener el total inicial
        actualizarTotal();

        // Manejar clics en aumentar, disminuir y eliminar productos
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

        async function actualizarCantidad(id, accion, boton) {
            console.log(`Actualizando cantidad de producto. ID: ${id}, Acción: ${accion}`);
            try {
                const response = await fetch('/carrito/actualizar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, accion })
                });

                if (!response.ok) throw new Error('Error al actualizar cantidad');

                const data = await response.json();

                // Buscar la fila y las celdas de cantidad y sub-total
                const fila = boton.closest('tr');
                const cantidadCell = fila ? fila.querySelector('.cantidad-control span') : null;
                const subTotalCell = fila ? fila.querySelector('td:nth-child(5)') : null;

                if (!cantidadCell || !subTotalCell) {
                    console.error('No se encontró la celda de cantidad o sub-total en la fila');
                    return;
                }

                cantidadCell.textContent = data.nuevaCantidad;

                const precioUnitario = parseFloat(fila.querySelector('td:nth-child(4)').textContent.replace('$', '').trim());
                const nuevaCantidad = parseInt(data.nuevaCantidad);
                const nuevoSubTotal = precioUnitario * nuevaCantidad;
                subTotalCell.textContent = `$${nuevoSubTotal.toFixed(2)}`;

                recalcularTotalCarrito();
                actualizarGlobo(data.cantidadUnica);
            } catch (error) {
                console.error('Error al actualizar cantidad:', error);
            }
        }

        // Función para recalcular el total del carrito
        function recalcularTotalCarrito() {
            let totalCarrito = 0;
            const filas = document.querySelectorAll('table tbody tr');
            filas.forEach(fila => {
                const subTotalCell = fila.querySelector('td:nth-child(5)');
                if (subTotalCell) {
                    const subTotal = parseFloat(subTotalCell.textContent.replace('$', '').trim()) || 0;
                    totalCarrito += subTotal;
                }
            });

            if (totalCarritoElement) {
                totalCarritoElement.textContent = `$${totalCarrito.toFixed(2)}`;
            } else {
                console.error('No se encontró el elemento del total del carrito');
            }
        }

        async function eliminarProducto(id, boton) {
            console.log(`Eliminando producto con ID: ${id}`);
            try {
                const response = await fetch('/carrito/eliminar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
        
                if (!response.ok) throw new Error('Error al eliminar producto');
        
                const fila = boton.closest('tr');
                if (fila) fila.remove();
        
                recalcularTotalCarrito(); // Llamar a la función para recalcular el total localmente
                obtenerCantidadCarrito(); // Llamar nuevamente para actualizar el globo
        
            } catch (error) {
                console.error('Error al eliminar producto:', error);
                alert(`Error: ${error.message}`);
            }
        }
    }
    document.addEventListener("DOMContentLoaded", () => {
        const btnContinuarEnvio = document.getElementById("continuar-envio");
    
        if (btnContinuarEnvio) {
            btnContinuarEnvio.addEventListener("click", () => {
                console.log("🔄 Redirigiendo a la vista de Envío...");
                window.location.href = "/carrito/envio";
            });
        }
    });
    

});
