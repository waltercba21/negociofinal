document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ carrito.js cargado correctamente.");

    // Variables globales
    const contenedorCarrito = document.getElementById("contenedor-carrito");
    const mensajeCarritoVacio = document.getElementById("mensaje-carrito-vacio");
    const totalCarritoElement = document.getElementById("total-carrito");
    const botonContinuarEnvio = document.getElementById("boton-continuar-envio");

    function verificarCarritoVacio() {
        const filasProductos = document.querySelectorAll(".carrito-tabla tbody tr").length;

        if (filasProductos === 0) {
            console.log("🛒 El carrito está vacío, ocultando la tabla y el botón de continuar.");

            // Ocultar el contenedor del carrito
            if (contenedorCarrito) contenedorCarrito.style.display = "none";

            // Ocultar el botón de continuar
            if (botonContinuarEnvio) botonContinuarEnvio.style.display = "none";

            // Mostrar el mensaje de carrito vacío
            if (mensajeCarritoVacio) mensajeCarritoVacio.style.display = "block";
        }
    }

    async function eliminarProducto(id, boton) {
        Swal.fire({
            title: "¿Eliminar producto?",
            text: "Este producto será eliminado del carrito.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, eliminar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6"
        }).then(async (result) => {
            if (!result.isConfirmed) return;

            try {
                const response = await fetch("/carrito/eliminar", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id })
                });

                if (!response.ok) throw new Error("Error al eliminar el producto");

                const fila = boton.closest("tr");
                if (fila) fila.remove();

                // Esperar a que el DOM se actualice antes de verificar si está vacío
                setTimeout(() => {
                    verificarCarritoVacio();
                }, 100);

                Swal.fire("Eliminado", "El producto ha sido eliminado.", "success");
            } catch (error) {
                console.error("❌ Error al eliminar producto:", error);
                Swal.fire("Error", "No se pudo eliminar el producto.", "error");
            }
        });
    }

    // Manejo de eventos para eliminar productos
    document.addEventListener("click", (e) => {
        if (e.target.closest(".btn-eliminar")) {
            const boton = e.target.closest(".btn-eliminar");
            const productoId = boton.getAttribute("data-id");
            eliminarProducto(productoId, boton);
        }
    });

    // Evento para continuar con el envío
    const btnContinuarEnvio = document.getElementById("continuar-envio");
    if (btnContinuarEnvio) {
        btnContinuarEnvio.addEventListener("click", () => {
            console.log("🔄 Redirigiendo a la vista de Envío...");
            window.location.href = "/carrito/envio";
        });
    }

    verificarCarritoVacio(); // Verificación inicial al cargar la página
});
