// public/js/agregarAlCarrito.js

document.addEventListener("DOMContentLoaded", () => {
  const contenedor = document.getElementById("contenedor-productos");
  if (!contenedor) return;

  const notify = ({ title, text, icon = "info" }) => {
    if (window.Swal?.fire) {
      return Swal.fire({
        title,
        text,
        icon,
        confirmButtonText: "OK",
      });
    }
    alert(`${title}\n\n${text}`);
  };

  const parseIntSafe = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : NaN;
  };

  // Lee body una sola vez y trata de parsear JSON si corresponde
  const readBodySafe = async (resp) => {
    let text = "";
    try {
      text = await resp.text();
    } catch {
      return { text: "", data: {} };
    }

    if (!text) return { text: "", data: {} };

    try {
      return { text, data: JSON.parse(text) };
    } catch {
      return { text, data: {} };
    }
  };

  contenedor.addEventListener("click", async (e) => {
    const btn = e.target.closest(".agregar-carrito");
    if (!btn) return;

    console.log("➡️ Botón 'Agregar al carrito' clickeado");

    const tarjetaProducto = btn.closest(".card");
    const cantidadInput = tarjetaProducto?.querySelector(".cantidad-input");

    const nombreProducto = btn.dataset.nombre || "Producto";
    const idProducto = btn.dataset.id;
    const precioProducto = btn.dataset.precio;

    let cantidad = parseIntSafe(cantidadInput?.value);
    if (!Number.isFinite(cantidad)) cantidad = 1;

    // stock: dataset -> fallback max del input
    let stockDisponible = parseIntSafe(btn.dataset.stock);
    if (!Number.isFinite(stockDisponible)) {
      const maxAttr = cantidadInput?.getAttribute("max");
      const maxNum = parseIntSafe(maxAttr);
      if (Number.isFinite(maxNum)) stockDisponible = maxNum;
    }

    const stockMinimo = parseIntSafe(btn.dataset.stockmin);

    console.log("📊 Datos del producto:", {
      idProducto,
      cantidad,
      nombreProducto,
      precioProducto,
      stockDisponible,
      stockMinimo,
      dataStock: btn.dataset.stock,
      dataStockMin: btn.dataset.stockmin,
      inputMax: cantidadInput?.getAttribute("max"),
    });

    // Validaciones básicas
    if (!idProducto || !precioProducto || !Number.isFinite(cantidad) || cantidad <= 0) {
      notify({
        title: "Cantidad inválida",
        text: "Debes ingresar una cantidad mayor a 0 para continuar.",
        icon: "error",
      });
      return;
    }

    // Pulgar abajo => no permitir compra inmediata (si tenemos los 2 valores)
    if (
      Number.isFinite(stockDisponible) &&
      Number.isFinite(stockMinimo) &&
      stockDisponible < stockMinimo
    ) {
      notify({
        title: "Producto pendiente de ingreso",
        text: "Este producto está a pedido o pendiente de ingreso. Si necesitás, comunicate con nosotros al 3513820440.",
        icon: "warning",
      });
      return;
    }

    // Tope por stock (FRONT)
    if (Number.isFinite(stockDisponible) && cantidad > stockDisponible) {
      notify({
        title: "No hay stock suficiente",
        text: `Estás intentando agregar ${cantidad} unidad(es), pero actualmente tenemos ${stockDisponible} en stock para entrega inmediata. Si necesitás más, comunicate con nosotros al 3513820440.`,
        icon: "warning",
      });

      if (cantidadInput) cantidadInput.value = String(stockDisponible);
      return;
    }

    // POST BACKEND
    try {
      const resp = await fetch("/carrito/agregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_producto: idProducto, cantidad, precio: precioProducto }),
      });

      const { text, data } = await readBodySafe(resp);

      console.log("📩 Respuesta del servidor recibida:", {
        status: resp.status,
        ok: resp.ok,
        data,
        raw: text?.slice(0, 200),
      });

      if (!resp.ok) {
        const msg =
          data?.error ||
          data?.message ||
          (text ? text.slice(0, 180) : "") ||
          `No se pudo agregar el producto (HTTP ${resp.status}).`;

        notify({
          title: resp.status === 409 ? "No hay stock suficiente" : "Error",
          text: msg,
          icon: resp.status === 409 ? "warning" : "error",
        });

        return;
      }

      // OK
      notify({
        title: "¡Producto agregado!",
        text: `${cantidad} ${nombreProducto} agregado(s) al carrito`,
        icon: "success",
      });

      obtenerCantidadCarrito();
    } catch (error) {
      console.error("❌ Error al agregar el producto al carrito:", error);
      notify({
        title: "Error de conexión",
        text: "No pudimos comunicarnos con el servidor. Probá nuevamente.",
        icon: "error",
      });
    }
  });

  // === Globo de carrito ===
  function obtenerCantidadCarrito() {
    console.log("📡 Solicitando cantidad total del carrito...");

    fetch("/carrito/cantidad")
      .then((response) => response.json())
      .then((data) => {
        console.log("🛒 Cantidad total obtenida:", data);
        if (data && data.cantidadTotal !== undefined) {
          actualizarGloboNotificacion(data.cantidadTotal);
        } else {
          console.error("⚠️ Respuesta inesperada del servidor", data);
        }
      })
      .catch((error) => {
        console.error("❌ Error al obtener la cantidad del carrito:", error);
      });
  }

  function actualizarGloboNotificacion(cantidad) {
    console.log(`🔵 Actualizando globo de notificación con cantidad: ${cantidad}`);
    const globo = document.getElementById("carrito-notificacion");

    if (!globo) {
      console.error("⚠️ No se encontró el elemento de notificación del carrito.");
      return;
    }

    if (cantidad > 0) {
      globo.textContent = cantidad;
      globo.style.display = "flex";
      globo.style.justifyContent = "center";
      globo.style.alignItems = "center";
      globo.style.minWidth = "20px";
      globo.style.minHeight = "20px";
      globo.style.padding = "2px";
      globo.style.fontSize = "12px";
      globo.style.textAlign = "center";
      globo.offsetHeight; // reflow
    } else {
      globo.style.display = "none";
    }
  }
});
