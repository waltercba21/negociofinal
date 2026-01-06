// /public/js/agregarAlCarrito.js
document.addEventListener("DOMContentLoaded", () => {
  const contenedor = document.getElementById("contenedor-productos");
  if (!contenedor) return;

  // Estimación local (evita superar stock con múltiples clicks en ESTA página)
  // OJO: la validación real e infalible es la del backend (/carrito/agregar).
  const carritoEstimado = new Map(); // productoId(string) -> cantidad agregada desde esta página

  const getEnCarritoEstimado = (id) => carritoEstimado.get(String(id)) || 0;
  const sumarEnCarritoEstimado = (id, delta) => {
    const key = String(id);
    carritoEstimado.set(key, getEnCarritoEstimado(key) + (Number(delta) || 0));
  };

  const notify = ({ title, text, icon = "info" }) => {
    if (window.Swal?.fire) {
      return Swal.fire({
        title,
        text,
        icon,
        confirmButtonText: "OK",
      });
    }
    // fallback
    alert(`${title}\n\n${text}`);
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

  // Clamp visual del input (y ajusta al stock restante estimado)
  document.addEventListener("input", (e) => {
    const input = e.target;
    if (!input.classList?.contains("cantidad-input")) return;

    const card = input.closest(".card");
    const btn = card?.querySelector(".agregar-carrito");
    if (!btn) return;

    const { id, stock, stockMin } = getDatosDesdeBtn(btn);

    // Si es "pulgar abajo", no clamp (está disabled normalmente)
    if (!Number.isNaN(stock) && !Number.isNaN(stockMin) && stock < stockMin) return;

    // Max por stock (si lo tenemos) y además por lo ya agregado estimado
    let max = Number.isNaN(stock) ? parseIntSafe(input.getAttribute("max")) : stock;
    if (!Number.isNaN(max) && id) {
      const restanteEstimado = max - getEnCarritoEstimado(id);
      max = Math.max(0, restanteEstimado);
    }

    let v = parseIntSafe(input.value);
    if (Number.isNaN(v)) v = 0;

    if (!Number.isNaN(max)) {
      if (v > max) input.value = String(max);
    }
    if (v < 0) input.value = "0";
  });

  contenedor.addEventListener("click", async (e) => {
    const btn = e.target.closest(".agregar-carrito");
    if (!btn) return;

    // Si está disabled, el click suele no disparar, pero por las dudas:
    if (btn.disabled) return;

    const card = btn.closest(".card");
    const input = card?.querySelector(".cantidad-input");

    const { id, nombre, precio, stock, stockMin } = getDatosDesdeBtn(btn);
    const cantidad = parseIntSafe(input?.value);

    // Validación básica
    if (!id || !precio || !Number.isFinite(cantidad) || cantidad <= 0) {
      notify({
        title: "Cantidad inválida",
        text: "Debes ingresar una cantidad mayor a 0 para continuar.",
        icon: "error",
      });
      return;
    }

    // Regla "pulgar abajo" => no compra inmediata
    if (!Number.isNaN(stock) && !Number.isNaN(stockMin) && stock < stockMin) {
      notify({
        title: "Producto sin stock inmediato",
        text: "Este producto está pendiente de ingreso o a pedido. Comunicate con nosotros al 3513820440.",
        icon: "warning",
      });
      return;
    }

    // Límite por stock (si el stock viene en data-stock)
    if (!Number.isNaN(stock)) {
      const yaAgregado = getEnCarritoEstimado(id);
      const restante = stock - yaAgregado;

      if (restante <= 0) {
        notify({
          title: "Stock alcanzado",
          text: "Ya agregaste la cantidad máxima disponible de este producto.",
          icon: "warning",
        });
        return;
      }

      if (cantidad > restante) {
        notify({
          title: "Cantidades no disponibles",
          text: `Solo podés agregar ${restante} unidad(es) más. Si necesitás más, comunicate al 3513820440.`,
          icon: "warning",
        });
        if (input) input.value = String(restante);
        return;
      }
    }

    try {
      const resp = await fetch("/carrito/agregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_producto: id, cantidad, precio }),
      });

      const data = await readJsonSafe(resp);

      if (!resp.ok) {
        // Tu backend suele responder { error: "..." } (y a veces { message: "..." })
        const msg =
          data?.error ||
          data?.message ||
          "Hubo un problema al agregar el producto al carrito.";

        // 401 => no logueado, 409 => stock
        const icon = resp.status === 409 ? "warning" : resp.status === 401 ? "info" : "error";

        notify({
          title: resp.status === 409 ? "Stock insuficiente" : "Error",
          text: msg,
          icon,
        });

        // Si backend manda maxAgregable, ayudamos al usuario
        if (resp.status === 409 && input && Number.isFinite(parseIntSafe(data?.maxAgregable))) {
          input.value = String(parseIntSafe(data.maxAgregable));
        }

        return;
      }

      // OK
      sumarEnCarritoEstimado(id, cantidad);

      notify({
        title: "¡Producto agregado!",
        text: `${cantidad} ${nombre} agregado(s) al carrito`,
        icon: "success",
      });

      refrescarGloboCarrito();

      if (input) input.value = "1";
    } catch (err) {
      notify({
        title: "Error",
        text: err?.message || "Hubo un problema al agregar el producto al carrito.",
        icon: "error",
      });
    }
  });
});
