// public/js/agregarAlCarrito.js

document.getElementById("contenedor-productos").addEventListener("click", async (e) => {
  const btn = e.target.closest(".agregar-carrito");
  if (!btn) return;

  console.log("➡️ Botón 'Agregar al carrito' clickeado");

  const tarjetaProducto = btn.closest(".card");
  const cantidadInput = tarjetaProducto?.querySelector(".cantidad-input");

  const nombreProducto = btn.dataset.nombre;
  const idProducto = btn.dataset.id;
  const precioProducto = btn.dataset.precio;

  let cantidad = parseInt(cantidadInput?.value, 10);
  if (!Number.isFinite(cantidad)) cantidad = 1;

  // ✅ stock: primero dataset, si no, fallback a max del input
  let stockDisponible = parseInt(btn.dataset.stock, 10);
  if (!Number.isFinite(stockDisponible)) {
    const maxAttr = cantidadInput?.getAttribute("max");
    const maxNum = parseInt(maxAttr, 10);
    if (Number.isFinite(maxNum)) stockDisponible = maxNum;
  }

  // stock mínimo (para "pulgar arriba/abajo")
  const stockMinimo = parseInt(btn.dataset.stockmin, 10);

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

  // Validar datos esenciales
  if (!idProducto || !precioProducto || !Number.isFinite(cantidad) || cantidad <= 0) {
    Swal.fire({
      title: "Cantidad inválida",
      text: "Debes ingresar una cantidad mayor a 0 para continuar.",
      icon: "error",
      confirmButtonText: "OK",
    });
    return;
  }

  // Si hay semáforo (stockMinimo válido) y está “pulgar abajo”, no permitir
  if (Number.isFinite(stockDisponible) && Number.isFinite(stockMinimo) && stockDisponible < stockMinimo) {
    Swal.fire({
      icon: "warning",
      title: "Producto pendiente de ingreso",
      text: "Este producto está a pedido o pendiente de ingreso. Si necesitás, comunicate con nosotros 3513820440.",
      confirmButtonText: "OK",
    });
    return;
  }

  // ✅ Validar tope por stock real
  if (Number.isFinite(stockDisponible) && cantidad > stockDisponible) {
    Swal.fire({
      icon: "warning",
      title: "Cantidades no disponibles",
      text: `Stock disponible: ${stockDisponible}. Si necesitás más unidades comunicate con nosotros 3513820440.`,
      confirmButtonText: "OK",
    });

    if (cantidadInput) cantidadInput.value = String(stockDisponible);
    return;
  }

  try {
    const resp = await fetch("/carrito/agregar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_producto: idProducto, cantidad, precio: precioProducto }),
    });

    let data = null;
    try { data = await resp.json(); } catch { data = {}; }

    console.log("📩 Respuesta del servidor recibida:", { status: resp.status, ok: resp.ok, data });

    if (!resp.ok) {
      const msg = data?.error || data?.message || `No se pudo agregar (HTTP ${resp.status}).`;

      Swal.fire({
        title: resp.status === 409 ? "Stock insuficiente" : "Error",
        text: msg,
        icon: resp.status === 409 ? "warning" : "error",
        confirmButtonText: "OK",
      });

      return;
    }

    console.log("✅ Producto agregado con éxito:", data);
    mostrarNotificacion(`${cantidad} ${nombreProducto} agregado(s) al carrito`);
    obtenerCantidadCarrito();
  } catch (error) {
    console.error("❌ Error al agregar el producto al carrito:", error);
    Swal.fire({
      title: "Error",
      text: "Hubo un problema al agregar el producto al carrito.",
      icon: "error",
      confirmButtonText: "OK",
    });
  }
});

// Función para mostrar la notificación con SweetAlert
function mostrarNotificacion(mensaje) {
  Swal.fire({
    title: "¡Producto agregado!",
    text: mensaje,
    icon: "success",
    confirmButtonText: "OK",
  });
}

// Función para obtener la cantidad total del carrito y actualizar el globo de notificación
function obtenerCantidadCarrito() {
  console.log("📡 Solicitando cantidad total del carrito...");

  fetch("/carrito/cantidad")
    .then((response) => {
      if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
      return response.json();
    })
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

// Función para actualizar el globo de notificación con la cantidad de productos
function actualizarGloboNotificacion(cantidad) {
  console.log(`🔵 Actualizando globo de notificación con cantidad: ${cantidad}`);
  const globo = document.getElementById("carrito-notificacion");

  if (globo) {
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
  } else {
    console.error("⚠️ No se encontró el elemento de notificación del carrito.");
  }
}
