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
function _sortedIdxByCosto(lista){
  const withCost = [], noCost = [];
  lista.forEach((p, i) => {
    const c = toNumberSafe(p.costo_iva);
    (c > 0 ? withCost : noCost).push({ i, c });
  });
  withCost.sort((a,b) => a.c - b.c);
  return [...withCost.map(x => x.i), ...noCost.map(x => x.i)];
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

    // === Datasets clave para simulación/detección de base ===
    card.dataset.productoId = producto.id;
    card.dataset.precioVenta = producto.precio_venta;
    card.dataset.proveedorAsignadoId = producto.proveedor_id || ''; // ID asignado
    card.dataset.utilidad = (producto.utilidad ?? 0);               // utilidad cruda (30, "30", "0,30", etc.)

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

    _initProveedorButton(producto.id); // obtiene y fija base/orden/ordenCycle
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
function toNumberSafe(v) {
  if (v == null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;

  let s = String(v).trim();

  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  s = s.replace(/%/g, '');

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// utilidad 0..100; admite “0,30” → 30
function _getUtilidadDeCard(cardEl) {
  let u = toNumberSafe((cardEl?.dataset?.utilidad ?? '').toString().trim());
  if (u > 0 && u < 1) u = u * 100;
  if (u < 0) u = 0;
  if (u > 100) u = 100;
  return u;
}

// redondeo a centenar (mismo criterio que editar.js)
function _redondearAlCentenar(valor) {
  const n = toNumberSafe(valor);
  const resto = n % 100;
  return (resto < 50) ? (n - resto) : (n + (100 - resto));
}

// ============== Normalizador de proveedores ==============
function _normalizeProviders(listaRaw) {
  if (!Array.isArray(listaRaw)) return [];
  return listaRaw.map(p => {
    const codigo = p.codigo ?? p.codigo_proveedor ?? p.cod_proveedor ?? p.codigoProveedor ?? p.cod ?? '-';
    const provId = (p.id != null ? p.id : p.proveedor_id);
    const nombre = p.proveedor_nombre ?? p.nombre_proveedor ?? p.nombre ?? p.proveedor ?? '';

    // costo con IVA directo
    const costoIVAkeys = [
      'costo_iva','costoIva','costo_con_iva','precio_costo_con_iva','precioCostoConIva',
      'costo_final','costoConIva','precioConIva'
    ];
    const costoNetoKeys = ['costo_neto','costoNeto','precio_costo_neto','precioCostoNeto','costo'];
    const ivaKeys = ['iva','iva_porcentaje','iva_porcent','ivaPercent','alicuota_iva'];

    let costoIva = 0;
    for (const k of costoIVAkeys) if (p[k] != null) { costoIva = toNumberSafe(p[k]); break; }

    // reconstrucción si falta
    if (!costoIva || costoIva <= 0) {
      let neto = 0, iva = 0;
      for (const k of costoNetoKeys) if (p[k] != null) { neto = toNumberSafe(p[k]); break; }
      for (const k of ivaKeys)      if (p[k] != null) { iva  = toNumberSafe(p[k]); break; }
      if (iva > 0 && iva < 1) iva = iva * 100;
      if (neto > 0) costoIva = neto * (1 + (iva/100));
    }

    return {
      ...p,
      proveedor_id_norm: Number(provId) || null,
      proveedor_nombre: nombre,
      codigo,
      costo_iva: toNumberSafe(costoIva)
    };
  });
}

/* =========================
   Siguiente proveedor (estado por producto)
   ========================= */

// productoId -> { lista, baseIdx, cycle, pos }
const _cacheProveedores = new Map();

async function _getOrInitState(productoId){
  let st = _cacheProveedores.get(productoId);
  if (st) return st;

  const r = await fetch(`/productos/api/proveedores/${productoId}`);
  let lista = await r.json();
  lista = _normalizeProviders(lista);

  st = { lista, baseIdx: 0, cycle: [], pos: 0 };

  if (lista.length) {
    // hallar base por ID asignado; si no, por nombre renderizado en la card
    const provSpan = document.querySelector(`.prov-nombre[data-producto-id="${productoId}"]`);
    const cardEl   = provSpan ? provSpan.closest('.card') : null;
    const asignadoId = Number(cardEl?.dataset?.proveedorAsignadoId || cardEl?.dataset?.proveedorAsignadoid || 0);

    if (asignadoId) {
      const byId = lista.findIndex(p => Number(p.proveedor_id_norm) === asignadoId);
      st.baseIdx = byId >= 0 ? byId : 0;
    } else {
      const nombreAsignado = (provSpan?.textContent || '').trim();
      const byName = lista.findIndex(p => (p.proveedor_nombre || '').trim() === nombreAsignado);
      st.baseIdx = byName >= 0 ? byName : 0;
    }

    // orden por costo ascendente; el ciclo es: [base, ...resto]
    const orden = _sortedIdxByCosto(lista);
    const resto = orden.filter(i => i !== st.baseIdx);
    st.cycle = [st.baseIdx, ...resto];
    st.pos = 0; // pos=0 => asignado (lo que ya muestra la card SSR)
  }

  _cacheProveedores.set(productoId, st);
  return st;
}

function _renderProveedor(productoId, data) {
  const spanNombre = document.querySelector(`.prov-nombre[data-producto-id="${productoId}"]`);
  const spanCodigo = document.querySelector(`.prov-codigo[data-producto-id="${productoId}"]`);
  const smallIdx   = document.querySelector(`.prov-idx[data-producto-id="${productoId}"]`);
  if (spanNombre) spanNombre.textContent = data?.proveedor_nombre || 'Sin proveedor';
  if (spanCodigo) spanCodigo.textContent = data?.codigo || '-';
  if (smallIdx) {
    const st = _cacheProveedores.get(productoId);
    smallIdx.textContent = (st && st.cycle.length) ? `Mostrando ${st.pos + 1} de ${st.cycle.length}` : '';
  }
}

function _renderSimulacion(productoId, precio){
  const nodo = document.querySelector(`.prov-simulacion[data-producto-id="${productoId}"]`);
  if (!nodo) return;
  nodo.textContent = (Number.isFinite(precio) && precio > 0)
    ? `Precio venta: $${formatearNumero(precio)}`
    : '';
}

// precio exacto desde costo_iva + utilidad (%), redondeado a centenar
function _precioVentaDesde(prov, utilidadPct){
  let costo = toNumberSafe(prov?.costo_iva);
  if (!costo || costo <= 0) {
    const neto = toNumberSafe(prov?.costo_neto ?? prov?.costo ?? 0);
    let iva    = toNumberSafe(prov?.iva ?? prov?.iva_porcentaje ?? 0);
    if (iva > 0 && iva < 1) iva = iva * 100;
    if (neto > 0) costo = neto * (1 + iva/100);
  }
  if (!costo || costo <= 0) return null;

  let u = toNumberSafe(utilidadPct);
  if (u > 0 && u < 1) u = u * 100;
  if (u < 0) u = 0;
  if (u > 100) u = 100;

  const bruto = costo * (1 + (u/100));
  return _redondearAlCentenar(bruto);
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

contenedorProductos.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.btn-siguiente-proveedor');
  if (!btn || !isAdminUser) return;

  const productoId = Number(btn.dataset.productoId);
  if (!productoId) return;

  const cardEl = btn.closest('.card');
  // toma utilidad también de SSR (productos.ejs)
  const utilidad = cardEl ? (cardEl.dataset.utilidad ?? 0) : 0;

  const st = await _getOrInitState(productoId);
  if (!st.lista || !st.cycle || st.cycle.length < 2) {
    btn.style.display = 'none';
    return;
  }

  // avanzar en el ciclo: de base→siguiente→siguiente...
  st.pos = (st.pos + 1) % st.cycle.length;
  const idx = st.cycle[st.pos];
  const prov = st.lista[idx];

  _cacheProveedores.set(productoId, st);

  _renderProveedor(productoId, prov);

  // si estoy parado en asignado (pos=0), no muestro simulación
  if (st.pos === 0) {
    _renderSimulacion(productoId, null);
  } else {
    const precio = _precioVentaDesde(prov, utilidad);
    _renderSimulacion(productoId, precio);
  }
}, { passive: true });
