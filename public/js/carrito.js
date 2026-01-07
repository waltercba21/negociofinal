// public/js/carrito.js
// AF v2026-01-07: muestra error real (409) y loguea status/body.

document.addEventListener("DOMContentLoaded", () => {
  console.log("[AF] carrito.js cargado v2026-01-07");

  const readBodySafe = async (resp) => {
    const text = await resp.text().catch(() => "");
    if (!text) return { data: null, text: "" };
    try {
      return { data: JSON.parse(text), text };
    } catch {
      return { data: null, text };
    }
  };

  async function actualizarCantidad(id, accion) {
    console.log(`[AF] 🔄 Actualizando cantidad id=${id} accion=${accion}`);

    try {
      const resp = await fetch("/carrito/actualizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, accion }),
      });

      const { data, text } = await readBodySafe(resp);

      console.log("[AF][FETCH] <- /carrito/actualizar", {
        status: resp.status,
        data,
        text,
      });

      if (!resp.ok) {
        const msg =
          data?.error ||
          text ||
          "Llegaste a la cantidad máxima disponible para este producto.";

        Swal.fire(
          resp.status === 409 ? "Stock máximo alcanzado" : "Error",
          msg,
          resp.status === 409 ? "warning" : "error"
        );
        return;
      }

      // ✅ OK: si tu backend devuelve nuevaCantidad, podés actualizar DOM sin recargar
      // Para no romper tu lógica actual, recargamos (simple y seguro).
      window.location.reload();
    } catch (err) {
      console.error("[AF] ❌ Error al actualizar cantidad:", err);
      Swal.fire("Error", "No se pudo actualizar la cantidad.", "error");
    }
  }

  document.addEventListener("click", (e) => {
    const btnCant = e.target.closest(".btn-cantidad");
    if (!btnCant) return;

    const id = btnCant.getAttribute("data-id");
    const accion = btnCant.classList.contains("aumentar") ? "aumentar" : "disminuir";
    actualizarCantidad(id, accion);
  });
});
