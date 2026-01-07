// /public/js/carrito.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ carrito.js cargado correctamente.");

  const contenedorCarrito = document.getElementById("contenedor-carrito");
  const mensajeCarritoVacio = document.getElementById("mensaje-carrito-vacio");
  const botonContinuarEnvio = document.getElementById("continuar-envio");
  const totalCarritoElement = document.getElementById("total-carrito");

  const readBodySafe = async (resp) => {
    let text = "";
    try {
      text = await resp.text();
    } catch {
      return { data: null, text: "" };
    }
    if (!text) return { data: null, text: "" };
    try {
      return { data: JSON.parse(text), text };
    } catch {
      return { data: null, text };
    }
  };

  function actualizarTotalCarrito() {
    let total = 0;
    document.querySelectorAll(".subtotal").forEach((subtotalCell) => {
      total += parseFloat(subtotalCell.textContent.replace("$", "").trim()) || 0;
    });
    if (totalCarritoElement) totalCarritoElement.value = `$${total.toFixed(2)}`;
  }

  function verificarCarritoVacio() {
    const filasProductos = document.querySelectorAll(".carrito-tabla tbody tr").length;

    if (filasProductos === 0) {
      if (contenedorCarrito) contenedorCarrito.style.display = "none";
      if (botonContinuarEnvio) botonContinuarEnvio.style.display = "none";
      if (mensajeCarritoVacio) mensajeCarritoVacio.style.display = "block";
      if (totalCarritoElement) totalCarritoElement.value = "$0.00";
    } else {
      if (contenedorCarrito) contenedorCarrito.style.display = "block";
      if (botonContinuarEnvio) botonContinuarEnvio.style.display = "block";
      if (mensajeCarritoVacio) mensajeCarritoVacio.style.display = "none";
    }
  }

  async function eliminarProducto(id, boton) {
    const result = await Swal.fire({
      title: "¿Eliminar producto?",
      text: "Este producto será eliminado del carrito.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
    });

    if (!result.isConfirmed) return;

    try {
      const response = await fetch("/carrito/eliminar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const { data, text } = await readBodySafe(response);
        throw new Error(data?.error || text || "No se pudo eliminar el producto.");
      }

      const fila = boton.closest("tr");
      if (fila) fila.remove();

      setTimeout(() => {
        actualizarTotalCarrito();
        verificarCarritoVacio();
      }, 50);
    } catch (error) {
      console.error("❌ Error al eliminar producto:", error);
      Swal.fire("Error", error.message || "No se pudo eliminar el producto.", "error");
    }
  }

  async function actualizarCantidad(id, accion) {
    console.log(`🔄 Actualizando cantidad del producto ${id}, acción: ${accion}`);

    const botonRef = document.querySelector(`.btn-cantidad[data-id="${id}"]`);
    const fila = botonRef?.closest("tr");

    try {
      const response = await fetch("/carrito/actualizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, accion }),
      });

      const { data, text } = await readBodySafe(response);

      if (!response.ok) {
        const msg = data?.error || text || "Llegaste a la cantidad máxima disponible para este producto.";
        Swal.fire(
          response.status === 409 ? "Stock máximo alcanzado" : "Error",
          msg,
          response.status === 409 ? "warning" : "error"
        );
        return;
      }

      // OK -> actualizar UI
      if (!fila) return;

      const cantidadCell = fila.querySelector(".cantidad");
      const subTotalCell = fila.querySelector(".subtotal");

      if (!cantidadCell || !subTotalCell) return;

      cantidadCell.textContent = data?.nuevaCantidad ?? cantidadCell.textContent;

      const precioUnitario = parseFloat(
        fila.querySelector(".precio")?.textContent.replace("$", "").trim()
      );

      const nuevaCant = Number(data?.nuevaCantidad);
      if (Number.isFinite(precioUnitario) && Number.isFinite(nuevaCant)) {
        subTotalCell.textContent = `$${(precioUnitario * nuevaCant).toFixed(2)}`;
      }

      actualizarTotalCarrito();
    } catch (error) {
      console.error("❌ Error al actualizar cantidad:", error);
      Swal.fire("Error", error.message || "No se pudo actualizar la cantidad.", "error");
    }
  }

  document.addEventListener("click", (e) => {
    const btnEliminar = e.target.closest(".btn-eliminar");
    if (btnEliminar) {
      const productoId = btnEliminar.getAttribute("data-id");
      return eliminarProducto(productoId, btnEliminar);
    }

    const btnCant = e.target.closest(".btn-cantidad");
    if (btnCant) {
      const productoId = btnCant.getAttribute("data-id");
      const accion = btnCant.classList.contains("aumentar") ? "aumentar" : "disminuir";
      return actualizarCantidad(productoId, accion);
    }
  });

  if (botonContinuarEnvio) {
    botonContinuarEnvio.addEventListener("click", () => {
      window.location.href = "/carrito/envio";
    });
  }

  verificarCarritoVacio();
  actualizarTotalCarrito();
});
