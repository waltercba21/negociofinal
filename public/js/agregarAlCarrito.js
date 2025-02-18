document.getElementById("contenedor-productos").addEventListener("click", (e) => {
    if (e.target.classList.contains("agregar-carrito")) {
        const tarjetaProducto = e.target.closest(".card");
        const cantidadInput = tarjetaProducto.querySelector(".cantidad-input");
        const cantidad = parseInt(cantidadInput.value) || 1;
        const nombreProducto = e.target.dataset.nombre;
        const idProducto = e.target.dataset.id;
        const precioProducto = e.target.dataset.precio;

        // Enviar la solicitud al servidor para agregar el producto al carrito
        fetch('/carrito/agregar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id_producto: idProducto,
                cantidad: cantidad,
                precio: precioProducto
            }), 
        })
        .then(response => response.json())
        .then(data => {
            mostrarNotificacion(`${cantidad} ${nombreProducto} agregado(s) al carrito`);
        })
        .catch(error => {
            console.error('Error al agregar el producto al carrito:', error);
            Swal.fire({
                title: "Error",
                text: "Hubo un problema al agregar el producto al carrito.",
                icon: "error",
                confirmButtonText: "OK",
            });
        });
    }
});

// Función para mostrar la notificación con SweetAlert
function mostrarNotificacion(mensaje) {
    Swal.fire({
        title: "¡Producto agregado!",
        text: mensaje,
        icon: "success",
        confirmButtonText: "OK",
        timer: 3000,
        timerProgressBar: true
    });
}
