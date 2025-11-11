/* ==========================================
   Estado global / selectors
========================================== */
let productosOriginales = [];
let timer;

const entradaBusqueda      = document.getElementById('entradaBusqueda');
const contenedorProductos  = document.getElementById('contenedor-productos');
const botonLimpiar         = document.getElementById('botonLimpiar');
const paginadorBusqueda    = document.getElementById('paginador-busqueda'); // <div id="paginador-busqueda"></div> en la vista

const isAdminUser    = document.body.getAttribute('data-is-admin-user') === 'true';
const isUserLoggedIn = document.body.getAttribute('data-is-user-logged-in') === 'true';

let lastLogAt = 0; // debounce para analytics

// Estado de búsqueda/paginación
let qActual       = '';
let paginaActual  = 1;
let totalPaginas  = 0;
let porPagina     = 20;

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
    body: JSON.stringify({ producto_id: Number(producto_id), q: qActual || null })
  }).catch(() => {});
}

/* ==========================================
   Búsqueda con paginación (nuevo) + fallback
========================================== */
async function cargarPaginaBusqueda(pag = 1) {
  if (!qActual || qActual.length < 3) {
    contenedorProductos.innerHTML = '';
    if (paginadorBusqueda) paginadorBusqueda.innerHTML = '';
    return;
  }

  // 1) Intento con endpoint paginado
  try {
    const r = await fetch(`/productos/api/buscar-paginado?q=${encodeURIComponent(qActual)}&pagina=${pag}&porPagina=${porPagina}`);
    const data = await r.json(); // { items, total, pagina, porPagina, totalPaginas }
    if (data && Array.isArray(data.items)) {
      paginaActual = Number(data.pagina || 1);
      totalPaginas = Number(data.totalPaginas || 0);
      DBG && console.log('🔎 buscar-paginado =>', data.items.length, 'items / pag', paginaActual, '/', totalPaginas);
      mostrarProductos(data.items);
      renderPaginador();
      return;
    }
  } catch (e) {
    DBG && console.warn('buscar-paginado falló, voy a fallback', e);
  }

  // 2) Fallback al endpoint viejo que devuelve array (sin paginado)
  try {
    const r2 = await fetch(`/productos/api/buscar?q=${encodeURIComponent(qActual)}&limite=${porPagina}`);
    const arr = await r2.json(); // array
    paginaActual = 1;
    totalPaginas = 1;
    DBG && console.log('🔎 buscar (fallback) =>', Array.isArray(arr) ? arr.length : 0, 'items');
    mostrarProductos(Array.isArray(arr) ? arr : []);
    if (paginadorBusqueda) paginadorBusqueda.innerHTML = '';
  } catch (e2) {
    DBG && console.error('fallback /productos/api/buscar error', e2);
    mostrarProductos([]);
    if (paginadorBusqueda) paginadorBusqueda.innerHTML = '';
  }
}

function renderPaginador() {
  if (!paginadorBusqueda) return;
  if (!totalPaginas || totalPaginas <= 1) {
    paginadorBusqueda.innerHTML = '';
    return;
  }
  const html = `
    <nav aria-label="Paginación búsqueda">
      <ul class="pagination justify-content-center">
        <li class="page-item ${paginaActual===1?'disabled':''}">
          <a class="page-link" data-goto="${paginaActual-1}" href="#">«</a>
        </li>
        ${Array.from({length: totalPaginas}, (_,i)=>i+1).map(i=>`
          <li class="page-item ${i===paginaActual?'active':''}">
            <a class="page-link" data-goto="${i}" href="#">${i}</a>
          </li>`).join('')}
        <li class="page-item ${paginaActual===totalPaginas?'disabled':''}">
          <a class="page-link" data-goto="${paginaActual+1}" href="#">»</a>
        </li>
      </ul>
    </nav>`;
  paginadorBusqueda.innerHTML = html;

  paginadorBusqueda.querySelectorAll('a.page-link').forEach(a => {
    a.addEventListener('click', ev => {
      ev.preventDefault();
      const goto = Number(a.dataset.goto);
      if (!Number.isFinite(goto) || goto < 1 || goto > totalPaginas) return;
      cargarPaginaBusqueda(goto);
    });
  });
}

/* ==========================================
   UI / Render de productos
========================================== */
window.onload = async () => {
  // Si querés precargar algo al inicio, dejá esto; si no, podés omitirlo.
  try {
    const respuesta = await fetch('/productos/api/buscar?limite=20');
    productosOriginales = await respuesta.json();
    DBG && console.log('📦 productosOriginales cargados:', Array.isArray(productosOriginales) ? productosOriginales.length : 0);
    // mostrarProductos(productosOriginales); // opcional
  } catch {}
};

entradaBusqueda.addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    qActual = e.target.value.trim();

    const now = Date.now();
    if (qActual.length >= 3 && (now - lastLogAt > 1200)) {
      lastLogAt = now;
      logBusquedaTexto(qActual, 'texto');
    }

    contenedorProductos.innerHTML = '';
    paginaActual = 1;
    totalPaginas = 0;

    if (qActual.length >= 3) {
      await cargarPaginaBusqueda(1);
    } else {
      if (paginadorBusqueda) paginadorBusqueda.innerHTML = '';
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

    // Si volvimos al asignado, podés ocultarlo si preferís; acá lo mostramos siempre que no sea base
    if (st.idx === st.baseIdx) {
      // Mostrar u ocultar a gusto. Yo prefiero ocultarlo para no confundir:
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
