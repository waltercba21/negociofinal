// public/js/carrito.js
// AF v2026-01-08: carrito (eliminar + +/-) con mensajes claros y sin romper pedidos

document.addEventListener("DOMContentLoaded", () => {
  console.log("[AF] ✅ carrito.js cargado (v2026-01-08)");

  const contenedorCarrito = document.getElementById("contenedor-carrito");
  const mensajeCarritoVacio = document.getElementById("mensaje-carrito-vacio");
  const botonContinuarEnvio = document.getElementById("continuar-envio");
  const totalCarritoElement = document.getElementById("total-carrito");

  // OJO: en tu carrito.ejs también existe otra tabla con clase "carrito-tabla" (mis pedidos).
  // Por eso SIEMPRE limitamos búsquedas al contenedor del carrito activo.
  const tablaCarrito = contenedorCarrito
    ? contenedorCarrito.querySelector("table.carrito-tabla")
    : null;

  const hasSwal = typeof window.Swal !== "undefined";

  const alertFire = (title, text, icon = "info") => {
    if (hasSwal) return Swal.fire(title, text, icon);
    window.alert(`${title}\n\n${text}`);
  };

  const confirmFire = async (title, text) => {
    if (hasSwal) {
      const result = await Swal.fire({
        title,
        text,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
      });
      return result.isConfirmed;
    }
    return window.confirm(`${title}\n\n${text}`);
  };

  const readBodySafe = async (resp) => {
    const text = await resp.text().catch(() => "");
    if (!text) return { data: null, text: "" };
    try {
      return { data: JSON.parse(text), text };
    } catch {
      return { data: null, text };
    }
  };

  function getFilasProductosCarrito() {
    if (!tablaCarrito) return [];
    return Array.from(tablaCarrito.querySelectorAll("tbody tr"));
  }

  // ======= DINERO ARS (sin centavos) =======
  const fmtARS = (n) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(
      Math.round(Number(n) || 0)
    );

  // Soporta: "$37.200" / "$37.200,50" / "18600.00" / "$37,200.00"
  const parseARS = (input) => {
    if (input === null || input === undefined) return 0;

    let s = String(input).trim();
    if (!s) return 0;

    // deja solo dígitos, punto, coma y signo menos
    s = s.replace(/\s/g, "").replace(/[^\d.,-]/g, "");
    if (!s || s === "-" || s === "," || s === ".") return 0;

    const negative = s.includes("-");
    s = s.replace(/-/g, "");

    let n = 0;

    if (s.includes(",")) {
      // es-AR típico: puntos miles + coma decimal
      // 37.200,50 -> 37200.50
      const normalized = s.replace(/\./g, "").replace(",", ".");
      n = parseFloat(normalized);
    } else if (s.includes(".")) {
      const parts = s.split(".");
      if (parts.length > 2) {
        // 1.234.567 -> 1234567
        n = parseFloat(parts.join(""));
      } else {
        // 37.200 (miles) vs 18600.00 (decimales)
        const dec = parts[1] ?? "";
        if (dec.length === 3) n = parseFloat(parts.join("")); // miles
        else n = parseFloat(s); // decimales
      }
    } else {
      n = parseFloat(s);
    }

    if (!Number.isFinite(n)) return 0;
    return negative ? -n : n;
  };

  function actualizarTotalCarrito() {
    if (!tablaCarrito) return;

    let total = 0;
    tablaCarrito.querySelectorAll(".subtotal").forEach((cell) => {
      total += parseARS(cell.textContent);
    });

    // total en pesos (sin centavos)
    if (totalCarritoElement) totalCarritoElement.value = `$${fmtARS(total)}`;
  }

  function verificarCarritoVacio() {
    const filas = getFilasProductosCarrito();
    const vacio = filas.length === 0;

    if (vacio) {
      if (contenedorCarrito) contenedorCarrito.style.display = "none";
      if (botonContinuarEnvio) botonContinuarEnvio.style.display = "none";
      if (mensajeCarritoVacio) mensajeCarritoVacio.style.display = "block";
      if (totalCarritoElement) totalCarritoElement.value = "$0";
    } else {
      if (contenedorCarrito) contenedorCarrito.style.display = "block";
      if (botonContinuarEnvio) botonContinuarEnvio.style.display = "block";
      if (mensajeCarritoVacio) mensajeCarritoVacio.style.display = "none";
    }
  }

  function buildErrorMessage(status, data, rawText) {
    // 409 => stock / conflicto
    if (status === 409) {
      if (data?.error) return data.error;
      const stock = Number(data?.stockDisponible);
      if (Number.isFinite(stock)) return `No hay más unidades disponibles. Stock: ${stock}.`;
      return "No hay más unidades disponibles para la venta.";
    }
    if (data?.error) return data.error;
    if (rawText) return rawText;
    return "Ocurrió un error.";
  }

  async function eliminarProducto(id, boton) {
    console.log("[AF] 🗑 eliminarProducto ->", { id });

    const ok = await confirmFire("¿Eliminar producto?", "Este producto será eliminado del carrito.");
    if (!ok) return;

    try {
      const resp = await fetch("/carrito/eliminar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const { data, text } = await readBodySafe(resp);
      console.log("[AF][FETCH] <- /carrito/eliminar", { status: resp.status, data, text });

      if (!resp.ok) {
        throw new Error(buildErrorMessage(resp.status, data, text) || "No se pudo eliminar el producto.");
      }

      const fila = boton.closest("tr");
      if (fila) fila.remove();

      actualizarTotalCarrito();
      verificarCarritoVacio();
    } catch (err) {
      console.error("[AF] ❌ Error al eliminar:", err);
      alertFire("Error", err.message || "No se pudo eliminar el producto.", "error");
    }
  }

  async function actualizarCantidad(id, accion) {
    console.log("[AF] 🔄 actualizarCantidad ->", { id, accion });

    try {
      const resp = await fetch("/carrito/actualizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, accion }),
      });

      const { data, text } = await readBodySafe(resp);
      console.log("[AF][FETCH] <- /carrito/actualizar", { status: resp.status, data, text });

      if (!resp.ok) {
        const msg = buildErrorMessage(resp.status, data, text);
        alertFire(
          resp.status === 409 ? "Stock máximo alcanzado" : "Error",
          msg,
          resp.status === 409 ? "warning" : "error"
        );
        return;
      }

      // Simple y seguro para no romper nada: recargamos
      window.location.reload();
    } catch (err) {
      console.error("[AF] ❌ Error al actualizar cantidad:", err);
      alertFire("Error", "No se pudo actualizar la cantidad.", "error");
    }
  }

  // Delegación de eventos: elimina y +/- en un solo listener
  document.addEventListener("click", (e) => {
    const btnEliminar = e.target.closest(".btn-eliminar");
    if (btnEliminar) {
      e.preventDefault();
      const id = btnEliminar.getAttribute("data-id");
      if (!id) return alertFire("Error", "No se encontró el ID del item a eliminar.", "error");
      return eliminarProducto(id, btnEliminar);
    }

    const btnCant = e.target.closest(".btn-cantidad");
    if (btnCant) {
      e.preventDefault();
      const id = btnCant.getAttribute("data-id");
      const accion = btnCant.classList.contains("aumentar") ? "aumentar" : "disminuir";
      if (!id) return alertFire("Error", "No se encontró el ID del item a actualizar.", "error");
      return actualizarCantidad(id, accion);
    }
  });

  if (botonContinuarEnvio) {
    botonContinuarEnvio.addEventListener("click", () => {
      window.location.href = "/carrito/envio";
    });
  }

  // Estado inicial
  actualizarTotalCarrito();
  verificarCarritoVacio();
});
