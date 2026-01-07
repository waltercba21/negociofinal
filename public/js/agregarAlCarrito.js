// /public/js/agregarAlCarrito.js
document.addEventListener("DOMContentLoaded", () => {
  const contenedor = document.getElementById("contenedor-productos");
  if (!contenedor) return;

  // Estimación local (solo para evitar doble-click rápido).
  // La validación REAL es la del backend (/carrito/agregar).
  const carritoEstimado = new Map(); // productoId(string) -> cantidad agregada desde esta página

  const getEnCarritoEstimado = (id) => carritoEstimado.get(String(id)) || 0;
  const sumarEnCarritoEstimado = (id, delta) => {
    const key = String(id);
    carritoEstimado.set(key, getEnCarritoEstimado(key) + (Number(delta) || 0));
  };

  const notify = ({ title, text, icon = "info" }) => {
    if (window.Swal && typeof window.Swal.fire === "function") {
      return window.Swal.fire({ title, text, icon, confirmButtonText: "OK" });
    }
    alert(`${title}\n\n${text}`);
    return Promise.resolve();
  };

  const confirmSwal = async ({ title, text, confirmText, cancelText, icon = "warning" }) => {
    if (window.Swal && typeof window.Swal.fire === "function") {
      const r = await window.Swal.fire({
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

  const readJsonSafe = async (resp) => {
    try {
      return await resp.json();
    } catch {
      return null;
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

  const parseIntSafe = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : NaN;
  };

  const getDatosDesdeBtn = (btn) => {
    const id = btn?.dataset?.id;
    const nombre = btn?.dataset?.nombre || "Producto";
    const precio = btn?.dataset?.precio;
    const stock = parseIntSafe(btn?.dataset?.stock);
    const stockMin = parseIntSafe(btn?.dataset?.stockmin);
    return { id, nombre, precio, stock, stockMin };
  };

  async function postAgregar({ id, cantidad, precio }) {
    const resp = await fetch("/carrito/agregar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_producto: id, cantidad, precio }),
    });
    const data = await readJsonSafe(resp);
    return { resp, data };
  }

  contenedor.addEventListener("click", async (e) => {
    const btn = e.target.closest(".agregar-carrito");
    if (!btn) return;

    console.log("➡️ Botón 'Agregar al carrito' clickeado");

    if (btn.disabled) return;

    const card = btn.closest(".card");
    const input = card?.querySelector(".cantidad-input");

    const { id, nombre, precio, stock, stockMin } = getDatosDesdeBtn(btn);

    // ⚠️ IMPORTANTE: ya NO clampleamos el input mientras escribe.
    const cantidadPedida = parseIntSafe(input?.value);

    console.log("📊 Datos del producto:", {
      idProducto: id,
      cantidad: cantidadPedida,
      nombreProducto: nombre,
      precioProducto: precio,
      stock,
      stockMin,
      estimadoEnCarrito: getEnCarritoEstimado(id),
    });

    // Validación básica
    if (!id || !precio || !Number.isFinite(cantidadPedida) || cantidadPedida <= 0) {
      await notify({
        title: "Cantidad inválida",
        text: "Debes ingresar una cantidad mayor a 0 para continuar.",
        icon: "error",
      });
      return;
    }

    // Evitar doble-click rápido
    btn.disabled = true;

    try {
      // 1) Intento con la cantidad REAL que pidió el cliente
      const { resp, data } = await postAgregar({ id, cantidad: cantidadPedida, precio });

      console.log("📩 Respuesta del servidor recibida:", resp);

      // ✅ OK
      if (resp.ok) {
        sumarEnCarritoEstimado(id, cantidadPedida);

        await notify({
          title: "¡Producto agregado!",
          text: `${cantidadPedida} ${nombre} agregado(s) al carrito`,
          icon: "success",
        });

        refrescarGloboCarrito();
        if (input) input.value = "1";
        return;
      }

      // ❌ 409 (stock insuficiente / max alcanzado / a pedido)
      if (resp.status === 409) {
        const maxAgregable = Number(data?.maxAgregable);
        const stockDisponible = Number(data?.stockDisponible);

        // Si el backend dice que se puede agregar ALGO, preguntamos al cliente
        if (Number.isFinite(maxAgregable) && maxAgregable > 0) {
          const ok = await confirmSwal({
            title: "Stock insuficiente",
            text: `Pediste ${cantidadPedida} unidad(es), pero tenemos ${stockDisponible} disponible(s). ¿Querés agregar ${maxAgregable} (máximo disponible)?`,
            confirmText: `Sí, agregar ${maxAgregable}`,
            cancelText: "No, cancelar",
            icon: "warning",
          });

          if (!ok) return;

          // 2) Segundo intento: agregar el máximo permitido (maxAgregable)
          const r2 = await postAgregar({ id, cantidad: maxAgregable, precio });

          if (r2.resp.ok) {
            sumarEnCarritoEstimado(id, maxAgregable);

            await notify({
              title: "¡Producto agregado!",
              text: `Se agregaron ${maxAgregable} (máximo disponible) de ${nombre}.`,
              icon: "success",
            });

            refrescarGloboCarrito();
            if (input) input.value = "1";
            return;
          }

          // Si falla el segundo intento, mostramos el error real
          await notify({
            title: "Error",
            text: r2.data?.error || "No se pudo agregar el producto.",
            icon: "error",
          });
          return;
        }

        // maxAgregable = 0 o no viene -> mensaje directo del backend
        await notify({
          title: "Stock máximo alcanzado",
          text: data?.error || "Ya alcanzaste la cantidad máxima disponible de este producto.",
          icon: "warning",
        });
        return;
      }

      // Otros errores
      await notify({
        title: "Error",
        text: data?.error || `Hubo un problema al agregar el producto al carrito. (${resp.status})`,
        icon: "error",
      });
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
