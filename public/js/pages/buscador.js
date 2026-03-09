/* ==========================================
   DEBUG helpers
========================================== */
const DBG = true; // poné false para silenciar logs
function dbg(...args){ if(DBG) console.log(...args); }
function dbgTable(obj){ if(DBG && obj) console.table(obj); }

console.log("[AF] buscador.js cargado v2026-01-07b");

// === Override de IVA por proveedor (si el endpoint no lo manda) ===
// clave: nombre EXACTO que viene en proveedor_nombre del endpoint
const IVA_PROVIDER_OVERRIDE = {
  'DISTRIMAR': 10.5,
  'DISTRIMAR OFERTAS': 10.5,
  'DM LAMPARAS': 10.5,
  // Agregá acá otros que correspondan...
};

/* ==========================================
   Estado global / selectors
========================================== */
let productosOriginales = [];
let timer;

const entradaBusqueda = document.getElementById('entradaBusqueda');
const contenedorProductos = document.getElementById('contenedor-productos');
const botonLimpiar = document.getElementById('botonLimpiar');


const CAN_INIT = !!(entradaBusqueda && contenedorProductos);
const isAdminUser = document.body.getAttribute('data-is-admin-user') === 'true';
const isUserLoggedIn = document.body.getAttribute('data-is-user-logged-in') === 'true';

let lastLogAt = 0; // debounce para analytics

/* ==========================================
   Analytics helpers
========================================== */
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
    body: JSON.stringify({
      producto_id: Number(producto_id),
      q: qActual || null
    })
  }).catch(() => {});
}

