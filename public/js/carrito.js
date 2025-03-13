document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ carrito.js cargado correctamente.");

    // Variables globales
    const carritoContainer = document.querySelector(".carrito-tabla tbody");
    const totalCarritoElement = document.getElementById("total-carrito");
    const alertaCantidad = document.querySelector(".cantidad-alerta");

    // 🔹 Función para actualizar el contador del carrito en el header
    async function actualizarGlobo() {
        try {
            const response = await fetch("/carrito/cantidad");
            if (!response.ok) throw new Error("Error al obtener la cantidad del carrito");

            const { cantidadTotal } = await response.json();
            if (alertaCantidad) {
                alertaCantidad.textContent = cantidadTotal > 0 ? cantidadTotal : "";
                alertaCantidad.style.display = cantidadTotal > 0 ? "inline-block" : "none";
            }
        } catch (error) {
            console.error("❌ Error al actualizar el globo del carrito:", error);
        }
    }

    // 🔹 Función para actualizar el total del carrito
    async function actualizarTotalCarrito() {
        let totalCarrito = 0;
        document.querySelectorAll(".carrito-tabla tbody tr").forEach(fila => {
            const subTotalCell = fila.querySelector("td:nth-child(5)");
            if (subTotalCell) {
                totalCarrito += parseFloat(subTotalCell.textContent.replace("$", "").trim()) || 0;
            }
        });

        if (totalCarritoElement) {
            totalCarritoElement.textContent = `$${totalCarrito.toFixed(2)}`;
        } else {
            console.error("❌ No se encontró el elemento del total del carrito.");
        }
    }

    // 🔹 Función para actualizar la cantidad de un producto en el carrito
    async function actualizarCantidad(id, accion, boton) {
        try {
            const response = await fetch("/carrito/actualizar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, accion })
            });

            if (!response.ok) throw new Error("Error al actualizar la cantidad");

            const data = await response.json();
            const fila = boton.closest("tr");
            if (!fila) return;

            const cantidadCell = fila.querySelector(".cantidad-control span");
            const subTotalCell = fila.querySelector("td:nth-child(5)");

            if (!cantidadCell || !subTotalCell) {
                console.error("❌ No se encontró la celda de cantidad o subtotal.");
                return;
            }

            cantidadCell.textContent = data.nuevaCantidad;

            const precioUnitario = parseFloat(fila.querySelector("td:nth-child(4)").textContent.replace("$", "").trim());
            subTotalCell.textContent = `$${(precioUnitario * data.nuevaCantidad).toFixed(2)}`;

            actualizarTotalCarrito();
            actualizarGlobo();
        } catch (error) {
            console.error("❌ Error al actualizar cantidad:", error);
            Swal.fire("Error", "No se pudo actualizar la cantidad.", "error");
        }
    }

    // 🔹 Función para eliminar un producto del carrito
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

                boton.closest("tr").remove(); // Elimina la fila de la tabla
                actualizarTotalCarrito();
                actualizarGlobo();
                
                Swal.fire("Eliminado", "El producto ha sido eliminado.", "success");
            } catch (error) {
                console.error("❌ Error al eliminar producto:", error);
                Swal.fire("Error", "No se pudo eliminar el producto.", "error");
            }
        });
    }

    // 🔹 Manejo de eventos en la tabla del carrito
    if (carritoContainer) {
        carritoContainer.addEventListener("click", async (e) => {
            const boton = e.target.closest(".btn-eliminar, .btn-cantidad");
            if (!boton) return;

            const productoId = boton.getAttribute("data-id");

            if (boton.classList.contains("btn-cantidad")) {
                const accion = boton.classList.contains("aumentar") ? "aumentar" : "disminuir";
                await actualizarCantidad(productoId, accion, boton);
            }

            if (boton.classList.contains("btn-eliminar")) {
                await eliminarProducto(productoId, boton);
            }
        });
    } else {
        console.warn("⚠️ No se encontró el contenedor del carrito.");
    }

    // 🔹 Evento para redirigir a la página de envíos
    const btnContinuarEnvio = document.getElementById("continuar-envio");
    if (btnContinuarEnvio) {
        btnContinuarEnvio.addEventListener("click", () => {
            console.log("🔄 Redirigiendo a la vista de Envío...");
            window.location.href = "/carrito/envio";
        });
    }

    // 🔹 Inicializar datos al cargar la página
    actualizarGlobo();
    actualizarTotalCarrito();
});
