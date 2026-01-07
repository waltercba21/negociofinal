// public/js/agregarAlCarrito.js
// AF v2026-01-07: NO clamp automático, pregunta si quiere agregar máximo, y maneja clicks dentro del botón.

document.addEventListener("DOMContentLoaded", () => {
  console.log("[AF] agregarAlCarrito.js cargado v2026-01-07");

  const contenedor = document.getElementById("contenedor-productos");
  if (!contenedor) {
    console.warn("[AF] No existe #contenedor-productos (no se bindea agregarAlCarrito.js)");
    return;
  }

  // Guardamos lo que el usuario TIPEA (para mostrar “pediste X” aunque alguien cambie el value)
  contenedor.addEventListener(
    "input",
    (ev) => {
      const input = ev.target?.closest?.(".cantidad-input");
      if (!input) return;
      if (!ev.isTrusted) return; // ignorar cambios programáticos
      input.dataset.afRequested = String(input.value ?? "");
      console.log("[AF] input isTrusted -> afRequested =", input.dataset.afRequested);
    },
    true
  );

  const parseIntSafe = (v) => {
    const n = parseInt(String(v ?? ""), 10);
    return Number.isFinite(n) ? n : NaN;
  };

  const readJsonSafe = async (resp) => {
    try {
      return await resp.json();
    } catch {
      return null;
    }
  };

  const swalOk = ({ title, text, icon }) => {
    if (window.Swal?.fire) return Swal.fire({ title, text, icon, confirmButtonText: "OK" });
    alert(`${title}\n\n${text}`);
    return Promise.resolve();
  };

  const swalConfirm = async ({ title, text, confirmText }) => {
    if (window.Swal?.fire) {
      const r = await Swal.fire({
        title,
        text,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: "Cancelar",
      });
      return !!r.isConfirmed;
    }
    return confirm(`${title}\n\n${text}`);
  };

  const actualizarGlobo = async () => {
    try {
      const r = await fetch("/carrito/cantidad");
      const d = await r.json();
      const globo = document.getElementById("carrito-notificacion");
      if (!globo) return;
      const n = Number(d?.cantidadTotal) || 0;
      globo.style.display = n > 0 ? "flex" : "none";
      globo.textContent = n;
      console.log("[AF] globo actualizado:", n);
    } catch (e) {
      console.warn("[AF] no se pudo actualizar globo:", e);
    }
  };

  contenedor.addEventListener(
    "click",
    async (e) => {
      const btn = e.target.closest(".agregar-carrito"); // ✅ permite click en iconos dentro
      if (!btn) return;

      e.preventDefault();

      const card = btn.closest(".card");
      const input = card?.querySelector(".cantidad-input");

      const idProducto = btn.dataset.id;
      const nombreProducto = btn.dataset.nombre || "Producto";
      const precioProducto = btn.dataset.precio;

      const stockDisponible = parseIntSafe(btn.dataset.stock);

      const cantTyped = input?.dataset?.afRequested;
      const cantFromInput = input?.value;

      const cantSolicitada = parseIntSafe(cantTyped ?? cantFromInput);

      console.log("[AF] CLICK agregar:", {
        idProducto,
        nombreProducto,
        precioProducto,
        stockDisponible,
        cantTyped,
        cantFromInput,
        cantSolicitada,
      });

      if (!idProducto || !precioProducto || !Number.isFinite(cantSolicitada) || cantSolicitada <= 0) {
        await swalOk({
          title: "Cantidad inválida",
          text: "Ingresá una cantidad mayor a 0.",
          icon: "error",
        });
        return;
      }

      // ✅ Si tenemos stock y pidió más: preguntamos (NO clamp automático)
      let cantidadAEnviar = cantSolicitada;

      if (Number.isFinite(stockDisponible) && stockDisponible >= 0 && cantSolicitada > stockDisponible) {
        const ok = await swalConfirm({
          title: "Stock insuficiente",
          text: `Pediste ${cantSolicitada} unidad(es), pero hay ${stockDisponible} disponible(s). ¿Querés agregar ${stockDisponible} (máximo disponible)?`,
          confirmText: `Sí, agregar ${stockDisponible}`,
        });

        if (!ok) {
          console.log("[AF] usuario canceló agregar máximo");
          return;
        }

        cantidadAEnviar = stockDisponible;
      }

      // Evitar doble click mientras responde
      if (btn.disabled) return;
      btn.disabled = true;

      try {
        const payload = { id_producto: idProducto, cantidad: cantidadAEnviar, precio: precioProducto };
        console.log("[AF][FETCH] -> /carrito/agregar POST", payload);

        const resp = await fetch("/carrito/agregar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await readJsonSafe(resp);

        console.log("[AF][FETCH] <- /carrito/agregar", resp.status, data);

        if (!resp.ok) {
          const msg = data?.error || `No se pudo agregar el producto. (HTTP ${resp.status})`;
          await swalOk({
            title: resp.status === 409 ? "Stock insuficiente" : "Error",
            text: msg,
            icon: resp.status === 409 ? "warning" : "error",
          });
          return;
        }

        // ✅ OK: mensaje claro si pidió más pero confirmó máximo
        const msgOk =
          cantidadAEnviar !== cantSolicitada
            ? `Pediste ${cantSolicitada}. Se agregaron ${cantidadAEnviar} (máximo disponible) de ${nombreProducto}.`
            : `${cantidadAEnviar} ${nombreProducto} agregado(s) al carrito.`;

        await swalOk({ title: "¡Producto agregado!", text: msgOk, icon: "success" });

        await actualizarGlobo();

        // reset input a 1 (y también el afRequested)
        if (input) {
          input.value = "1";
          input.dataset.afRequested = "1";
        }
      } catch (err) {
        console.error("[AF] Error agregando:", err);
        await swalOk({
          title: "Error",
          text: "Hubo un problema al agregar el producto al carrito.",
          icon: "error",
        });
      } finally {
        btn.disabled = false;
      }
    },
    true
  );
});
