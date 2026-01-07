// /public/js/agregarAlCarrito.js
// VERSION: 2026-01-07 (anti-clamp + confirm 409)

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ AF agregarAlCarrito.js cargado (VERSION 2026-01-07)");

  const contenedor = document.getElementById("contenedor-productos");
  if (!contenedor) return;

  // Guardamos lo que el usuario TIPEA, en CAPTURE y solo si esTrusted.
  // Esto evita que otro JS que "clampa" el input nos pise el valor pedido.
  contenedor.addEventListener(
    "input",
    (ev) => {
      const input = ev.target?.closest?.(".cantidad-input");
      if (!input) return;
      if (!ev.isTrusted) return; // ignorar cambios programáticos
      input.dataset.afUserRequested = String(input.value ?? "");
    },
    true // CAPTURE
  );

  const parseIntSafe = (v) => {
    const n = parseInt(String(v ?? ""), 10);
    return Number.isFinite(n) ? n : NaN;
  };

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

  const notify = ({ title, text, icon = "info" }) => {
    if (window.Swal?.fire) {
      return Swal.fire({ title, text, icon, confirmButtonText: "OK" });
    }
    alert(`${title}\n\n${text}`);
    return Promise.resolve();
  };

  const confirmSwal = async ({ title, text, confirmText, cancelText, icon = "warning" }) => {
    if (window.Swal?.fire) {
      const r = await Swal.fire({
        title,
        text,
        icon,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
      });
      return !!r.isConfirmed;
    }
    return confirm(`${title}\n\n${text}`);
  };

  const refrescarGloboCarrito = () => {
    fetch("/carrito/cantidad")
      .then((r) => r.json())
      .then((d) => {
        const globo = document.getElementById("carrito-notificacion");
        if (!globo) return;
        const n = d?.cantidadTotal ?? 0;
        globo.style.display = n > 0 ? "flex" : "none";
        globo.textContent = n;
      })
      .catch(() => {});
  };

  async function postAgregar({ id, cantidad, precio }) {
    const resp = await fetch("/carrito/agregar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_producto: id, cantidad, precio }),
    });
    const { data, text } = await readBodySafe(resp);
    return { resp, data, text };
  }

  // CAPTURE click para cortar otros handlers que puedan clamplear o agregar por su cuenta
  contenedor.addEventListener(
    "click",
    async (e) => {
      const btn = e.target.closest(".agregar-carrito");
      if (!btn) return;

      // Cortamos otros listeners (incluido buscador.js viejo, etc.)
      e.preventDefault();
      e.stopPropagation();

      console.log("➡️ Botón 'Agregar al carrito' clickeado (AF handler)");

      if (btn.disabled) return;

      const card = btn.closest(".card");
      const input = card?.querySelector(".cantidad-input");

      const id = btn.dataset.id;
      const nombre = btn.dataset.nombre || "Producto";
      const precio = btn.dataset.precio;

      // 👇 usamos SIEMPRE lo que el usuario tipeó (afUserRequested)
      const cantidadPedida = parseIntSafe(input?.dataset?.afUserRequested ?? input?.value);

      console.log("📊 Datos del producto:", {
        idProducto: id,
        cantidadPedida,
        nombreProducto: nombre,
        precioProducto: precio,
        inputValueActual: input?.value,
        afUserRequested: input?.dataset?.afUserRequested,
      });

      if (!id || !precio || !Number.isFinite(cantidadPedida) || cantidadPedida <= 0) {
        await notify({
          title: "Cantidad inválida",
          text: "Debes ingresar una cantidad mayor a 0 para continuar.",
          icon: "error",
        });
        return;
      }

      btn.disabled = true;

      try {
        // 1) Intento REAL con lo que pidió el usuario (ej: 20)
        const r1 = await postAgregar({ id, cantidad: cantidadPedida, precio });

        if (r1.resp.ok) {
          await notify({
            title: "¡Producto agregado!",
            text: `${cantidadPedida} ${nombre} agregado(s) al carrito`,
            icon: "success",
          });

          refrescarGloboCarrito();
          if (input) {
            input.value = "1";
            input.dataset.afUserRequested = "1";
          }
          return;
        }

        // 2) Si backend dice 409 -> mostrar explicación y ofrecer máximo disponible
        if (r1.resp.status === 409) {
          const maxAgregable = Number(r1.data?.maxAgregable);
          const stockDisponible = Number(r1.data?.stockDisponible);

          if (Number.isFinite(maxAgregable) && maxAgregable > 0) {
            const ok = await confirmSwal({
              title: "Stock insuficiente",
              text: `Pediste ${cantidadPedida} unidad(es), pero hay ${stockDisponible} disponible(s). ¿Querés agregar ${maxAgregable} (máximo disponible)?`,
              confirmText: `Sí, agregar ${maxAgregable}`,
              cancelText: "No, cancelar",
              icon: "warning",
            });

            if (!ok) return;

            // 3) Segundo POST con máximo (ej: 8)
            const r2 = await postAgregar({ id, cantidad: maxAgregable, precio });

            if (r2.resp.ok) {
              await notify({
                title: "¡Producto agregado!",
                text: `Pediste ${cantidadPedida}. Se agregaron ${maxAgregable} (máximo disponible) de ${nombre}.`,
                icon: "success",
              });

              refrescarGloboCarrito();
              if (input) {
                input.value = "1";
                input.dataset.afUserRequested = "1";
              }
              return;
            }

            const msg2 = r2.data?.error || r2.text || "No se pudo agregar el producto.";
            await notify({ title: "Error", text: msg2, icon: "error" });
            return;
          }

          // maxAgregable = 0 o no viene: mostrar mensaje real del backend
          const msg = r1.data?.error || r1.text || "Stock insuficiente.";
          await notify({ title: "Stock insuficiente", text: msg, icon: "warning" });
          return;
        }

        // Otros errores
        const msg = r1.data?.error || r1.text || `Hubo un problema al agregar. (HTTP ${r1.resp.status})`;
        await notify({ title: "Error", text: msg, icon: "error" });
      } catch (err) {
        console.error("❌ Error al agregar el producto al carrito:", err);
        await notify({
          title: "Error",
          text: err?.message || "Hubo un problema al agregar el producto al carrito.",
          icon: "error",
        });
      } finally {
        btn.disabled = false;
      }
    },
    true // CAPTURE
  );
});
