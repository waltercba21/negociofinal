// /public/js/agregarAlCarrito.js

document.getElementById("contenedor-productos")?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".agregar-carrito");
  if (!btn) return;

  console.log("➡️ Botón 'Agregar al carrito' clickeado");

  const tarjetaProducto = btn.closest(".card");
  const cantidadInput = tarjetaProducto?.querySelector(".cantidad-input");

  const cantidadPedida = parseInt(cantidadInput?.value, 10);
  const nombreProducto = btn.dataset.nombre || "Producto";
  const idProducto = btn.dataset.id;
  const precioProducto = btn.dataset.precio;

  // Stock (si viene)
  const stockDisponible = parseInt(btn.dataset.stock, 10);

  console.log("📊 Datos del producto:", {
    idProducto,
    cantidadPedida,
    nombreProducto,
    precioProducto,
    stockDisponible,
  });

  // Validaciones básicas
  if (!idProducto || !precioProducto || !Number.isFinite(cantidadPedida) || cantidadPedida <= 0) {
    console.error("❌ Error: Datos incompletos o inválidos");

    Swal.fire({
      title: "Cantidad inválida",
      text: "Debes ingresar una cantidad mayor a 0 para continuar.",
      icon: "error",
      confirmButtonText: "OK",
    });
    return;
  }

  let cantidadFinal = cantidadPedida;

  // ✅ Si hay stock numérico y pidió de más => preguntar si agrega el máximo
  if (Number.isFinite(stockDisponible) && stockDisponible >= 0 && cantidadPedida > stockDisponible) {
    const result = await Swal.fire({
      icon: "warning",
      title: "No hay stock suficiente",
      text: `Pediste ${cantidadPedida} unidad(es), pero tenemos ${stockDisponible} disponible(s). ¿Querés agregar ${stockDisponible} (máximo disponible)?`,
      showCancelButton: true,
      confirmButtonText: `Sí, agregar ${stockDisponible}`,
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    cantidadFinal = stockDisponible;

    // opcional: reflejar en el input
    if (cantidadInput) cantidadInput.value = String(cantidadFinal);
  }

  try {
    const resp = await fetch("/carrito/agregar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_producto: idProducto, cantidad: cantidadFinal, precio: precioProducto }),
    });

    let data = null;
    try {
      data = await resp.json();
    } catch (_) {
      data = null;
    }

    console.log("📩 Respuesta del servidor recibida:", { status: resp.status, data });

    // ❌ Errores del backend (incluye 409)
    if (!resp.ok) {
      const msg = data?.error || "Hubo un problema al agregar el producto al carrito.";

      await Swal.fire({
        title: resp.status === 409 ? "Stock insuficiente" : "Error",
        text: msg,
        icon: resp.status === 409 ? "warning" : "error",
        confirmButtonText: "OK",
      });

      return;
    }

    // ✅ OK
    await Swal.fire({
      title: "¡Producto agregado!",
      text:
        cantidadFinal === cantidadPedida
          ? `${cantidadFinal} ${nombreProducto} agregado(s) al carrito`
          : `Se agregaron ${cantidadFinal} (máximo disponible) de ${nombreProducto}`,
      icon: "success",
      confirmButtonText: "OK",
    });

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
        console.error("⚠️ Error: Respuesta inesperada del servidor", data);
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
