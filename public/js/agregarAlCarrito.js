document.addEventListener("DOMContentLoaded", () => {
  const contenedor = document.getElementById("contenedor-productos");
  if (!contenedor) return;

  // Estimado local (evita superar stock con múltiples clicks desde esta página)
  // Para que sea 100% infalible, igual hay que validar en el backend.
  const carritoEstimado = new Map(); // id -> cantidad

  const getEnCarrito = (id) => carritoEstimado.get(String(id)) || 0;
  const sumarEnCarrito = (id, delta) =>
    carritoEstimado.set(String(id), getEnCarrito(id) + (Number(delta) || 0));

  // Clamp visual del input
  document.addEventListener("input", (e) => {
    const input = e.target;
    if (!input.classList?.contains("cantidad-input")) return;

    const card = input.closest(".card");
    const btn = card?.querySelector(".agregar-carrito");

    const stock = btn ? parseInt(btn.dataset.stock, 10) : NaN;
    const min = btn ? parseInt(btn.dataset.stockmin, 10) : NaN;

    if (!isNaN(stock) && !isNaN(min) && stock < min) return;

    const max = !isNaN(stock) ? stock : parseInt(input.getAttribute("max"), 10);
    if (isNaN(max)) return;

    let v = parseInt(input.value, 10);
    if (isNaN(v)) v = 0;

    if (v > max) input.value = String(max);
    if (v < 0) input.value = "0";
  });

  contenedor.addEventListener("click", async (e) => {
    const btn = e.target.closest(".agregar-carrito");
    if (!btn) return;

    const card = btn.closest(".card");
    const input = card?.querySelector(".cantidad-input");

    const nombre = btn.dataset.nombre;
    const id = btn.dataset.id;
    const precio = btn.dataset.precio;

    const stock = parseInt(btn.dataset.stock, 10);
    const stockMin = parseInt(btn.dataset.stockmin, 10);

    const cantidad = parseInt(input?.value, 10);

    if (!id || !precio || !Number.isInteger(cantidad) || cantidad <= 0) {
      Swal.fire({
        title: "Cantidad inválida",
        text: "Debes ingresar una cantidad mayor a 0 para continuar.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    // pulgar abajo => no compra
    if (!isNaN(stock) && !isNaN(stockMin) && stock < stockMin) {
      Swal.fire({
        icon: "warning",
        title: "Producto sin stock inmediato",
        text: "Este producto está a pedido. Comunicate con nosotros al 3513820440.",
      });
      return;
    }

    // evita pasar stock acumulando
    if (!isNaN(stock)) {
      const yaAgregado = getEnCarrito(id);
      const maxCompra = stock - yaAgregado;

      if (maxCompra <= 0) {
        Swal.fire({
          icon: "warning",
          title: "Stock alcanzado",
          text: "Ya tenés en el carrito la cantidad máxima disponible de este producto.",
        });
        return;
      }

      if (cantidad > maxCompra) {
        Swal.fire({
          icon: "warning",
          title: "Cantidades no disponibles",
          text: `Solo podés agregar ${maxCompra} unidad(es) más. Si necesitás más, comunicate al 3513820440.`,
        });
        if (input) input.value = String(maxCompra);
        return;
      }
    }

    try {
      const resp = await fetch("/carrito/agregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_producto: id, cantidad, precio }),
      });

      if (!resp.ok) {
        let msg = "Hubo un problema al agregar el producto al carrito.";
        try {
          const err = await resp.json();
          if (err?.message) msg = err.message;
        } catch {}
        throw new Error(msg);
      }

      await resp.json();

      sumarEnCarrito(id, cantidad);

      Swal.fire({
        title: "¡Producto agregado!",
        text: `${cantidad} ${nombre} agregado(s) al carrito`,
        icon: "success",
        confirmButtonText: "OK",
      });

      // refresca globo
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

      if (input) input.value = "1";
    } catch (err) {
      Swal.fire({
        title: "Error",
        text: err?.message || "Hubo un problema al agregar el producto al carrito.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  });
});
