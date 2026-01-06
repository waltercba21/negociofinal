// /public/js/agregarAlCarrito.js
document.addEventListener("DOMContentLoaded", () => {
  const AF_VERSION = "2026-01-06-debug-1";
  const AF_DEBUG = true;

  const log = (...a) => AF_DEBUG && console.log("[AF][ADD]", ...a);
  const group = (title, data) => {
    if (!AF_DEBUG) return;
    console.groupCollapsed(`[AF][ADD] ${title}`);
    if (data) console.log(data);
  };
  const groupEnd = () => AF_DEBUG && console.groupEnd();

  log("✅ cargar agregarAlCarrito.js", AF_VERSION);

  const contenedor = document.getElementById("contenedor-productos");
  if (!contenedor) {
    log("⚠️ no existe #contenedor-productos (no engancho handlers)");
    return;
  }

  // Muestra sample de botones (para confirmar data-stock)
  const sampleBtns = Array.from(contenedor.querySelectorAll(".agregar-carrito")).slice(0, 10);
  log("Botones detectados:", sampleBtns.length);
  if (sampleBtns.length) {
    console.table(sampleBtns.map(b => ({
      id: b.dataset.id,
      stock: b.dataset.stock,
      stockmin: b.dataset.stockmin,
      disabled: b.disabled
    })));
  }

  const carritoEstimado = new Map(); // productoId -> cantidad agregada desde esta página
  const getEstimado = (id) => carritoEstimado.get(String(id)) || 0;
  const addEstimado = (id, delta) => {
    const key = String(id);
    carritoEstimado.set(key, getEstimado(key) + (Number(delta) || 0));
  };

  const parseIntSafe = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : NaN;
  };

  const readJsonSafe = async (resp) => {
    try { return await resp.json(); } catch { return null; }
  };

  const notify = ({ title, text, icon = "info" }) => {
    if (window.Swal?.fire) {
      return Swal.fire({ title, text, icon, confirmButtonText: "OK" });
    }
    alert(`${title}\n\n${text}`);
  };

  // Clamp visual del input (y loguea)
  document.addEventListener("input", (e) => {
    const input = e.target;
    if (!input.classList?.contains("cantidad-input")) return;

    const card = input.closest(".card");
    const btn = card?.querySelector(".agregar-carrito");
    if (!btn) return;

    const id = btn.dataset.id;
    const stock = parseIntSafe(btn.dataset.stock);
    const stockMin = parseIntSafe(btn.dataset.stockmin);

    let max = Number.isNaN(stock) ? parseIntSafe(input.getAttribute("max")) : stock;
    if (!Number.isNaN(max) && id) {
      const restante = max - getEstimado(id);
      max = Math.max(0, restante);
    }

    let v = parseIntSafe(input.value);
    if (Number.isNaN(v)) v = 0;

    if (!Number.isNaN(max) && v > max) {
      log("✂️ clamp input", { id, vAntes: v, max });
      input.value = String(max);
    }
    if (v < 0) input.value = "0";

    // si pulgar abajo, log
    if (!Number.isNaN(stock) && !Number.isNaN(stockMin) && stock < stockMin) {
      log("ℹ️ pulgar abajo (no debería permitir)", { id, stock, stockMin });
    }
  });

  contenedor.addEventListener("click", async (e) => {
    const btn = e.target.closest(".agregar-carrito");
    if (!btn) return;

    const card = btn.closest(".card");
    const input = card?.querySelector(".cantidad-input");

    const id = btn.dataset.id;
    const nombre = btn.dataset.nombre || "Producto";
    const precio = btn.dataset.precio;

    const stock = parseIntSafe(btn.dataset.stock);
    const stockMin = parseIntSafe(btn.dataset.stockmin);
    const cantidad = parseIntSafe(input?.value);

    group(`CLICK agregar`, { id, nombre, precio, stock, stockMin, cantidad, disabled: btn.disabled });

    // Confirmar que el handler está corriendo (si no ves este log, no se está cargando este JS)
    log("handler click OK", AF_VERSION);

    if (btn.disabled) {
      log("⛔ botón disabled (salgo)");
      groupEnd();
      return;
    }

    // Si no hay stock en dataset, lo logueamos (este es un candidato fuerte)
    if (Number.isNaN(stock) || Number.isNaN(stockMin)) {
      log("❌ data-stock / data-stockmin inválidos", {
        dataStock: btn.dataset.stock,
        dataStockMin: btn.dataset.stockmin
      });
      // igual seguimos al backend para que él decida
    }

    if (!id || !precio || !Number.isFinite(cantidad) || cantidad <= 0) {
      notify({ title: "Cantidad inválida", text: "Debes ingresar una cantidad mayor a 0.", icon: "error" });
      groupEnd();
      return;
    }

    // Validación local (solo si hay stock numérico)
    if (!Number.isNaN(stock) && !Number.isNaN(stockMin)) {
      if (stock < stockMin) {
        notify({
          title: "Producto sin stock inmediato",
          text: "Pendiente de ingreso / a pedido. Comunicate con nosotros 3513820440.",
          icon: "warning"
        });
        groupEnd();
        return;
      }

      const yaAgregado = getEstimado(id);
      const restante = stock - yaAgregado;

      log("stock check local", { stock, yaAgregado, restante });

      if (restante <= 0) {
        notify({ title: "Stock alcanzado", text: "Ya agregaste el máximo disponible.", icon: "warning" });
        groupEnd();
        return;
      }

      if (cantidad > restante) {
        notify({
          title: "Cantidades no disponibles",
          text: `Solo podés agregar ${restante} unidad(es) más.`,
          icon: "warning"
        });
        if (input) input.value = String(restante);
        groupEnd();
        return;
      }
    }

    // POST real
    try {
      const payload = { id_producto: id, cantidad, precio };
      log("POST /carrito/agregar payload:", payload);

      const resp = await fetch("/carrito/agregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafe(resp);
      log("RESP /carrito/agregar", { status: resp.status, data });

      if (!resp.ok) {
        const msg = data?.error || data?.message || "Error al agregar al carrito.";
        notify({
          title: resp.status === 409 ? "Stock insuficiente" : "Error",
          text: msg,
          icon: resp.status === 409 ? "warning" : "error",
        });
        groupEnd();
        return;
      }

      // OK
      addEstimado(id, cantidad);
      notify({ title: "¡Producto agregado!", text: `${cantidad} ${nombre}`, icon: "success" });

      groupEnd();
    } catch (err) {
      log("❌ exception fetch", err);
      notify({ title: "Error", text: err?.message || "Error al agregar.", icon: "error" });
      groupEnd();
    }
  });
});