/* ==========================================
   Helpers numéricos / formato
========================================== */
function toNumberSafe(v) {
  if (v == null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;

  let s = String(v).trim();

  // Caso 1.234,56 => 1234.56
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  s = s.replace(/%/g, '');

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function formatearNumero(num) {
  return Math.floor(Number(num) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function _getUtilidadDeCard(cardEl) {
  let u = toNumberSafe((cardEl?.dataset?.utilidad ?? '').toString().trim());
  if (u > 0 && u < 1) u = u * 100;  // admitir 0,30 -> 30
  if (u < 0) u = 0;
  if (u > 100) u = 100;
  return u;
}

// redondeo a centenar (como en editar.js)
function _redondearAlCentenar(valor) {
  const n = Math.round(toNumberSafe(valor));
  const resto = n % 100;
  return (resto < 50) ? (n - resto) : (n + (100 - resto));
}

/* ==========================================
   Detección flexible de claves
   (solo para encontrar el "Precio de costo con IVA" real)
========================================== */
function _pickKeyCI(obj, candidates) {
  const map = {};
  for (const k of Object.keys(obj || {})) map[k.toLowerCase()] = k;
  for (const alias of candidates) {
    const k = map[alias.toLowerCase()];
    if (k != null && obj[k] != null) return obj[k];
  }
  return undefined;
}
function _normalizeProviders(listaRaw) {
  if (!Array.isArray(listaRaw)) return [];

  const EXACT_FIRST = [
    'precio_costo_con_iva','precioCostoConIva','precioCostoConIVA',
    'costo_iva','costoIva',
    'costo_con_iva','costoConIva',
    'costo_final','costoFinal','costo_final_con_iva','costoFinalConIva'
  ];
  const IVA_KEYS = ['iva','iva_porcentaje','porcentaje_iva','alicuotaIva','alicuota_iva'];
  const PRECIO_LISTA_KEYS = ['precio_lista','precioLista','lista'];
  const DESC_KEYS = ['descuento','dto','descu','desc'];
  const COD_KEYS = ['codigo','codigo_proveedor','cod','codigoProveedor','cod_proveedor'];
  const NOMBRE_PROV_KEYS = ['proveedor_nombre','nombre_proveedor','proveedor','nombre'];

  function pickExact(obj, aliases) {
    const map = {};
    for (const k of Object.keys(obj || {})) map[k.toLowerCase()] = k;
    for (const a of aliases) {
      const real = map[a.toLowerCase()];
      if (real != null && obj[real] != null) return obj[real];
    }
    return undefined;
  }

  function pickCostoIvaDirect(obj) {
    const keys = Object.keys(obj || {});
    for (const kPref of EXACT_FIRST) {
      const real = keys.find(k => k.toLowerCase() === kPref.toLowerCase());
      if (real && obj[real] != null) return obj[real];
    }
    for (const k of keys) {
      const lk = k.toLowerCase();
      if (lk.includes('costo') && lk.includes('iva')) return obj[k];
    }
    return undefined;
  }

  function toNumberSafePlus(v) {
    if (v == null) return 0;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    let s = String(v).trim();
    if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    s = s.replace(/%/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  return (listaRaw || []).map((p, idx) => {
    const nombreProv = String(pickExact(p, NOMBRE_PROV_KEYS) ?? '').trim();
    const costoIvaBack = toNumberSafePlus(pickCostoIvaDirect(p));

    // Reconstrucción de NETO desde lista + descuento (si existen)
    const precioLista = toNumberSafePlus(pickExact(p, PRECIO_LISTA_KEYS));
    let descPct = toNumberSafePlus(pickExact(p, DESC_KEYS)); // viene 60 o "60.00"
    if (descPct > 0 && descPct < 1.5) descPct = descPct * 100; // por las dudas
    const netoRecon = (precioLista > 0)
      ? Math.round(precioLista * (1 - (descPct || 0) / 100))
      : 0;

    // IVA: prioridad: campo iva → override → inferencia desde costo_iva_back
    let ivaPct = toNumberSafePlus(pickExact(p, IVA_KEYS));
    if (ivaPct > 0 && ivaPct < 1.5) ivaPct = ivaPct * 100; // 0.105 -> 10.5
    if (!(ivaPct > 0)) {
      const override = IVA_PROVIDER_OVERRIDE[nombreProv];
      if (override) ivaPct = override;
    }
    if (!(ivaPct > 0) && netoRecon > 0 && costoIvaBack > 0) {
      const factor = costoIvaBack / netoRecon;
      const infer = (factor - 1) * 100; // p.ej. ≈ 21
      ivaPct = Math.round(infer * 10) / 10; // redondeo a 0,1
      console.warn(`ℹ️ IVA inferido desde backend para "${nombreProv}": ${ivaPct}% (usando costo_iva_back / netoRecon)`);
    }

    // Reconstrucción del costo con IVA con lo que tengamos
    let costoIvaRecon = 0;
    if (netoRecon > 0 && ivaPct >= 0) {
      costoIvaRecon = Math.round(netoRecon * (1 + (ivaPct || 0) / 100));
    }

    // Preferimos el reconstruido si es válido
    let costoIva = (costoIvaRecon > 0) ? costoIvaRecon : costoIvaBack;

    const provId = (p.id != null ? p.id : p.proveedor_id);
    const codigo = pickExact(p, COD_KEYS);

    // Diagnóstico
    const delta = Math.abs((costoIvaBack || 0) - (costoIvaRecon || 0));
    console.groupCollapsed(`🔎 Proveedor#${idx} ${nombreProv} — DIAGNÓSTICO IVA`);
    console.table([{
      precioLista, descPct, netoRecon, ivaPct,
      costoIvaBack, costoIvaRecon, usadoParaCalculo: costoIva
    }]);
    if (costoIvaBack > 0 && costoIvaRecon > 0 && delta >= 2) {
      console.warn('⚠️ MISMATCH backend vs reconstruido (>= $2). Se usará el reconstruido.');
    }
    console.groupEnd();

    return {
      ...p,
      proveedor_id_norm: Number(provId) || null,
      proveedor_nombre: nombreProv,
      codigo: String(codigo ?? '-').trim(),
      costo_iva: toNumberSafePlus(costoIva)
    };
  });
}

/* ==========================================
   Orden por costo (asc)
========================================== */
function _sortedIdxByCosto(lista){
  const withCost = [], noCost = [];
  lista.forEach((p, i) => {
    const c = toNumberSafe(p.costo_iva);
    (c > 0 ? withCost : noCost).push({ i, c });
  });
  withCost.sort((a,b) => a.c - b.c);
  return [...withCost.map(x => x.i), ...noCost.map(x => x.i)];
}

/* ==========================================
   Estado/rotación por producto
========================================== */
const _cacheProveedores = new Map();

async function _getOrInitState(productoId){
  let state = _cacheProveedores.get(productoId);
  if (state) return state;

  const r = await fetch(`/productos/api/proveedores/${productoId}`);
  let listaRaw = await r.json();

  dbg('📥 /productos/api/proveedores/', productoId, '=>', Array.isArray(listaRaw) ? listaRaw.length : 0);

  const lista = _normalizeProviders(listaRaw);

  state = { lista, idx: 0, first: true, baseIdx: 0, orden: [], orderCycle: [], cyclePos: -1 };

  if (state.lista.length) {
    const provSpan = document.querySelector(`.prov-nombre[data-producto-id="${productoId}"]`);
    const cardEl = provSpan ? provSpan.closest('.pcard') : null;
    const asignadoId = Number(cardEl?.dataset?.proveedorAsignadoId || 0);

    if (asignadoId) {
      const byId = state.lista.findIndex(p => Number(p.proveedor_id_norm ?? p.id ?? p.proveedor_id) === asignadoId);
      state.baseIdx = byId >= 0 ? byId : 0;
    } else {
      const nombreAsignado = (provSpan?.textContent || '').trim();
      const byName = state.lista.findIndex(p => (p.proveedor_nombre || '').trim() === nombreAsignado);
      state.baseIdx = byName >= 0 ? byName : 0;
    }
    state.idx = state.baseIdx;

    state.orden = _sortedIdxByCosto(state.lista);
    state.orderCycle = state.orden.filter(i => i !== state.baseIdx);
    if (!state.orderCycle.length) state.orderCycle = [state.baseIdx];
    state.cyclePos = -1;

    console.log('🎯 BASE DETECTADA', {
      productoId, baseIdx: state.baseIdx,
      baseNombre: state.lista[state.baseIdx]?.proveedor_nombre,
    });
    dbg('📑 ORDEN', state.orden, ' | CYCLE (sin base):', state.orderCycle);
  }

  _cacheProveedores.set(productoId, state);
  return state;
}

/* ==========================================
   Render helpers
========================================== */
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
  dbg('🖼️ RENDER proveedor', { productoId, proveedor: data?.proveedor_nombre, codigo: data?.codigo });
}

function _renderSimulacion(productoId, precioVentaSimulado){
  const nodo = document.querySelector(`.prov-simulacion[data-producto-id="${productoId}"]`);
  if (!nodo) return;
  if (Number.isFinite(precioVentaSimulado) && precioVentaSimulado > 0) {
    nodo.textContent = `Precio venta: $${formatearNumero(precioVentaSimulado)}`;
  } else {
    nodo.textContent = '';
  }
  dbg('🧾 RENDER precio simulado', { productoId, precioVentaSimulado });
}

/* ==========================================
   UI / Render de productos
========================================== */
if (!CAN_INIT) {
  console.log('[AF] buscador.js: esta vista no tiene #entradaBusqueda / #contenedor-productos. Skip init.');
} else {
  // Guardamos el listado renderizado por el server para poder volver al estado inicial
  const LISTADO_HTML_INICIAL = contenedorProductos.innerHTML;

  const clearUrlQ = () => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('q')) {
        url.searchParams.delete('q');
        const newUrl = url.pathname + (url.search ? url.search : '');
        window.history.replaceState({}, '', newUrl);
      }
    } catch (_) {}
  };

  const restoreListado = () => {
    contenedorProductos.innerHTML = LISTADO_HTML_INICIAL;
    clearUrlQ();
  };

  window.addEventListener('load', async () => {
    const qParam = new URLSearchParams(window.location.search).get('q');
    const q = (qParam || '').trim();

    // Estado inicial del botón limpiar
    if (botonLimpiar) botonLimpiar.style.display = entradaBusqueda.value.trim() ? 'block' : 'none';

    // Si venimos desde el header con ?q=..., ejecutar búsqueda y renderizar
    if (q) {
      entradaBusqueda.value = q;
      if (botonLimpiar) botonLimpiar.style.display = 'block';

      if (q.length >= 3) logBusquedaTexto(q, 'header');

      const url = `/productos/api/buscar?q=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      const productos = await r.json();
      dbg('🔎 /productos/api/buscar (init q) =>', productos?.length, 'items');
      mostrarProductos(productos);
    }
  });

  entradaBusqueda.addEventListener('input', (e) => {
    const raw = (e.target?.value ?? '').toString();
    if (botonLimpiar) botonLimpiar.style.display = raw.trim() ? 'block' : 'none';

    clearTimeout(timer);
    timer = setTimeout(async () => {
      const busqueda = raw.trim();

      const now = Date.now();
      if (busqueda.length >= 3 && (now - lastLogAt > 1200)) {
        lastLogAt = now;
        logBusquedaTexto(busqueda, 'texto');
      }

      if (!busqueda) {
        restoreListado();
        return;
      }

      const url = `/productos/api/buscar?q=${encodeURIComponent(busqueda)}`;
      const respuesta = await fetch(url);
      const productos = await respuesta.json();
      dbg('🔎 /productos/api/buscar =>', productos?.length, 'items');
      mostrarProductos(productos);
    }, 300);
  });

  // Botón limpiar
  if (botonLimpiar) {
    botonLimpiar.addEventListener('click', () => {
      entradaBusqueda.value = '';
      botonLimpiar.style.display = 'none';
      restoreListado();
      entradaBusqueda.focus();
    }, { passive: true });
  }
}

function mostrarProductos(productos) {
  // AF v2026-03-09-fix4 — clases .pcard
  contenedorProductos.innerHTML = '';

  if (!Array.isArray(productos) || productos.length === 0) {
    contenedorProductos.innerHTML = `
      <div class="no-result">
        <img src="/images/noEncontrado.png" alt="Sin resultados" class="no-result__img" />
        <h3 class="no-result__title">Sin resultados</h3>
        <p class="no-result__text">No encontramos productos con esos filtros.<br>Probá con otras palabras clave.</p>
      </div>`;
    return;
  }

  productos.forEach((producto, index) => {
    const esOferta = producto.oferta;
    const esFitam  = producto.calidad_original;
    const esVic    = producto.calidad_vic;

    const stockActualNum = Number(producto.stock_actual) || 0;
    const stockMinNum    = Number(producto.stock_minimo) || 0;
    const puedeComprar   = stockActualNum >= stockMinNum && stockActualNum > 0;

    // Badge
    let badgeHTML = '';
    if (esOferta)     badgeHTML = `<span class="pcard__badge badge--oferta">OFERTA</span>`;
    else if (esFitam) badgeHTML = `<span class="pcard__badge badge--fitam">CALIDAD FITAM</span>`;
    else if (esVic)   badgeHTML = `<span class="pcard__badge badge--vic">CALIDAD VIC</span>`;

    // Imágenes
    const imgsRaw = Array.isArray(producto.imagenes) ? producto.imagenes : [];
    const files = imgsRaw
      .map(x => (typeof x === 'string' ? x : (x?.imagen || x?.archivo || x?.url)))
      .filter(Boolean);
    if (files.length === 0) files.push('');

    const imagenesHTML = files.map((file, i) => {
      const src = file ? `/uploads/productos/${file}` : '/images/noEncontrado.png';
      return `<img class="pcard__img${i !== 0 ? ' hidden' : ''}" src="${src}" alt="${producto.nombre}" onerror="this.src='/images/noEncontrado.png'" loading="lazy">`;
    }).join('');

    const botonesCarousel = files.length > 1 ? `
      <button class="pcard__carousel-btn pcard__carousel-btn--prev" onclick="moverCarrusel('${index}', -1)" aria-label="Anterior"><i class="fas fa-chevron-left"></i></button>
      <button class="pcard__carousel-btn pcard__carousel-btn--next" onclick="moverCarrusel('${index}', 1)" aria-label="Siguiente"><i class="fas fa-chevron-right"></i></button>
      <div class="pcard__dots" id="dots-${index}">
        ${files.map((_, i) => `<span class="pcard__dot${i === 0 ? ' pcard__dot--active' : ''}"></span>`).join('')}
      </div>` : '';

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
          <span class="pcard__admin-val ${stockActualNum < stockMinNum ? 'stock--bajo' : 'stock--ok'}">${stockActualNum}</span>
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
            value="${puedeComprar ? 1 : 0}" min="${puedeComprar ? 1 : 0}" max="${stockActualNum}"
            step="1" id="input-cantidad-${producto.id}" ${puedeComprar ? '' : 'disabled'} aria-label="Cantidad">
          <button type="button" class="qty-btn qty-btn--plus" aria-label="Sumar"><i class="fa-solid fa-plus"></i></button>
        </div>
        <button class="btn-agregar agregar-carrito"
          ${puedeComprar ? '' : 'disabled'}
          data-id="${producto.id}" data-nombre="${producto.nombre}"
          data-precio="${producto.precio_venta}" data-stock="${stockActualNum}" data-stockmin="${stockMinNum}">
          <i class="fa-solid fa-cart-plus"></i>
          <span>${puedeComprar ? 'Agregar al carrito' : 'Sin stock'}</span>
        </button>`;
    }

    // Aplicaciones
    const descAplic = String(producto.descripcion || '').trim();
    const esEscobilla = /escobill/i.test(producto.categoria_nombre || '') || /escobill/i.test(producto.nombre || '');
    const aplicacionesHTML = (esEscobilla && descAplic) ? `
      <button type="button" class="btn-aplicaciones"
        data-titulo="${producto.nombre}"
        data-aplicaciones='${JSON.stringify(descAplic)}'>
        <i class="fa-solid fa-car"></i> <span>Ver aplicaciones</span>
      </button>` : '';

    const card = document.createElement('article');
    card.className = `pcard${esOferta ? ' pcard--oferta' : ''}${esFitam ? ' pcard--fitam' : ''}${esVic ? ' pcard--vic' : ''}`;
    card.dataset.productoId = producto.id;
    card.dataset.precioVenta = producto.precio_venta;
    card.dataset.proveedorAsignadoId = producto.proveedor_id || '';
    card.dataset.utilidad = (producto.utilidad ?? 0);

    card.innerHTML = `
      ${badgeHTML}
      <div class="pcard__media">
        <div class="pcard__carousel" id="carousel-${index}">${imagenesHTML}</div>
        ${botonesCarousel}
      </div>
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
    _initProveedorButton(producto.id);
  });
}


function _escapeHtml(str){
  return String(str ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function mostrarAplicacionesModal(titulo, texto) {
  const contenido = String(texto ?? '').trim();
  if (!contenido) return;

  if (typeof Swal !== 'undefined' && Swal.fire) {
    Swal.fire({
      title: titulo || 'Aplicaciones',
      html: `<pre style="text-align:left;white-space:pre-wrap;max-height:60vh;overflow:auto;margin:0;font-family:inherit;">${_escapeHtml(contenido)}</pre>`,
      width: 900,
      confirmButtonText: 'Cerrar'
    });
  } else {
    alert(contenido);
  }
}

function moverCarrusel(index, direccion) {
  // AF v2026-03-09-fix4 — usa .pcard__img
  const carousel = document.getElementById(`carousel-${index}`);
  if (!carousel) return;

  const imagenes = carousel.querySelectorAll('.pcard__img');
  if (!imagenes.length) return;

  let activa = [...imagenes].findIndex(img => !img.classList.contains('hidden'));
  if (activa < 0) activa = 0;

  imagenes[activa].classList.add('hidden');
  const next = (activa + direccion + imagenes.length) % imagenes.length;
  imagenes[next].classList.remove('hidden');

  // Dots
  const dots = document.getElementById(`dots-${index}`);
  if (dots) {
    dots.querySelectorAll('.pcard__dot').forEach((d, i) => {
      d.classList.toggle('pcard__dot--active', i === next);
    });
  }
}




/* ==========================================
   Init botón "Ver proveedores"
========================================== */
async function _initProveedorButton(productoId){
  if (!isAdminUser) return;
  const btn = document.querySelector(`.btn-ver-proveedores[data-producto-id="${productoId}"]`);
  if (!btn) return;
  const st = await _getOrInitState(productoId);
  // Si solo tiene 0 o 1 proveedor, ocultamos el botón
  if (!st.lista || st.lista.length < 2){
    btn.style.display = 'none';
  }
}

/* ==========================================
   Construye el HTML de las tarjetas del modal
========================================== */
function _buildProveedoresModalHtml(lista, baseIdx, utilidadPct) {
  const u = (utilidadPct || 0) / 100;

  const tarjetas = lista.map((prov, idx) => {
    const esBase = (idx === baseIdx);
    const costoIva = toNumberSafe(prov.costo_iva);
    const precioLista = toNumberSafe(prov.precio_lista ?? prov.precioLista ?? 0);
    const descuento = toNumberSafe(prov.descuento ?? prov.dto ?? 0);
    const iva = toNumberSafe(prov.iva ?? prov.iva_porcentaje ?? prov.alicuotaIva ?? 0);
    const ivaMostrar = iva > 0 && iva < 1.5 ? Math.round(iva * 100) : iva;

    const precioVentaSim = (costoIva > 0 && u >= 0)
      ? _redondearAlCentenar(costoIva * (1 + u))
      : null;

    const badge = esBase
      ? `<span style="background:#16a34a;color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;letter-spacing:.5px;text-transform:uppercase;">★ Proveedor Asignado</span>`
      : `<span style="background:#2563eb;color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;letter-spacing:.5px;text-transform:uppercase;">Alternativa #${idx + 1}</span>`;

    const filas = [];
    if (prov.proveedor_nombre) filas.push(['Proveedor', `<strong>${_escapeHtml(prov.proveedor_nombre)}</strong>`]);
    if (prov.codigo && prov.codigo !== '-') filas.push(['Código', _escapeHtml(prov.codigo)]);
    if (precioLista > 0) filas.push(['Precio lista', `$${formatearNumero(precioLista)}`]);
    if (descuento > 0) filas.push(['Descuento', `${descuento}%`]);
    if (ivaMostrar > 0) filas.push(['IVA', `${ivaMostrar}%`]);
    if (costoIva > 0) filas.push(['Costo c/ IVA', `<strong style="color:#b91c1c;">$${formatearNumero(costoIva)}</strong>`]);
    if (precioVentaSim) filas.push(['Precio venta estimado', `<strong style="color:#1d4ed8;">$${formatearNumero(precioVentaSim)}</strong>`]);

    const filasHtml = filas.map(([label, val]) => `
      <tr>
        <td style="padding:5px 10px 5px 0;color:#6b7280;font-size:12px;white-space:nowrap;vertical-align:top;">${label}</td>
        <td style="padding:5px 0;font-size:13px;font-weight:600;">${val}</td>
      </tr>
    `).join('');

    const bordeColor = esBase ? '#16a34a' : '#2563eb';
    const bgColor = esBase ? '#f0fdf4' : '#eff6ff';

    return `
      <div style="border:2px solid ${bordeColor};border-radius:14px;background:${bgColor};padding:14px 16px;flex:1;min-width:180px;max-width:260px;display:flex;flex-direction:column;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,.07);">
        <div style="margin-bottom:4px;">${badge}</div>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${filasHtml}</tbody>
        </table>
      </div>
    `;
  }).join('');

  return `
    <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:4px 0 8px;">
      ${tarjetas}
    </div>
    <p style="font-size:11px;color:#9ca3af;margin-top:10px;text-align:center;">
      <i class="fas fa-info-circle"></i>
      El precio de venta estimado se calcula aplicando la utilidad configurada en el producto.
    </p>
  `;
}

/* ==========================================
   Listener del botón "Ver proveedores"
========================================== */
if (CAN_INIT) contenedorProductos.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.btn-ver-proveedores');
  if (!btn || !isAdminUser) return;

  const productoId = Number(btn.dataset.productoId);
  if (!productoId) return;

  const cardEl = btn.closest('.pcard');
  const utilidadPct = _getUtilidadDeCard(cardEl);
  const nombreProducto = cardEl?.querySelector('.nombre, h3')?.textContent?.trim() || 'Proveedores';

  const st = await _getOrInitState(productoId);
  if (!st.lista || !st.lista.length) {
    Swal.fire({ icon:'info', title:'Sin proveedores', text:'Este producto no tiene proveedores cargados.' });
    return;
  }

  const htmlModal = _buildProveedoresModalHtml(st.lista, st.baseIdx, utilidadPct);

  Swal.fire({
    title: `<span style="font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:.4px;">Proveedores — ${_escapeHtml(nombreProducto)}</span>`,
    html: htmlModal,
    width: 'min(1000px, 96vw)',
    showCloseButton: true,
    confirmButtonText: 'Cerrar',
    customClass: {
      popup: 'af-apps-modal',
      confirmButton: 'af-apps-confirm'
    }
  });
}, { passive: true });


/* ==========================================
   Delegado de clicks (analytics)
========================================== */
if (CAN_INIT) contenedorProductos.addEventListener('click', (ev) => {
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