/* ======================================================
   Buscador + Render de cards + “Siguiente proveedor”
   (con simulación de precio para admins)
   ====================================================== */

let productosOriginales = [];
let timer;

const entradaBusqueda   = document.getElementById('entradaBusqueda');
const contenedorProductos = document.getElementById('contenedor-productos');
const botonLimpiar      = document.getElementById('botonLimpiar');

const isAdminUser     = document.body.getAttribute('data-is-admin-user') === 'true';
const isUserLoggedIn  = document.body.getAttribute('data-is-user-logged-in') === 'true';

let lastLogAt = 0; // debounce para analytics

/* =================== Analytics helpers =================== */
function logBusquedaTexto(q, origen = 'texto') {
  if (!q || q.length < 3) return;
  fetch('/analytics/busquedas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, origen })
  }).catch(() => {});
}
function logBusquedaProducto(producto_id, qActual) {
  if (!producto_id) return;
  fetch('/analytics/busqueda-producto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ producto_id: Number(producto_id), q: qActual || null })
  }).catch(() => {});
}

/* ================ Carga inicial sin filtros ================= */
window.onload = async () => {
  try {
    const respuesta = await fetch('/productos/api/buscar');
    productosOriginales = await respuesta.json();
  } catch (e) {
    console.error('Error precargando productos:', e);
  }
};

/* ============== Delegado clicks en cards (1 sola vez) ============== */
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

  const qActual = (entradaBusqueda?.value || '').trim();
  logBusquedaProducto(productoId, qActual);
}, { passive: true });

/* =================== Botón limpiar =================== */
if (botonLimpiar) {
  entradaBusqueda.addEventListener('input', () => {
    botonLimpiar.style.display = entradaBusqueda.value.trim() !== '' ? 'block' : 'none';
  });
  botonLimpiar.addEventListener('click', () => {
    entradaBusqueda.value = '';
    botonLimpiar.style.display = 'none';
    contenedorProductos.innerHTML = '';
  });
}

/* ============== Búsqueda con debounce + log texto ============== */
entradaBusqueda.addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value.trim();

    const now = Date.now();
    if (busqueda.length >= 3 && (now - lastLogAt > 1200)) {
      lastLogAt = now;
      logBusquedaTexto(busqueda, 'texto');
    }

    contenedorProductos.innerHTML = '';

    if (busqueda) {
      try {
        const url = `/productos/api/buscar?q=${encodeURIComponent(busqueda)}`;
        const respuesta = await fetch(url);
        const productos = await respuesta.json();
        mostrarProductos(productos);
      } catch (err) {
        console.error('Error en búsqueda:', err);
      }
    }
  }, 300);
});

