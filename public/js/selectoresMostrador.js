// public/js/selectoresMostrador.js
(function () {
  const selCat    = document.getElementById('selector-categoria');
  const selMarca  = document.getElementById('selector-marca');
  const selModelo = document.getElementById('selector-modelo');
  const btnBuscar = document.getElementById('btn-buscar-selectores');

  const modal           = document.getElementById('modal-selectores');
  const modalClose      = document.getElementById('modal-close');
  const modalResultados = document.getElementById('modal-resultados');

  if (!selCat || !selMarca || !selModelo || !btnBuscar || !modal || !modalResultados) return;

  // ========= Helpers UI =========
  const fmt = (n) => {
    const num = Number(n || 0);
    return '$' + Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  const abrirModal = () => { modal.style.display = 'block'; };
  const cerrarModal = () => { modal.style.display = 'none'; };

  modalClose.addEventListener('click', cerrarModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });

  // ========= Hidratar categorías y marcas desde selects ya renderizados por el servidor =========
  // Toma opciones de <select id="categoria_id"> y <select id="marca_id"> (como en tu selectores.js)
  function clonarOpciones(srcSel, dstSel, placeholder) {
    if (!srcSel || !dstSel) return;
    // Si ya hay opciones reales en destino, no duplicamos
    const tieneOpciones = Array.from(dstSel.options).some(o => o.value);
    if (tieneOpciones) return;

    dstSel.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = placeholder;
    dstSel.appendChild(ph);

    Array.from(srcSel.options).forEach(opt => {
      if (!opt.value) return; // salteamos placeholder origen
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.textContent;
      dstSel.appendChild(o);
    });
  }

  function hidratarDesdeSelectoresExistentes() {
    const srcCat   = document.getElementById('categoria_id');
    const srcMarca = document.getElementById('marca_id');

    clonarOpciones(srcCat, selCat,   'Seleccioná una categoría');
    clonarOpciones(srcMarca, selMarca, 'Seleccioná una marca');

    // Modelo queda deshabilitado hasta elegir marca
    selModelo.innerHTML = '<option value="">Seleccioná un modelo</option>';
    selModelo.disabled = true;
  }

  // Si preferís renderizar las opciones directamente en el EJS actual,
  // esto igual funciona (no rompe): solo no hará nada si ya hay opciones cargadas.
  hidratarDesdeSelectoresExistentes();

  // ========= Cargar MODELOS al cambiar MARCA (idéntico enfoque a selectores.js) =========
  selMarca.addEventListener('change', async function () {
    const marcaId = this.value;
    selModelo.innerHTML = '<option value="">Seleccioná un modelo</option>';
    selModelo.disabled = true;

    if (!marcaId) return;

    try {
      const res = await fetch('/productos/modelos/' + encodeURIComponent(marcaId));
      const modelos = await res.json();

      const normalizarModelo = (nombre) => {
        const partes = (nombre || '').split('/');
        if (partes.length === 2 && !isNaN(partes[0]) && !isNaN(partes[1])) {
          return parseInt(partes[0]) + parseInt(partes[1]) / 100;
        }
        const match = (nombre || '').match(/\d+/g);
        return match ? parseInt(match.join('')) : Number.MAX_SAFE_INTEGER;
      };
      (Array.isArray(modelos) ? modelos : []).sort(
        (a, b) => normalizarModelo(a.nombre) - normalizarModelo(b.nombre)
      );

      // “Todos” como en tu flujo
      const optAll = document.createElement('option');
      optAll.value = '';
      optAll.textContent = 'Todos';
      selModelo.appendChild(optAll);

      modelos.forEach(md => {
        const opt = document.createElement('option');
        opt.value = md.id;
        opt.textContent = md.nombre;
        selModelo.appendChild(opt);
      });

      selModelo.disabled = false;
    } catch (e) {
      console.error('Error cargando modelos', e);
      selModelo.innerHTML = '<option value="">Error cargando modelos</option>';
      selModelo.disabled = true;
    }
  });

  // ========= Buscar productos y mostrar modal =========
  btnBuscar.addEventListener('click', async () => {
    const categoria_id = selCat.value || '';
    const marca_id     = selMarca.value || '';
    const modelo_id    = selModelo.value || '';

    modalResultados.innerHTML = '<div style="padding:16px;">Cargando productos...</div>';
    abrirModal();

    try {
      const url = `/productos/api/buscar?categoria_id=${encodeURIComponent(categoria_id)}&marca_id=${encodeURIComponent(marca_id)}&modelo_id=${encodeURIComponent(modelo_id)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error en la búsqueda');
      const productos = await res.json();
      renderResultados(productos);
    } catch (e) {
      console.error('Error buscando productos:', e);
      modalResultados.innerHTML = '<div style="padding:16px;">Ocurrió un error al buscar productos.</div>';
    }
  });

  // ========= Render de resultados en el modal (agrega a la tabla con tu función existente) =========
  function renderResultados(productos) {
    if (!Array.isArray(productos) || productos.length === 0) {
      modalResultados.innerHTML = `
        <div style="text-align:center;padding:24px;">
          <img src="/images/noEncontrado.png" alt="Producto no encontrado" style="width:120px;opacity:.7;">
          <p>No se encontraron productos con esos filtros.</p>
        </div>`;
      return;
    }

    const cont = document.createElement('div');
    cont.style.display = 'grid';
    cont.style.gridTemplateColumns = '1fr';
    cont.style.gap = '8px';

    productos.forEach((p) => {
      const codigo      = p.codigo || String(p.id);
      const nombre      = p.nombre || '(Sin nombre)';
      const precioVenta = Number(p.precio_venta || p.precio || 0);
      const stockActual = Number(p.stock_actual || p.stock || 0);
      const imagen      = Array.isArray(p.imagenes) && p.imagenes[0]
                          ? (p.imagenes[0].imagen ? `/uploads/productos/${p.imagenes[0].imagen}` : p.imagenes[0])
                          : (p.imagen || '/images/sin-imagen.png');

      const item = document.createElement('div');
      item.style.display = 'grid';
      item.style.gridTemplateColumns = '64px 140px 1fr 120px 100px 110px';
      item.style.alignItems = 'center';
      item.style.gap = '8px';
      item.style.border = '1px solid #eee';
      item.style.borderRadius = '10px';
      item.style.padding = '8px';

      item.innerHTML = `
        <img src="${imagen}" alt="${nombre}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">
        <div style="font-family:monospace;">${codigo}</div>
        <div style="font-weight:600;">${nombre}</div>
        <div style="text-align:right;">${fmt(precioVenta)}</div>
        <div style="text-align:right;">Stock: ${stockActual}</div>
        <div>
          <button type="button" class="btn-agregar"
            data-codigo="${codigo}"
            data-nombre="${nombre.replace(/"/g,'&quot;')}"
            data-precio="${precioVenta}"
            data-stock="${stockActual}"
            data-imagen="${imagen}"
            style="padding:6px 10px;border:none;background:#003f7d;color:#fff;border-radius:8px;cursor:pointer;">
            Agregar
          </button>
        </div>
      `;

      item.querySelector('.btn-agregar').addEventListener('click', function () {
        const c  = this.dataset.codigo;
        const n  = this.dataset.nombre;
        const pr = Number(this.dataset.precio || 0);
        const st = Number(this.dataset.stock || 0);
        const im = this.dataset.imagen;

        if (typeof agregarProductoATabla !== 'function') {
          console.error('agregarProductoATabla no está disponible (cargá primero buscadorPresupuesto.js)');
          if (window.Swal) Swal.fire('Error', 'No se pudo agregar el producto (función no disponible)', 'error');
          return;
        }
        agregarProductoATabla(c, n, pr, st, im);
        cerrarModal();
      });

      cont.appendChild(item);
    });

    modalResultados.innerHTML = '';
    modalResultados.appendChild(cont);
  }
})();
