let productosOriginales = [];
let timer;

const entradaBusqueda = document.getElementById('entradaBusqueda');
const contenedorProductos = document.getElementById('contenedor-productos');
const botonLimpiar = document.getElementById('botonLimpiar');

const isAdminUser = document.body.getAttribute('data-is-admin-user') === 'true';
const isUserLoggedIn = document.body.getAttribute('data-is-user-logged-in') === 'true';

let lastLogAt = 0; // debounce para analytics

// ===== Analytics helpers =====
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

// ===== Carga inicial =====
window.onload = async () => {
  const respuesta = await fetch('/productos/api/buscar');
  productosOriginales = await respuesta.json();
};

// ===== Listener delegado de clicks en cards (UNA sola vez) =====
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

  const qActual = (entradaBusqueda?.value || '').trim();
  logBusquedaProducto(productoId, qActual);
}, { passive: true });

// ===== Botón limpiar (UNA sola vez) =====
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

// ===== Búsqueda con debounce + log texto =====
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
      const url = `/productos/api/buscar?q=${encodeURIComponent(busqueda)}`;
      const respuesta = await fetch(url);
      const productos = await respuesta.json();
      mostrarProductos(productos);
    }
  }, 300);
});

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
    // Guardar precio de venta original para simulación/restauración
    card.dataset.precioVenta = producto.precio_venta;

    let imagenesHTML = '';
    (producto.imagenes || []).forEach((imagen, i) => {
      imagenesHTML += `
        <img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${imagen.imagen}" alt="${producto.nombre}">
      `;
    });

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
              ${producto.stock_actual >= producto.stock_minimo ? 'PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA' : 'PRODUCTO PENDIENTE DE INGRESO O A PEDIDO'}
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

     ${isAdminUser ? `
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
      ` : ''}

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
      const botonAgregar = card.querySelector('.agregar-carrito');
      const inputCantidad = card.querySelector('.cantidad-input');
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

    // Inicializaciones proveedor
    _inicializarProveedorActual(producto);
    _initProveedorButton(producto.id);
  });
}

function moverCarrusel(index, direccion) {
  const carousel = document.getElementById(`carousel-${index}`);
  const imagenes = carousel.querySelectorAll('.carousel__image');
  let activa = [...imagenes].findIndex(img => !img.classList.contains('hidden'));

  imagenes[activa].classList.add('hidden');
  activa = (activa + direccion + imagenes.length) % imagenes.length;
  imagenes[activa].classList.remove('hidden');
}

function formatearNumero(num) {
  return Math.floor(Number(num) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ============== Helpers numéricos ==============
function toNumberSafe(v){
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  // convertir "1.234,56" o "1234,56" -> 1234.56
  const s = String(v).replace(/\./g,'').replace(',', '.').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/* =========================
   Siguiente proveedor (con base asignada)
   ========================= */

// productoId -> { lista: [], idx: number, first: true, baseIdx: number }
const _cacheProveedores = new Map();

async function _getOrInitState(productoId){
  let state = _cacheProveedores.get(productoId);
  if (state) return state;

  const r = await fetch(`/productos/api/proveedores/${productoId}`);
  const lista = await r.json();
  state = { lista: Array.isArray(lista) ? lista : [], idx: 0, first: true, baseIdx: 0 };

  // Si hay lista, detectar el proveedor ASIGNADO (el que se muestra al render inicial)
  if (state.lista.length) {
    const nombreAsignado = (document.querySelector(`.prov-nombre[data-producto-id="${productoId}"]`)?.textContent || '').trim();
    const found = state.lista.findIndex(p => (p.proveedor_nombre || '').trim() === nombreAsignado);
    state.baseIdx = found >= 0 ? found : 0; // si no matchea, por defecto 0
    state.idx = state.baseIdx;
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
    const pos = (st?.idx ?? 0) + 1;
    const total = st?.lista?.length || 0;
    smallIdx.textContent = total > 0 ? `Mostrando ${pos} de ${total}` : '';
  }
}

function _renderSimulacion(productoId, precio){
  const nodo = document.querySelector(`.prov-simulacion[data-producto-id="${productoId}"]`);
  if (!nodo) return;
  if (precio && Number.isFinite(precio)) {
    nodo.textContent = `Precio venta simulado: $${formatearNumero(precio)}`;
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

// Delegado de click SOLO para “Siguiente proveedor”
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

  // Primer click: saltar al proveedor MÁS BARATO
  if (st.first) {
    let cheapestIdx = 0;
    for (let i = 1; i < st.lista.length; i++) {
      if (toNumberSafe(st.lista[i].costo_iva) < toNumberSafe(st.lista[cheapestIdx].costo_iva)) {
        cheapestIdx = i;
      }
    }
    st.idx = cheapestIdx;
    st.first = false;
  } else {
    // Resto: rotación cíclica
    st.idx = (st.idx + 1) % st.lista.length;
  }

  _cacheProveedores.set(productoId, st);

  // Render proveedor elegido
  const provNuevo = st.lista[st.idx];
  _renderProveedor(productoId, provNuevo);

  // Calcular simulación usando SIEMPRE el proveedor ASIGNADO como base
  const costoAsignado = toNumberSafe(st.lista[st.baseIdx]?.costo_iva);
  const costoNuevo = toNumberSafe(provNuevo?.costo_iva);

  if (costoAsignado > 0 && costoNuevo > 0 && precioVentaOriginal > 0) {
    const markup = precioVentaOriginal / costoAsignado;
    const precioSimulado = Math.round(markup * costoNuevo);

    // Actualizar precio visible en la card
    const precioNode = cardEl.querySelector('.precio-producto .precio');
    if (precioNode) {
      // Si volvemos al proveedor base, restauramos el precio original
      if (st.idx === st.baseIdx) {
        precioNode.textContent = `$${formatearNumero(precioVentaOriginal)}`;
        _renderSimulacion(productoId, null);
      } else {
        precioNode.textContent = `$${formatearNumero(precioSimulado)}`;
        _renderSimulacion(productoId, precioSimulado);
      }
    }
  } else {
    // No se puede simular con datos incompletos
    _renderSimulacion(productoId, null);
  }
}, { passive: true });
