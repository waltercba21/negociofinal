/* ==========================================
   DEBUG helpers
========================================== */
const DBG = true; // poné false para silenciar logs
function dbg(...args){ if(DBG) console.log(...args); }
function dbgTable(obj){ if(DBG && obj) console.table(obj); }

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
// productoId -> { lista, baseIdx, idx, first, orden, orderCycle, cyclePos }
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
    // Buscar card para obtener el proveedor asignado por ID (SSR)
    const provSpan = document.querySelector(`.prov-nombre[data-producto-id="${productoId}"]`);
    const cardEl = provSpan ? provSpan.closest('.card') : null;
    const asignadoId = Number(cardEl?.dataset?.proveedorAsignadoId || 0);

    // localizar baseIdx
    if (asignadoId) {
      const byId = state.lista.findIndex(p => Number(p.proveedor_id_norm ?? p.id ?? p.proveedor_id) === asignadoId);
      state.baseIdx = byId >= 0 ? byId : 0;
    } else {
      const nombreAsignado = (provSpan?.textContent || '').trim();
      const byName = state.lista.findIndex(p => (p.proveedor_nombre || '').trim() === nombreAsignado);
      state.baseIdx = byName >= 0 ? byName : 0;
    }
    state.idx = state.baseIdx;

    // Orden y ciclo (sin base)
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
window.onload = async () => {
  const respuesta = await fetch('/productos/api/buscar');
  productosOriginales = await respuesta.json();
  dbg('📦 productosOriginales cargados:', productosOriginales?.length);
};

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
      dbg('🔎 /productos/api/buscar =>', productos?.length, 'items');
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
    // datasets necesarios para simulación/rotación
    card.dataset.productoId = producto.id;
    card.dataset.precioVenta = producto.precio_venta;
    card.dataset.proveedorAsignadoId = producto.proveedor_id || ''; // ID asignado
    card.dataset.utilidad = (producto.utilidad ?? 0);

    dbg('🧾 Card SSR', producto.id, {
      proveedorAsignadoId: card.dataset.proveedorAsignadoId,
      utilidad: card.dataset.utilidad,
      precioVentaSSR: card.dataset.precioVenta
    });

    // galería
    let imagenesHTML = '';
    (producto.imagenes || []).forEach((imagen, i) => {
      imagenesHTML += `
        <img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${imagen.imagen}" alt="${producto.nombre}">
      `;
    });

    // info stock / acciones
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
        const stockActualNum = Number(producto.stock_actual) || 0;
        const stockMinNum = Number(producto.stock_minimo) || 0;
        const puedeComprar = stockActualNum >= stockMinNum && stockActualNum > 0;

        stockInfo = `
          <div class="semaforo-stock">
            <i class="fa-solid fa-thumbs-${puedeComprar ? 'up verde' : 'down rojo'}"></i>
            <span class="texto-semaforo">
              ${puedeComprar ? 'PRODUCTO DISPONIBLE PARA ENTREGA INMEDIATA' : 'PRODUCTO PENDIENTE DE INGRESO O A PEDIDO'}
            </span>
          </div>
          <div class="cantidad-producto">
            <input type="number"
                   class="cantidad-input"
                   value="${puedeComprar ? 1 : 0}"
                   min="${puedeComprar ? 1 : 0}"
                   max="${stockActualNum}"
                   step="1"
                   id="input-cantidad-${producto.id}"
                   ${puedeComprar ? '' : 'disabled'}>
            <button class="agregar-carrito"
              ${puedeComprar ? '' : 'disabled'}
              data-id="${producto.id}" 
              data-nombre="${producto.nombre}" 
              data-precio="${producto.precio_venta}" 
              data-stock="${stockActualNum}" 
              data-stockmin="${stockMinNum}">
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

    // ✅ Validación de cantidad (solo usuarios comunes logueados)
    // Importante: si hay error, frenamos el evento para que NO llegue a agregarAlCarrito.js
    if (!isAdminUser && isUserLoggedIn) {
      const botonAgregar = card.querySelector('.agregar-carrito');
      const inputCantidad = card.querySelector('.cantidad-input');
      const stockDisponible = Number(producto.stock_actual) || 0;

      if (botonAgregar && inputCantidad) {
        botonAgregar.addEventListener('click', (e) => {
          const cantidad = parseInt(inputCantidad.value, 10);

          // Si está disabled, no hacemos nada
          if (botonAgregar.disabled || inputCantidad.disabled) return;

          if (!inputCantidad.value || isNaN(cantidad) || cantidad <= 0) {
            Swal.fire({
              icon: 'error',
              title: 'Cantidad inválida',
              text: 'Debes ingresar una cantidad mayor a 0 para continuar.',
            });

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
          }

          if (cantidad > stockDisponible) {
            Swal.fire({
              icon: 'warning',
              title: 'No hay stock suficiente',
              text: `Estás intentando agregar ${cantidad} unidad(es), pero actualmente tenemos ${stockDisponible} disponible(s) para entrega inmediata. Si necesitás más, comunicate al 3513820440.`,
            });

            // Opcional: sugerir el máximo
            inputCantidad.value = String(stockDisponible);

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
          }

          // ✅ Si está OK, NO hacemos preventDefault ni stop:
          // dejamos que lo maneje agregarAlCarrito.js
        });
      }
    }

    _initProveedorButton(producto.id); // prepara estado/ciclo
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

/* ==========================================
   Init botón “Siguiente proveedor”
========================================== */
async function _initProveedorButton(productoId){
  if (!isAdminUser) return;
  const btn = document.querySelector(`.btn-siguiente-proveedor[data-producto-id="${productoId}"]`);
  if (!btn) return;
  const st = await _getOrInitState(productoId);
  if (!st.lista || st.lista.length < 2){
    btn.style.display = 'none';
  }
}

/* ==========================================
   Listener del botón “Siguiente proveedor”
========================================== */
contenedorProductos.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.btn-siguiente-proveedor');
  if (!btn || !isAdminUser) return;

  const productoId = Number(btn.dataset.productoId);
  if (!productoId) return;

  const cardEl = btn.closest('.card');
  const utilidadPct = _getUtilidadDeCard(cardEl);
  const u = utilidadPct / 100;

  console.groupCollapsed(`🔁 CLICK NEXT | producto ${productoId}`);
  dbg('🔧 utilidad leída de card:', utilidadPct, '%');

  const st = await _getOrInitState(productoId);
  if (!st.lista || !st.lista.length) {
    console.groupEnd();
    Swal.fire({ icon:'info', title:'Sin proveedores', text:'Este producto no tiene proveedores cargados.' });
    return;
  }
  if (st.lista.length < 2) {
    console.groupEnd();
    btn.style.display = 'none';
    return;
  }

  // Primer click: ir al primer alternativo del ciclo (no base)
  let nextIdx;
  if (st.first) {
    st.cyclePos = 0;
    nextIdx = st.orderCycle[st.cyclePos];
    st.first = false;
  } else {
    st.cyclePos = (st.cyclePos + 1) % st.orderCycle.length;
    nextIdx = st.orderCycle[st.cyclePos];
  }

  // Guard: si por error cae en base y hay más de 1 alternativo, avanzar
  if (nextIdx === st.baseIdx && st.orderCycle.length > 1) {
    st.cyclePos = (st.cyclePos + 1) % st.orderCycle.length;
    nextIdx = st.orderCycle[st.cyclePos];
    dbg('⚠️ nextIdx == baseIdx, avanzamos a', nextIdx);
  }

  dbg('🔁 ROTACIÓN', { baseIdx: st.baseIdx, idxActual: st.idx, nextIdx, cyclePos: st.cyclePos });

  // ACTUALIZAR ESTADO PRIMERO
  st.idx = nextIdx;
  _cacheProveedores.set(productoId, st);

  // OBTENER EL PROVEEDOR ACTUAL (el que se va a mostrar)
  const provActual = st.lista[st.idx];

  // RENDER DEL PROVEEDOR ACTUAL
  _renderProveedor(productoId, provActual);

  // TOMAR EL "PRECIO DE COSTO CON IVA" DEL PROVEEDOR ACTUAL (SIN RECONSTRUIR NADA)
  const costoConIva = toNumberSafe(provActual?.costo_iva);

  // CALCULAR PRECIO (solo utilidad sobre ese costo)
  if (costoConIva > 0 && u >= 0) {
    const precioBruto = costoConIva * (1 + u);
    const precioRedondeado = _redondearAlCentenar(precioBruto);

    console.log('🧮 PRECIO (solo utilidad sobre costo con IVA REAL)', {
      proveedor: provActual?.proveedor_nombre,
      codigo: provActual?.codigo,
      costo_con_iva: costoConIva,
      utilidadPct,
      precioRedondeado
    });

    if (st.idx === st.baseIdx) {
      _renderSimulacion(productoId, null);
    } else {
      _renderSimulacion(productoId, precioRedondeado);
    }
  } else {
    console.warn('❌ costo_con_iva ausente o inválido en el proveedor actual. No se puede simular precio.', provActual);
    _renderSimulacion(productoId, null);
  }

  console.groupEnd();
}, { passive: true });

/* ==========================================
   Delegado de clicks (analytics)
========================================== */
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

/* ==========================================
   Botón limpiar
========================================== */
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
