document.getElementById("contenedor-productos").addEventListener("click", (e) => {
    if (e.target.classList.contains("agregar-carrito")) {
        console.log("➡️ Botón 'Agregar al carrito' clickeado");

        // Obtener información del producto
        const tarjetaProducto = e.target.closest(".card");
        const cantidadInput = tarjetaProducto.querySelector(".cantidad-input");
        const cantidad = parseInt(cantidadInput?.value) || 1;
        const nombreProducto = e.target.dataset.nombre;
        const idProducto = e.target.dataset.id;
        const precioProducto = e.target.dataset.precio;

        // Depuración: Verificar los datos recolectados
        console.log("📊 Datos del producto:", {
            idProducto,
            cantidad,
            nombreProducto,
            precioProducto
        });

        // Validar que los datos esenciales estén presentes
        if (!idProducto || !precioProducto || isNaN(cantidad) || cantidad <= 0) {
            console.error("❌ Error: Datos incompletos o inválidos");
            Swal.fire({
                title: "Error",
                text: "Datos del producto incorrectos.",
                icon: "error",
                confirmButtonText: "OK",
            });
            return; // Detener el proceso si hay datos incorrectos
        }

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
        .then(response => {
            console.log("📩 Respuesta del servidor recibida:", response);
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("✅ Producto agregado con éxito:", data);
            mostrarNotificacion(`${cantidad} ${nombreProducto} agregado(s) al carrito`);
        })
        .catch(error => {
            console.error("❌ Error al agregar el producto al carrito:", error);
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
