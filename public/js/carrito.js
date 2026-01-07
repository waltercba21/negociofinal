// public/js/carrito.js
// AF v2026-01-07b: mensaje claro cuando se alcanza el stock máximo (HTTP 409)

document.addEventListener("DOMContentLoaded", () => {
  console.log("[AF] carrito.js cargado v2026-01-07b");

  const MSG_STOCK_MAX = "No hay más unidades disponibles para la venta.";

  const readBodySafe = async (resp) => {
    const text = await resp.text().catch(() => "");
    if (!text) return { data: null, text: "" };
    try {
      return { data: JSON.parse(text), text };
    } catch {
      return { data: null, text };
    }
  };

  function buildErrorMessage(status, data, rawText) {
    // 409 = stock máximo / conflicto
    if (status === 409) {
      // Prioridad: data.error
      if (data?.error) return data.error;

      // Si mandás info extra desde backend (opcional)
      const stock = Number(data?.stockDisponible);
      const maxAg = Number(data?.maxAgregable);

      if (Number.isFinite(stock) && Number.isFinite(maxAg)) {
        return `Stock disponible: ${stock}. No podés agregar más. (Máximo agregable: ${maxAg})`;
      }
      if (Number.isFinite(stock)) {
        return `Stock disponible: ${stock}. ${MSG_STOCK_MAX}`;
      }

      return MSG_STOCK_MAX;
    }

    // Otros errores
    if (data?.error) return data.error;
    if (rawText) return rawText;

    return "No se pudo actualizar la cantidad.";
  }

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
        const msg = buildErrorMessage(resp.status, data, text);

        Swal.fire(
          resp.status === 409 ? "Stock máximo alcanzado" : "Error",
          msg,
          resp.status === 409 ? "warning" : "error"
        );
        return;
      }

      // OK (simple y seguro)
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
