document.addEventListener("DOMContentLoaded", function () {
  const categoriaSelect = document.getElementById("categoria_id");
  const marcaSelect = document.getElementById("marca_id");
  const modeloSelect = document.getElementById("modelo_id");
  const contenedorProductos = document.getElementById("contenedor-productos");

  if (!categoriaSelect || !marcaSelect || !modeloSelect || !contenedorProductos) return;

  const isUserLoggedIn = document.body.dataset.isUserLoggedIn === "true";
  const isAdminUser = document.body.dataset.isAdminUser === "true";

  // === Analytics helpers ===
  function logBusquedaTexto(q, origen = "selectores") {
    if (!q) return;
    fetch("/analytics/busquedas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, origen })
    }).catch(() => {});
  }
  function logBusquedaProducto(producto_id, qActual) {
    if (!producto_id) return;
    fetch("/analytics/busqueda-producto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ producto_id: Number(producto_id), q: qActual || null })
    }).catch(() => {});
  }
  function buildQueryDesc() {
    return `categoria=${categoriaSelect.value||''};marca=${marcaSelect.value||''};modelo=${modeloSelect.value||''}`;
  }

  // === Cargar modelos al cambiar marca ===
  marcaSelect.addEventListener("change", function () {
    const marcaId = this.value;
    fetch("/productos/modelos/" + marcaId)
      .then((res) => res.json())
      .then((modelos) => {
        modeloSelect.innerHTML = "";
        const option = document.createElement("option");
        option.value = "";
        option.text = "Selecciona un modelo";
        modeloSelect.appendChild(option);

        const normalizarModelo = (nombre) => {
          const partes = nombre.split('/');
          if (partes.length === 2 && !isNaN(partes[0]) && !isNaN(partes[1])) {
            return parseInt(partes[0]) + parseInt(partes[1]) / 100;
          }
          const match = nombre.match(/\d+/g);
          return match ? parseInt(match.join('')) : Number.MAX_SAFE_INTEGER;
        };

        modelos.sort((a, b) => normalizarModelo(a.nombre) - normalizarModelo(b.nombre));

        modelos.forEach((modelo) => {
          const opt = document.createElement("option");
          opt.value = modelo.id;
          opt.text = modelo.nombre;
          modeloSelect.appendChild(opt);
        });
      })
      .catch((err) => console.error("Error al cargar modelos:", err));
  });

  // === Cambio en cualquier selector => buscar productos + log de búsqueda ===
  [categoriaSelect, marcaSelect, modeloSelect].forEach((selector) => {
    selector.addEventListener("change", async () => {
      const categoria_id = categoriaSelect.value;
      const marca_id = marcaSelect.value;
      const modelo_id = modeloSelect.value;

      // Log de búsqueda (selectores)
      logBusquedaTexto(buildQueryDesc(), "selectores");

      contenedorProductos.innerHTML = "<p>Cargando productos...</p>";

      try {
        const response = await fetch(`/productos/api/buscar?categoria_id=${encodeURIComponent(categoria_id)}&marca_id=${encodeURIComponent(marca_id)}&modelo_id=${encodeURIComponent(modelo_id)}`);
        if (!response.ok) throw new Error("Error al obtener productos");
        const productos = await response.json();
        mostrarProductos(productos);
      } catch (error) {
        console.error("Error:", error);
        contenedorProductos.innerHTML = "<p>Error al cargar productos.</p>";
      }
    });
  });

  // === Delegado: click en cards para loguear selección de producto (sin interferir con tu lógica) ===
  contenedorProductos.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.agregar-carrito');
    const link = ev.target.closest('.card-link');
    if (!btn && !link) return;

    let productoId = null;
    if (btn) productoId = btn.dataset?.id;
    if (!productoId && link && link.getAttribute('href')) {
      const m = link.getAttribute('href').match(/\/productos\/(\d+)/);
      if (m) productoId = m[1];
    }
    if (!productoId) return;

    logBusquedaProducto(productoId, buildQueryDesc());
  }, { passive: true });

  /* =========================
     NUEVO: Siguiente proveedor
     ========================= */
  const _cacheProveedores = new Map(); // productoId -> { lista: [], idx: number }

  async function _getListaProveedores(productoId) {
    if (_cacheProveedores.has(productoId)) return _cacheProveedores.get(productoId).lista;
    const r = await fetch(`/productos/api/proveedores/${productoId}`);
    const lista = await r.json();
    _cacheProveedores.set(productoId, { lista: Array.isArray(lista) ? lista : [], idx: 0 });
    return _cacheProveedores.get(productoId).lista;
  }

  function _renderProveedor(productoId, data) {
    const spanNombre = document.querySelector(`.prov-nombre[data-producto-id="${productoId}"]`);
    const spanCodigo = document.querySelector(`.prov-codigo[data-producto-id="${productoId}"]`);
    const smallIdx   = document.querySelector(`.prov-idx[data-producto-id="${productoId}"]`);
    if (spanNombre) spanNombre.textContent = data?.proveedor_nombre || 'Sin proveedor';
    if (spanCodigo) spanCodigo.textContent = data?.codigo || '-';
    if (smallIdx) {
      const st = _cacheProveedores.get(productoId);
      const pos = (st?.idx ?? 0) + 1;
      const total = st?.lista?.length || 0;
      smallIdx.textContent = total > 0 ? `Mostrando ${pos} de ${total}` : '';
    }
  }

  function _inicializarProveedorActual(producto) {
    if (!isAdminUser) return;
    const st = _cacheProveedores.get(producto.id);
    if (!st || !st.lista?.length) return;

    const actualNombre = (document.querySelector(`.prov-nombre[data-producto-id="${producto.id}"]`)?.textContent || '').trim();
    const idx = st.lista.findIndex(p => (p.proveedor_nombre || '').trim() === actualNombre);
    st.idx = idx >= 0 ? idx : 0;
    _cacheProveedores.set(producto.id, st);
    _renderProveedor(producto.id, st.lista[st.idx]);
  }

  // Delegado de click SOLO para “Siguiente proveedor”
  contenedorProductos.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.btn-siguiente-proveedor');
    if (!btn || !isAdminUser) return;

    const productoId = Number(btn.dataset.productoId);
    if (!productoId) return;

    const lista = await _getListaProveedores(productoId);
    if (!lista || !lista.length) {
      Swal.fire({ icon:'info', title:'Sin proveedores', text:'Este producto no tiene proveedores cargados.' });
      return;
    }

    const state = _cacheProveedores.get(productoId) || { lista, idx: 0 };
    state.idx = (state.idx + 1) % state.lista.length; // avance cíclico
    _cacheProveedores.set(productoId, state);
    _renderProveedor(productoId, state.lista[state.idx]);
  }, { passive: true });

  // === Render de resultados ===
  function mostrarProductos(productos) {
    contenedorProductos.innerHTML = "";

    if (!Array.isArray(productos) || productos.length === 0) {
      const contenedorVacio = document.createElement("div");
      contenedorVacio.className = "no-result";
      contenedorVacio.innerHTML = `
        <img src="/images/noEncontrado.png" alt="Producto no encontrado" class="imagen-no-result">
        <p>No se encontraron productos. Probá con otros filtros o palabras clave.</p>
      `;
      contenedorProductos.appendChild(contenedorVacio);
      return;
    }

    productos.forEach((producto, index) => {
      const card = document.createElement("div");
      card.className = `
        card 
        ${producto.calidad_original ? "calidad-original-fitam" : ""} 
        ${producto.calidad_vic ? "calidad_vic" : ""} 
        ${producto.oferta ? "producto-oferta" : ""}
      `;
      card.setAttribute("data-label",
        producto.oferta ? "OFERTA" :
        producto.calidad_original ? "CALIDAD FITAM" :
        producto.calidad_vic ? "CALIDAD VIC" : ""
      );

      const imagenesHTML = (producto.imagenes || []).map((img, i) => `
        <img class="carousel__image ${i !== 0 ? "hidden" : ""}" src="/uploads/productos/${img.imagen}" alt="${producto.nombre}">
      `).join("");

      // Bloque admin (proveedor/código + botón)
      const adminProveedorHTML = isAdminUser ? `
        <div class="codigo-admin">
          <p>
            <strong>Proveedor:</strong>
            <span class="prov-nombre" data-producto-id="${producto.id}">
              ${producto.proveedor_nombre || 'Sin proveedor'}
            </span>
          </p>
          <p>
            <strong>Código:</strong>
            <span class="prov-codigo" data-producto-id="${producto.id}">
              ${producto.codigo_proveedor || '-'}
            </span>
          </p>
          <div class="prov-actions">
            <button type="button"
                    class="btn-siguiente-proveedor"
                    data-producto-id="${producto.id}">
              Siguiente proveedor
            </button>
            <small class="prov-idx"
                   data-producto-id="${producto.id}"
                   style="display:block;opacity:.7;margin-top:4px"></small>
          </div>
        </div>
      ` : '';

      const stockHTML = isUserLoggedIn
        ? (isAdminUser
          ? `
            <div class="stock-producto ${producto.stock_actual >= producto.stock_minimo ? "suficiente-stock" : "bajo-stock"}">
              <p>Stock Disponible: ${producto.stock_actual}</p>
            </div>
            <div class="cantidad-producto">
              <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
            </div>
          `
          : `
            <div class="semaforo-stock">
              <i class="fa-solid fa-thumbs-${producto.stock_actual >= producto.stock_minimo ? "up verde" : "down rojo"}"></i>
              <span class="texto-semaforo">
                ${producto.stock_actual >= producto.stock_minimo
                  ? "PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA"
                  : "PRODUCTO PENDIENTE DE INGRESO O A PEDIDO"}
              </span>
            </div>
            <div class="cantidad-producto">
              <input type="number" class="cantidad-input" value="0" min="0" id="input-cantidad-${producto.id}">
              <button class="agregar-carrito"
                data-id="${producto.id}" 
                data-nombre="${producto.nombre}" 
                data-precio="${producto.precio_venta}" 
                data-stock="${producto.stock_actual}" 
                data-stockmin="${producto.stock_minimo}">
                Agregar al carrito
              </button>
              <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
            </div>
          `)
        : `<div class="cantidad-producto"><a href="/productos/${producto.id}" class="card-link">Ver detalles</a></div>`;

      card.innerHTML = `
        <div class="cover-card">
          <div class="carousel-container">
            <button class="carousel__button carousel__button--left" onclick="moverCarrusel('${index}', -1)">
              <i class="fas fa-chevron-left"></i>
            </button>
            <div class="carousel-wrapper">
              <div class="carousel" id="carousel-${index}">
                ${imagenesHTML}
              </div>
            </div>
            <button class="carousel__button carousel__button--right" onclick="moverCarrusel('${index}', 1)">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
        <div class="titulo-producto"><h3 class="nombre">${producto.nombre}</h3></div>
        <hr>
        <div class="categoria-producto"><h6 class="categoria">${producto.categoria_nombre || "Sin categoría"}</h6></div>
        <div class="precio-producto"><p class="precio">$${formatearNumero(producto.precio_venta || 0)}</p></div>

        ${adminProveedorHTML}
        ${stockHTML}

        <div class="acciones-compartir">
          <a href="https://wa.me/543513820440?text=QUIERO CONSULTAR POR ESTE PRODUCTO: https://www.autofaros.com.ar/productos/${producto.id}" class="whatsapp" target="_blank">
            <i class="fab fa-whatsapp"></i>
          </a>
          <a href="https://www.facebook.com/profile.php?id=100063665395970" class="facebook" target="_blank">
            <i class="fab fa-facebook"></i>
          </a>
          <a href="https://www.instagram.com/autofaros_cordoba" class="instagram" target="_blank">
            <i class="fab fa-instagram"></i>
          </a>
        </div>
      `;

      contenedorProductos.appendChild(card);

      // Lógica de validación/dispatch para agregar al carrito (igual que tenías)
      if (!isAdminUser && isUserLoggedIn) {
        const botonAgregar = card.querySelector('.agregar-carrito');
        const inputCantidad = card.querySelector('.cantidad-input');

        botonAgregar.addEventListener('click', (e) => {
          e.preventDefault();
          const cantidad = parseInt(inputCantidad.value);
          const stockDisponible = parseInt(producto.stock_actual);

          if (!cantidad || cantidad <= 0 || isNaN(cantidad)) {
            Swal.fire({ icon: 'error', title: 'Cantidad inválida', text: 'Debes ingresar una cantidad mayor a 0.' });
            return;
          }

          if (cantidad > stockDisponible) {
            Swal.fire({ icon: 'warning', title: 'Cantidades no disponibles', text: 'Si deseas más unidades comunicate con nosotros 3513820440' });
            inputCantidad.value = stockDisponible;
            return;
          }

          const eventoAgregar = new CustomEvent("agregarAlCarritoDesdeBuscador", {
            detail: {
              id: producto.id,
              nombre: producto.nombre,
              precio: producto.precio_venta,
              cantidad: cantidad
            }
          });

          document.dispatchEvent(eventoAgregar);
        });
      }

      // Inicializar proveedor actual si ya hay lista cacheada
      _inicializarProveedorActual(producto);
    });
  }

  // === Helpers existentes ===
  window.moverCarrusel = function (index, direccion) {
    const carousel = document.getElementById(`carousel-${index}`);
    const imagenes = carousel.querySelectorAll(".carousel__image");
    let activa = [...imagenes].findIndex(img => !img.classList.contains("hidden"));
    imagenes[activa].classList.add("hidden");
    activa = (activa + direccion + imagenes.length) % imagenes.length;
    imagenes[activa].classList.remove("hidden");
  };

  function formatearNumero(num) {
    return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
});
