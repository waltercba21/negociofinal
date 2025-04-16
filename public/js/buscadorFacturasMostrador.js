document.addEventListener("DOMContentLoaded", function () {
    const inputBusqueda = document.getElementById("buscador");
    const tablaResultados = document.getElementById("tabla-resultados");
    const tablaFactura = document.getElementById("tabla-factura").getElementsByTagName("tbody")[0];
    const totalFactura = document.getElementById("total-factura");
    const btnGuardarFactura = document.getElementById("guardar-factura-btn");
    const form = document.getElementById("invoice-form");
  
    let productos = [];
    let seleccionados = [];
    let indexActivo = -1;
  
    inputBusqueda.addEventListener("focus", () => {
      tablaResultados.classList.remove("hidden");
    });
  
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".contenedor-buscador")) {
        tablaResultados.classList.add("hidden");
      }
    });
  
    inputBusqueda.addEventListener("input", async function () {
      const query = this.value.trim();
      if (!query) {
        tablaResultados.classList.add("hidden");
        return;
      }
  
      const response = await fetch(`/productos/api/buscar?q=${encodeURIComponent(query)}`);
      productos = await response.json();
  
      renderResultados();
    });
  
    function renderResultados() {
      tablaResultados.innerHTML = "";
  
      if (productos.length === 0) {
        tablaResultados.classList.add("hidden");
        return;
      }
  
      productos.forEach((producto, index) => {
        const fila = document.createElement("tr");
        fila.classList.add("cursor-pointer");
        fila.innerHTML = `
          <td>${producto.codigo}</td>
          <td>${producto.nombre}</td>
          <td>$${Number(producto.precio_venta).toLocaleString("es-AR")}</td>
          <td>${producto.stock_actual}</td>
        `;
        fila.addEventListener("click", () => seleccionarProducto(producto));
        tablaResultados.appendChild(fila);
      });
  
      tablaResultados.classList.remove("hidden");
    }
  
    function seleccionarProducto(producto) {
      const fila = document.createElement("tr");
  
      fila.innerHTML = `
        <td>${producto.codigo}</td>
        <td>${producto.nombre}</td>
        <td>$${Number(producto.precio_venta).toLocaleString("es-AR")}</td>
        <td><input type="number" value="1" min="1" class="cantidad-input" data-precio="${producto.precio_venta}"></td>
        <td class="subtotal">$${Number(producto.precio_venta).toLocaleString("es-AR")}</td>
        <td><button class="eliminar-producto">❌</button></td>
      `;
  
      fila.querySelector(".cantidad-input").addEventListener("input", function () {
        const cantidad = parseInt(this.value);
        const precio = parseFloat(this.dataset.precio);
        const subtotal = isNaN(cantidad) ? 0 : cantidad * precio;
        fila.querySelector(".subtotal").textContent = `$${subtotal.toLocaleString("es-AR")}`;
        calcularTotal();
      });
  
      fila.querySelector(".eliminar-producto").addEventListener("click", () => {
        fila.remove();
        calcularTotal();
      });
  
      tablaFactura.appendChild(fila);
      calcularTotal();
  
      inputBusqueda.value = "";
      tablaResultados.innerHTML = "";
      productos = [];
      tablaResultados.classList.add("hidden");
    }
  
    function calcularTotal() {
      let total = 0;
      const subtotales = tablaFactura.querySelectorAll(".subtotal");
  
      subtotales.forEach((cell) => {
        const valor = Number(cell.textContent.replace("$", "").replace(/\./g, "").replace(",", "."));
        total += valor;
      });
  
      totalFactura.textContent = `$${total.toLocaleString("es-AR")}`;
    }
  
    // ⛔️ PREVENIR envío del formulario con teclas (como Enter)
    form.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault(); // Bloquea envío accidental
      }
    });
  
    // ✅ Enviar solo desde el botón específico
    btnGuardarFactura.addEventListener("click", function () {
      form.submit();
    });
  });
  