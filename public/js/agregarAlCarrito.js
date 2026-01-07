// /public/js/agregarAlCarrito.js
document.addEventListener("DOMContentLoaded", () => {
  const contenedor = document.getElementById("contenedor-productos");
  if (!contenedor) return;

  // Guardamos lo que el usuario TIPEÓ (para que aunque otro JS cambie el value, podamos mostrar el mensaje correcto)
  contenedor.addEventListener("input", (ev) => {
    const input = ev.target?.closest?.(".cantidad-input");
    if (!input) return;
    input.dataset.userRequested = String(input.value ?? "");
  });

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

  contenedor.addEventListener("click", async (e) => {
    const btn = e.target.closest(".agregar-carrito");
    if (!btn) return;

    console.log("➡️ Botón 'Agregar al carrito' clickeado");

    if (btn.disabled) return;

    const card = btn.closest(".card");
    const input = card?.querySelector(".cantidad-input");

    const id = btn.dataset.id;
    const nombre = btn.dataset.nombre || "Producto";
    const precio = btn.dataset.precio;

    const stock = parseIntSafe(btn.dataset.stock);
    const stockMin = parseIntSafe(btn.dataset.stockmin);

    // 👇 Cantidad pedida REAL: lo que el usuario tipeó (aunque alguien cambie el value)
    const cantidadPedida = parseIntSafe(input?.dataset?.userRequested ?? input?.value);

    console.log("📊 Datos del producto:", {
      idProducto: id,
      cantidadPedida,
      nombreProducto: nombre,
      precioProducto: precio,
      stock,
      stockMin,
      inputValueActual: input?.value,
      inputUserRequested: input?.dataset?.userRequested,
    });

    if (!id || !precio || !Number.isFinite(cantidadPedida) || cantidadPedida <= 0) {
      await notify({
        title: "Cantidad inválida",
        text: "Debes ingresar una cantidad mayor a 0 para continuar.",
        icon: "error",
      });
      return;
    }

    // Si la página sabe el stock y pedís más -> preguntamos ANTES de agregar
    let cantidadAEnviar = cantidadPedida;

    if (Number.isFinite(stock) && stock >= 0) {
      if (stock <= 0) {
        await notify({
          title: "Sin stock",
          text: "No hay stock disponible para este producto. Si necesitás, comunicate al 3513820440.",
          icon: "warning",
        });
        return;
      }

      if (Number.isFinite(stockMin) && stock < stockMin) {
        await notify({
          title: "Producto a pedido",
          text: "Producto pendiente de ingreso o a pedido. Si necesitás, comunicate al 3513820440.",
          icon: "warning",
        });
        return;
      }

      if (cantidadPedida > stock) {
        const ok = await confirmSwal({
          title: "Stock insuficiente",
          text: `Pediste ${cantidadPedida} unidad(es), pero tenemos ${stock} disponible(s). ¿Querés agregar ${stock} (máximo disponible)?`,
          confirmText: `Sí, agregar ${stock}`,
          cancelText: "No, cancelar",
          icon: "warning",
        });

        if (!ok) return;
        cantidadAEnviar = stock;
      }
    }

    btn.disabled = true;

    try {
      const r1 = await postAgregar({ id, cantidad: cantidadAEnviar, precio });

      // ✅ OK
      if (r1.resp.ok) {
        const textoOk =
          (cantidadPedida > cantidadAEnviar)
            ? `Pediste ${cantidadPedida}. Se agregaron ${cantidadAEnviar} (máximo disponible) de ${nombre}.`
            : `${cantidadAEnviar} ${nombre} agregado(s) al carrito`;

        await notify({ title: "¡Producto agregado!", text: textoOk, icon: "success" });

        refrescarGloboCarrito();
        if (input) {
          input.value = "1";
          input.dataset.userRequested = "1";
        }
        return;
      }

      // ❌ 409 del backend -> mostrar mensaje real
      if (r1.resp.status === 409) {
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
  });
});
