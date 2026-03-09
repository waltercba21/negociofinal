// public/js/pages/selectores.js
// AF v2026-03-09-fix4 — clases actualizadas a .pcard

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

  // === Cambio en cualquier selector => buscar productos ===
  [categoriaSelect, marcaSelect, modeloSelect].forEach((selector) => {
    selector.addEventListener("change", async () => {
      const categoria_id = categoriaSelect.value;
      const marca_id = marcaSelect.value;
      const modelo_id = modeloSelect.value;

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

  // === Delegado: log de click en cards ===
  contenedorProductos.addEventListener('click', (ev) => {
    const btn  = ev.target.closest('.agregar-carrito');
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
     Siguiente proveedor (admin)
  ========================= */
  const _cacheProveedores = new Map();

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

  contenedorProductos.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.btn-ver-proveedores');
    if (!btn || !isAdminUser) return;
    const productoId = Number(btn.dataset.productoId);
    if (!productoId) return;
    const lista = await _getListaProveedores(productoId);
    if (!lista || !lista.length) {
      Swal.fire({ icon: 'info', title: 'Sin proveedores', text: 'Este producto no tiene proveedores cargados.' });
      return;
    }
    const state = _cacheProveedores.get(productoId) || { lista, idx: 0 };
    state.idx = (state.idx + 1) % state.lista.length;
    _cacheProveedores.set(productoId, state);
    _renderProveedor(productoId, state.lista[state.idx]);
  }, { passive: true });

  /* =========================
     RENDER DE CARDS — clases .pcard (v2026-03-09-fix4)
  ========================= */
  function mostrarProductos(productos) {
    contenedorProductos.innerHTML = "";

    if (!Array.isArray(productos) || productos.length === 0) {
      contenedorProductos.innerHTML = `
        <div class="no-result">
          <img src="/images/noEncontrado.png" alt="Sin resultados" class="no-result__img" />
          <h3 class="no-result__title">Sin resultados</h3>
          <p class="no-result__text">No encontramos productos con esos filtros.<br>Probá con otras palabras clave o categorías.</p>
        </div>`;
      return;
    }

    productos.forEach((producto, index) => {
      const esOferta = producto.oferta;
      const esFitam  = producto.calidad_original;
      const esVic    = producto.calidad_vic;
      const puedeComprar = (producto.stock_actual >= producto.stock_minimo) && (producto.stock_actual > 0);

      let badgeHTML = '';
      if (esOferta)     badgeHTML = `<span class="pcard__badge badge--oferta">OFERTA</span>`;
      else if (esFitam) badgeHTML = `<span class="pcard__badge badge--fitam">CALIDAD FITAM</span>`;
      else if (esVic)   badgeHTML = `<span class="pcard__badge badge--vic">CALIDAD VIC</span>`;

      // Carousel de imágenes
      const imagenes = producto.imagenes || [];
      const imagenesHTML = imagenes.map((img, i) =>
        `<img class="pcard__img${i !== 0 ? ' hidden' : ''}" src="/uploads/productos/${img.imagen}" alt="${producto.nombre}" loading="lazy" />`
      ).join('');

      const botonesCarousel = imagenes.length > 1 ? `
        <button class="pcard__carousel-btn pcard__carousel-btn--prev" onclick="moverCarrusel('${index}', -1)" aria-label="Anterior">
          <i class="fas fa-chevron-left"></i>
        </button>
        <button class="pcard__carousel-btn pcard__carousel-btn--next" onclick="moverCarrusel('${index}', 1)" aria-label="Siguiente">
          <i class="fas fa-chevron-right"></i>
        </button>
        <div class="pcard__dots" id="dots-${index}">
          ${imagenes.map((_, i) => `<span class="pcard__dot${i === 0 ? ' pcard__dot--active' : ''}"></span>`).join('')}
        </div>` : '';

      const mediaHTML = `
        <div class="pcard__media">
          <div class="pcard__carousel" id="carousel-${index}">
            ${imagenesHTML || `<img class="pcard__img" src="/images/noEncontrado.png" alt="${producto.nombre}" />`}
          </div>
          ${botonesCarousel}
        </div>`;

      // Admin block
      const adminHTML = isAdminUser ? `
        <div class="pcard__admin">
          <div class="pcard__admin-row">
            <span class="pcard__admin-label">Proveedor</span>
            <span class="prov-nombre pcard__admin-val" data-producto-id="${producto.id}">${producto.proveedor_nombre || '—'}</span>
          </div>
          <div class="pcard__admin-row">
            <span class="pcard__admin-label">Código</span>
            <span class="prov-codigo pcard__admin-val" data-producto-id="${producto.id}">${producto.codigo_proveedor || '—'}</span>
          </div>
          <div class="pcard__admin-row">
            <span class="pcard__admin-label">Stock</span>
            <span class="pcard__admin-val ${producto.stock_actual < producto.stock_minimo ? 'stock--bajo' : 'stock--ok'}">${producto.stock_actual}</span>
          </div>
          <div class="prov-actions">
            <button type="button" class="btn-ver-proveedores" data-producto-id="${producto.id}">
              <i class="fas fa-store"></i> Ver proveedores
            </button>
            <small class="prov-idx" data-producto-id="${producto.id}"></small>
          </div>
        </div>` : '';

      // Stock semáforo
      const stockHTML = (isUserLoggedIn && !isAdminUser) ? `
        <div class="pcard__stock ${puedeComprar ? 'pcard__stock--ok' : 'pcard__stock--bajo'}">
          <i class="fa-solid fa-circle pcard__stock-dot"></i>
          <span class="pcard__stock-txt">${puedeComprar ? 'Disponible para entrega inmediata' : 'A pedido / pendiente de ingreso'}</span>
        </div>` : '';

      // Acciones
      let accionesHTML = '';
      if (isUserLoggedIn && !isAdminUser) {
        accionesHTML = `
          <div class="pcard__qty-row">
            <button type="button" class="qty-btn qty-btn--minus" aria-label="Restar"><i class="fa-solid fa-minus"></i></button>
            <input type="number" class="cantidad-input"
              value="${puedeComprar ? 1 : 0}"
              min="${puedeComprar ? 1 : 0}"
              max="${producto.stock_actual}"
              step="1"
              ${puedeComprar ? '' : 'disabled'}
              aria-label="Cantidad" />
            <button type="button" class="qty-btn qty-btn--plus" aria-label="Sumar"><i class="fa-solid fa-plus"></i></button>
          </div>
          <button class="btn-agregar agregar-carrito"
            ${puedeComprar ? '' : 'disabled'}
            data-id="${producto.id}"
            data-nombre="${producto.nombre}"
            data-precio="${producto.precio_venta}"
            data-stock="${producto.stock_actual}"
            data-stockmin="${producto.stock_minimo}">
            <i class="fa-solid fa-cart-plus"></i>
            <span>${puedeComprar ? 'Agregar al carrito' : 'Sin stock'}</span>
          </button>`;
      }

      // Descripción / aplicaciones
      const descAplica = (producto.descripcion || '').trim();
      const esEscobilla = /escobill/i.test(producto.categoria_nombre || '') || /escobill/i.test(producto.nombre || '');
      const aplicacionesHTML = (esEscobilla && descAplica) ? `
        <button type="button" class="btn-aplicaciones"
          data-titulo="${producto.nombre}"
          data-aplicaciones='${JSON.stringify(descAplica)}'>
          <i class="fa-solid fa-car"></i> <span>Ver aplicaciones</span>
        </button>` : '';

      const card = document.createElement('article');
      card.className = `pcard${esOferta ? ' pcard--oferta' : ''}${esFitam ? ' pcard--fitam' : ''}${esVic ? ' pcard--vic' : ''}`;

      card.innerHTML = `
        ${badgeHTML}
        ${mediaHTML}
        <div class="pcard__body">
          <span class="pcard__categoria">${producto.categoria_nombre || 'Sin categoría'}</span>
          <h3 class="pcard__nombre">${producto.nombre}</h3>
          <div class="pcard__precio-row">
            <span class="pcard__precio">$${formatearNumero(producto.precio_venta || 0)}</span>
            ${esOferta ? '<span class="pcard__precio-tag"><i class="fa-solid fa-bolt"></i> Oferta</span>' : ''}
          </div>
          ${aplicacionesHTML}
          ${adminHTML}
          ${stockHTML}
          <div class="pcard__actions">
            ${accionesHTML}
            <a href="/productos/${producto.id}" class="btn-detalle card-link">
              <i class="fa-solid fa-eye"></i> <span>Ver detalles</span>
            </a>
          </div>
          <div class="pcard__share">
            <a href="https://wa.me/543513820440?text=QUIERO CONSULTAR POR ESTE PRODUCTO: https://www.autofaros.com.ar/productos/${producto.id}" class="pcard__share-btn pcard__share-btn--wa" target="_blank" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>
            <a href="https://www.facebook.com/profile.php?id=100063665395970" class="pcard__share-btn pcard__share-btn--fb" target="_blank" title="Facebook"><i class="fab fa-facebook-f"></i></a>
            <a href="https://www.instagram.com/autofaros_cordoba" class="pcard__share-btn pcard__share-btn--ig" target="_blank" title="Instagram"><i class="fab fa-instagram"></i></a>
          </div>
        </div>`;

      contenedorProductos.appendChild(card);
      _inicializarProveedorActual(producto);
    });
  }

  /* =========================
     moverCarrusel — clases .pcard__img (v2026-03-09-fix4)
  ========================= */
  window.moverCarrusel = function (index, direccion) {
    const carousel = document.getElementById('carousel-' + index);
    if (!carousel) return;
    const imagenes = carousel.querySelectorAll('.pcard__img');
    if (!imagenes.length) return;
    let activa = Array.from(imagenes).findIndex(img => !img.classList.contains('hidden'));
    if (activa < 0) activa = 0;
    imagenes[activa].classList.add('hidden');
    activa = (activa + direccion + imagenes.length) % imagenes.length;
    imagenes[activa].classList.remove('hidden');
    // Dots
    const dots = document.getElementById('dots-' + index);
    if (dots) {
      dots.querySelectorAll('.pcard__dot').forEach((d, i) => {
        d.classList.toggle('pcard__dot--active', i === activa);
      });
    }
  };

  function formatearNumero(num) {
    return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
});