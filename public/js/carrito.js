// /public/js/carrito.js
// VERSION: 2026-01-07 (mostrar error 409 real)

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ carrito.js cargado (VERSION 2026-01-07)");

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

  async function actualizarCantidad(id, accion) {
    console.log(`🔄 Actualizando cantidad del producto ${id}, acción: ${accion}`);

    try {
      const response = await fetch("/carrito/actualizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, accion }),
      });

      const { data, text } = await readBodySafe(response);

      if (!response.ok) {
        const msg =
          data?.error ||
          text ||
          "Llegaste a la cantidad máxima disponible para este producto.";

        Swal.fire(
          response.status === 409 ? "Stock máximo alcanzado" : "Error",
          msg,
          response.status === 409 ? "warning" : "error"
        );
        return;
      }

      // Si OK, actualizá UI como ya lo hacías (dejé mínimo para no romper)
      // Si querés, acá puedo integrarlo a tu layout actual.
      window.location.reload();
    } catch (error) {
      console.error("❌ Error al actualizar cantidad:", error);
      Swal.fire("Error", error.message || "No se pudo actualizar la cantidad.", "error");
    }
  }

  document.addEventListener("click", (e) => {
    const btnCant = e.target.closest(".btn-cantidad");
    if (btnCant) {
      const productoId = btnCant.getAttribute("data-id");
      const accion = btnCant.classList.contains("aumentar") ? "aumentar" : "disminuir";
      actualizarCantidad(productoId, accion);
    }
  });
});
