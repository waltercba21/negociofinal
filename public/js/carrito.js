document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ carrito.js cargado correctamente.");

    // Variables globales
    const contenedorCarrito = document.getElementById("contenedor-carrito");
    const mensajeCarritoVacio = document.getElementById("mensaje-carrito-vacio");
    const botonContinuarEnvio = document.getElementById("continuar-envio");
    const totalCarritoElement = document.getElementById("total-carrito");

    function actualizarTotalCarrito() {
        console.log("🔄 Actualizando el total del carrito...");

        let total = 0;
        document.querySelectorAll(".subtotal").forEach(subtotalCell => {
            total += parseFloat(subtotalCell.textContent.replace("$", "").trim()) || 0;
        });

        console.log(`✅ Nuevo total calculado: $${total.toFixed(2)}`);
        if (totalCarritoElement) totalCarritoElement.value = `$${total.toFixed(2)}`;
    }

    function verificarCarritoVacio() {
        console.log("🔍 Verificando si el carrito está vacío...");
        const filasProductos = document.querySelectorAll(".carrito-tabla tbody tr").length;

        if (filasProductos === 0) {
            console.log("🛒 El carrito está vacío.");

            if (contenedorCarrito) contenedorCarrito.style.display = "none";
            if (botonContinuarEnvio) botonContinuarEnvio.style.display = "none";
            if (mensajeCarritoVacio) mensajeCarritoVacio.style.display = "block";
            if (totalCarritoElement) totalCarritoElement.value = "$0.00";
        } else {
            console.log("✅ Hay productos en el carrito.");
            if (contenedorCarrito) contenedorCarrito.style.display = "block";
            if (botonContinuarEnvio) botonContinuarEnvio.style.display = "block";
            if (mensajeCarritoVacio) mensajeCarritoVacio.style.display = "none";
        }
    }

    async function eliminarProducto(id, boton) {
        console.log(`🗑 Eliminando producto con ID: ${id}`);

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
                console.log(`✅ Producto eliminado con éxito.`);

                // Esperar a que el DOM se actualice antes de verificar si está vacío
                setTimeout(() => {
                    actualizarTotalCarrito();
                    verificarCarritoVacio();
                }, 100);
            } catch (error) {
                console.error("❌ Error al eliminar producto:", error);
                Swal.fire("Error", "No se pudo eliminar el producto.", "error");
            }
        });
    }

    async function actualizarCantidad(id, accion) {
        console.log(`🔄 Actualizando cantidad del producto ${id}, acción: ${accion}`);

        try {
            const response = await fetch("/carrito/actualizar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, accion })
            });

            if (!response.ok) throw new Error("Error al actualizar la cantidad");

            const data = await response.json();
            const fila = document.querySelector(`.btn-cantidad[data-id="${id}"]`).closest("tr");

            if (!fila) return;

            const cantidadCell = fila.querySelector(".cantidad");
            const subTotalCell = fila.querySelector(".subtotal");

            if (!cantidadCell || !subTotalCell) {
                console.error("❌ No se encontraron las celdas de cantidad o subtotal.");
                return;
            }

            cantidadCell.textContent = data.nuevaCantidad;

            const precioUnitario = parseFloat(fila.querySelector(".precio").textContent.replace("$", "").trim());
            subTotalCell.textContent = `$${(precioUnitario * data.nuevaCantidad).toFixed(2)}`;

            actualizarTotalCarrito();
        } catch (error) {
            console.error("❌ Error al actualizar cantidad:", error);
            Swal.fire("Error", "No se pudo actualizar la cantidad.", "error");
        }
    }

    document.addEventListener("click", (e) => {
        if (e.target.closest(".btn-eliminar")) {
            const boton = e.target.closest(".btn-eliminar");
            const productoId = boton.getAttribute("data-id");
            eliminarProducto(productoId, boton);
        }

        if (e.target.closest(".btn-cantidad")) {
            const boton = e.target.closest(".btn-cantidad");
            const productoId = boton.getAttribute("data-id");
            const accion = boton.classList.contains("aumentar") ? "aumentar" : "disminuir";
            actualizarCantidad(productoId, accion);
        }
    });

    if (botonContinuarEnvio) {
        botonContinuarEnvio.addEventListener("click", () => {
            console.log("🔄 Redirigiendo a la vista de Envío...");
            window.location.href = "/carrito/envio";
        });
    }

    verificarCarritoVacio();
});