/* ================== Render de resultados ================== */
function mostrarProductos(productos) {
  contenedorProductos.innerHTML = '';

  if (!Array.isArray(productos) || productos.length === 0) {
    const contenedorVacio = document.createElement('div');
    contenedorVacio.className = 'no-result';
    contenedorVacio.innerHTML = `
      <img src="/images/noEncontrado.png" alt="Producto no encontrado" class="imagen-no-result">
      <p>No se encontraron productos. Probá con otros filtros o palabras clave.</p>
    `;
    contenedorProductos.appendChild(contenedorVacio);
    return;
  }

  productos.forEach((producto, index) => {
    const card = document.createElement('div');
    card.className = `
      card 
      ${producto.calidad_original ? 'calidad-original-fitam' : ''} 
      ${producto.calidad_vic ? 'calidad_vic' : ''} 
      ${producto.oferta ? 'producto-oferta' : ''}
    `;
    card.setAttribute(
      'data-label',
      producto.oferta ? 'OFERTA'
        : producto.calidad_original ? 'CALIDAD FITAM'
        : producto.calidad_vic ? 'CALIDAD VIC'
        : ''
    );

    // datasets clave para simulación/rotación
    card.dataset.productoId          = producto.id;
    card.dataset.precioVenta         = producto.precio_venta;
    card.dataset.proveedorAsignadoId = producto.proveedor_id || ''; // si no viene, se hace fallback por nombre

    // Galería
    const imagenesHTML = (producto.imagenes || [])
      .map((imagen, i) => `
        <img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${imagen.imagen}" alt="${producto.nombre}">
      `)
      .join('');

    // Info stock / acciones
    let stockInfo = '';
    if (isUserLoggedIn) {
      if (isAdminUser) {
        stockInfo = `
          <div class="stock-producto ${producto.stock_actual >= producto.stock_minimo ? 'suficiente-stock' : 'bajo-stock'}">
            <p>Stock Disponible: ${producto.stock_actual}</p>
          </div>
          <div class="cantidad-producto">
            <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
          </div>
        `;
      } else {
        stockInfo = `
          <div class="semaforo-stock">
            <i class="fa-solid fa-thumbs-${producto.stock_actual >= producto.stock_minimo ? 'up verde' : 'down rojo'}"></i>
            <span class="texto-semaforo">
              ${producto.stock_actual >= producto.stock_minimo
                ? 'PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA'
                : 'PRODUCTO PENDIENTE DE INGRESO O A PEDIDO'}
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
        `;
      }
    }

    // Bloque admin (proveedor/código + botón + simulación)
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
        <p class="prov-simulacion" data-producto-id="${producto.id}" style="margin-top:6px;font-weight:700;"></p>
      </div>
    ` : '';

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
      <div class="categoria-producto"><h6 class="categoria">${producto.categoria_nombre || 'Sin categoría'}</h6></div>
      <div class="precio-producto"><p class="precio">$${formatearNumero(producto.precio_venta || 0)}</p></div>

      ${adminProveedorHTML}
      ${stockInfo}

      <div class="acciones-compartir">
        <a href="https://wa.me/543513820440?text=QUIERO CONSULTAR POR ESTE PRODUCTO: https://www.autofaros.com.ar/productos/${producto.id}" 
           title="Consultar por WhatsApp" target="_blank" class="whatsapp">
          <i class="fab fa-whatsapp"></i>
        </a>
        <a href="https://www.facebook.com/profile.php?id=100063665395970" 
           title="Visitar Facebook" target="_blank" class="facebook">
          <i class="fab fa-facebook"></i>
        </a>
        <a href="https://www.instagram.com/autofaros_cordoba" 
           title="Visitar Instagram" target="_blank" class="instagram">
          <i class="fab fa-instagram"></i>
        </a>
      </div>
    `;

    contenedorProductos.appendChild(card);

    // Validación de cantidad (solo usuarios comunes logueados)
    if (!isAdminUser && isUserLoggedIn) {
      const botonAgregar   = card.querySelector('.agregar-carrito');
      const inputCantidad  = card.querySelector('.cantidad-input');
      const stockDisponible = parseInt(producto.stock_actual);

      botonAgregar.addEventListener('click', (e) => {
        e.preventDefault();

        const cantidad = parseInt(inputCantidad.value);

        if (!inputCantidad.value || isNaN(cantidad) || cantidad <= 0) {
          Swal.fire({
            icon: 'error',
            title: 'Cantidad inválida',
            text: 'Debes ingresar una cantidad mayor a 0 para continuar.',
          });
          return;
        }

        if (cantidad > stockDisponible) {
          Swal.fire({
            icon: 'warning',
            title: 'Cantidades no disponibles',
            text: 'Si deseas más unidades comunicate con nosotros 3513820440',
          });
          inputCantidad.value = stockDisponible;
          return;
        }

        const eventoAgregar = new CustomEvent('agregarAlCarritoDesdeBuscador', {
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

    // Inicializaciones proveedor por producto
    _inicializarProveedorActual(producto);
    _initProveedorButton(producto.id);
  });
}

/* =================== Carrusel =================== */
function moverCarrusel(index, direccion) {
  const carousel = document.getElementById(`carousel-${index}`);
  const imagenes = carousel.querySelectorAll('.carousel__image');
  let activa = [...imagenes].findIndex(img => !img.classList.contains('hidden'));

  imagenes[activa].classList.add('hidden');
  activa = (activa + direccion + imagenes.length) % imagenes.length;
  imagenes[activa].classList.remove('hidden');
}

/* =================== Helpers numéricos =================== */
function formatearNumero(num) {
  return Math.floor(Number(num) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function toNumberSafe(v) {
  if (v == null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;

  let s = String(v).trim();

  // 1.234,56  ->  1234.56
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.'); // 1234,56 -> 1234.56
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/* =========================================================
   LÓGICA: “Siguiente proveedor” + simulación de precio
   ========================================================= */

// Orden auxiliar por costo ascendente (usa costo_iva numérico)
function _sortedIdxByCosto(lista){
  return lista
    .map((p, i) => ({ i, c: toNumberSafe(p.costo_iva) }))
    .sort((a,b) => a.c - b.c)
    .map(x => x.i);
}

// Cache por producto: { lista, idx, first, baseIdx }
const _cacheProveedores = new Map();

async function _getOrInitState(productoId){
  let state = _cacheProveedores.get(productoId);
  if (state) return state;

  const r     = await fetch(`/productos/api/proveedores/${productoId}`);
  const lista = await r.json();
  state = { lista: Array.isArray(lista) ? lista : [], idx: 0, first: true, baseIdx: 0 };

  if (state.lista.length) {
    // Detectar proveedor asignado (por ID si vino; si no, por nombre de la card)
    const provSpan = document.querySelector(`.prov-nombre[data-producto-id="${productoId}"]`);
    const cardEl   = provSpan ? provSpan.closest('.card') : null;
    const asignadoId = Number(cardEl?.dataset?.proveedorAsignadoId || 0);

    if (asignadoId) {
      const byId = state.lista.findIndex(p => Number(p.id) === asignadoId);
      if (byId >= 0) {
        state.baseIdx = byId;
        state.idx     = byId;
      } else {
        const nombreAsignado = (provSpan?.textContent || '').trim();
        const byName = state.lista.findIndex(p => (p.proveedor_nombre || '').trim() === nombreAsignado);
        state.baseIdx = byName >= 0 ? byName : 0;
        state.idx     = state.baseIdx;
      }
    } else {
      const nombreAsignado = (provSpan?.textContent || '').trim();
      const byName = state.lista.findIndex(p => (p.proveedor_nombre || '').trim() === nombreAsignado);
      state.baseIdx = byName >= 0 ? byName : 0;
      state.idx     = state.baseIdx;
    }
  }

  _cacheProveedores.set(productoId, state);
  return state;
}

function _renderProveedor(productoId, data) {
  const spanNombre = document.querySelector(`.prov-nombre[data-producto-id="${productoId}"]`);
  const spanCodigo = document.querySelector(`.prov-codigo[data-producto-id="${productoId}"]`);
  const smallIdx   = document.querySelector(`.prov-idx[data-producto-id="${productoId}"]`);
  if (spanNombre) spanNombre.textContent = data?.proveedor_nombre || 'Sin proveedor';
  if (spanCodigo) spanCodigo.textContent = data?.codigo || '-';
  if (smallIdx) {
    const st = _cacheProveedores.get(productoId);
    const pos   = (st?.idx ?? 0) + 1;
    const total = st?.lista?.length || 0;
    smallIdx.textContent = total > 0 ? `Mostrando ${pos} de ${total}` : '';
  }
}

function _renderSimulacion(productoId, precioVentaSimulado){
  const nodo = document.querySelector(`.prov-simulacion[data-producto-id="${productoId}"]`);
  if (!nodo) return;
  if (Number.isFinite(precioVentaSimulado) && precioVentaSimulado > 0) {
    nodo.textContent = `Precio venta: $${formatearNumero(precioVentaSimulado)}`;
  } else {
    nodo.textContent = '';
  }
}

function _inicializarProveedorActual(producto) {
  if (!isAdminUser) return;
  const st = _cacheProveedores.get(producto.id);
  if (!st || !st.lista?.length) return;

  const actualNombre = (document.querySelector(`.prov-nombre[data-producto-id="${producto.id}"]`)?.textContent || '').trim();
  const idx = st.lista.findIndex(p => (p.proveedor_nombre || '').trim() === actualNombre);
  st.idx = idx >= 0 ? idx : st.idx;
  _cacheProveedores.set(producto.id, st);
  _renderProveedor(producto.id, st.lista[st.idx]);
}

async function _initProveedorButton(productoId){
  if (!isAdminUser) return;
  const btn = document.querySelector(`.btn-siguiente-proveedor[data-producto-id="${productoId}"]`);
  if (!btn) return;
  const st = await _getOrInitState(productoId);
  if (!st.lista || st.lista.length < 2){
    btn.style.display = 'none';
  }
}

/* ============ Listener: botón “Siguiente proveedor” (admins) ============ */
contenedorProductos.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.btn-siguiente-proveedor');
  if (!btn || !isAdminUser) return;

  const productoId = Number(btn.dataset.productoId);
  if (!productoId) return;

  const cardEl = btn.closest('.card');
  const precioVentaOriginal = toNumberSafe(cardEl?.dataset?.precioVenta);

  const st = await _getOrInitState(productoId);
  if (!st.lista || !st.lista.length) {
    Swal.fire({ icon:'info', title:'Sin proveedores', text:'Este producto no tiene proveedores cargados.' });
    return;
  }
  if (st.lista.length < 2) {
    btn.style.display = 'none';
    return;
  }

  // Elegir siguiente índice (1er clic: ir al más barato/segundo más barato según base)
  let nextIdx;
  if (st.first) {
    const orden = _sortedIdxByCosto(st.lista);
    const cheapestIdx = orden[0];
    const secondIdx   = orden[1] ?? cheapestIdx;
    nextIdx = (st.baseIdx === cheapestIdx) ? secondIdx : cheapestIdx;
    st.first = false;
  } else {
    nextIdx = (st.idx + 1) % st.lista.length;
  }

  // Actualizar estado y render
  st.idx = nextIdx;
  _cacheProveedores.set(productoId, st);

  const provNuevo = st.lista[st.idx];
  _renderProveedor(productoId, provNuevo);

  // Simulación: mantener el MARKUP de la base sobre costo_iva actual
  const costoAsignado = toNumberSafe(st.lista[st.baseIdx]?.costo_iva);
  const costoNuevo    = toNumberSafe(provNuevo?.costo_iva);

  if (costoAsignado > 0 && costoNuevo > 0 && precioVentaOriginal > 0) {
    const markup = precioVentaOriginal / costoAsignado; // factor margen (utilidad + posibles ajustes previos)
    const precioSimulado = Math.round(markup * costoNuevo);

    // Si volvimos a la base, no mostramos simulación
    _renderSimulacion(productoId, st.idx === st.baseIdx ? null : precioSimulado);
  } else {
    _renderSimulacion(productoId, null);
  }

  // Importante: NO tocar el precio principal de la card; sólo mostramos simulación.
}, { passive: true });
