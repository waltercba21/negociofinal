// public/js/selectoresMostrador.js
(function () {
  // ----- Elementos de la vista (IDs tal como pasaste en tu EJS) -----
  const selCat   = document.getElementById('selector-categoria');
  const selMarca = document.getElementById('selector-marca');
  const selModelo= document.getElementById('selector-modelo');
  const btnBuscar= document.getElementById('btn-buscar-selectores');

  const modal        = document.getElementById('modal-selectores');
  const modalClose   = document.getElementById('modal-close');
  const modalResultados = document.getElementById('modal-resultados');

  if (!selCat || !selMarca || !selModelo || !btnBuscar || !modal || !modalResultados) {
    // La vista no tiene estos elementos -> no hacemos nada
    return;
  }

  // ===== Helpers =====
  const fmt = (n) => {
    const num = Number(n || 0);
    const entero = Math.round(num);
    return '$' + entero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const abrirModal = () => {
    modal.style.display = 'block';
  };
  const cerrarModal = () => {
    modal.style.display = 'none';
  };

  // Cerrar modal con X o clic afuera
  modalClose.addEventListener('click', cerrarModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal();
  });

  // ===== Carga inicial de Categorías y Marcas =====
  async function cargarCategoriasYMarcas() {
    // Limpia selects base
    selCat.innerHTML   = `<option value="">Seleccioná una categoría</option>`;
    selMarca.innerHTML = `<option value="">Seleccioná una marca</option>`;
    selModelo.innerHTML= `<option value="">Seleccioná un modelo</option>`;
    selModelo.disabled = true;

    try {
      // ⚠️ Ajustá estos endpoints si en tu API usan otra ruta
      const [resCats, resMarcas] = await Promise.all([
        fetch('/productos/api/categorias'),
        fetch('/productos/api/marcas')
      ]);
      const [cats, marcas] = await Promise.all([resCats.json(), resMarcas.json()]);

      (Array.isArray(cats) ? cats : []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre;
        selCat.appendChild(opt);
      });

      (Array.isArray(marcas) ? marcas : []).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.nombre;
        selMarca.appendChild(opt);
      });
    } catch (e) {
      console.error('Error cargando categorias/marcas', e);
      if (window.Swal) Swal.fire('Error', 'No se pudieron cargar categorías y marcas', 'error');
    }
  }

  // ===== Al elegir MARCA, cargar MODELOS =====
  selMarca.addEventListener('change', async function () {
    const marcaId = this.value;
    selModelo.innerHTML = '';
    selModelo.disabled = true;

    if (!marcaId) {
      selModelo.innerHTML = `<option value="">Seleccioná un modelo</option>`;
      return;
    }

    try {
      const res = await fetch('/productos/modelos/' + encodeURIComponent(marcaId));
      const modelos = await res.json();

      // Orden similar al que usás en selectores.js
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

      selModelo.innerHTML = `<option value="">Todos</option>`;
      modelos.forEach(md => {
        const opt = document.createElement('option');
        opt.value = md.id;
        opt.textContent = md.nombre;
        selModelo.appendChild(opt);
      });
      selModelo.disabled = false;
    } catch (e) {
      console.error('Error cargando modelos', e);
      selModelo.innerHTML = `<option value="">Error cargando modelos</option>`;
      selModelo.disabled = true;
    }
  });

  // ===== Buscar productos y mostrar modal con resultados =====
  btnBuscar.addEventListener('click', async () => {
    const categoria_id = selCat.value || '';
    const marca_id     = selMarca.value || '';
    const modelo_id    = selModelo.value || '';

    // Pintamos estado "cargando" antes de abrir el modal
    modalResultados.innerHTML = `<div style="padding:16px;">Cargando productos...</div>`;
    abrirModal();

    try {
      // ⚠️ Este endpoint debe filtrar por cualquiera de los 3 parámetros si llegan
      const url = `/productos/api/buscar?categoria_id=${encodeURIComponent(categoria_id)}&marca_id=${encodeURIComponent(marca_id)}&modelo_id=${encodeURIComponent(modelo_id)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error en la búsqueda');

      const productos = await res.json();
      renderResultados(productos);
    } catch (e) {
      console.error('Error buscando productos:', e);
      modalResultados.innerHTML = `<div style="padding:16px;">Ocurrió un error al buscar productos.</div>`;
    }
  });

  // ===== Render de resultados en el modal =====
  function renderResultados(productos) {
    if (!Array.isArray(productos) || productos.length === 0) {
      modalResultados.innerHTML = `
        <div style="text-align:center;padding:24px;">
          <img src="/images/noEncontrado.png" alt="Producto no encontrado" style="width:120px;opacity:.7;">
          <p>No se encontraron productos con esos filtros.</p>
        </div>`;
      return;
    }

    // Contenedor
    const cont = document.createElement('div');
    cont.style.display = 'grid';
    cont.style.gridTemplateColumns = '1fr';
    cont.style.gap = '8px';

    productos.forEach((p) => {
      const id           = p.id;
      const codigo       = p.codigo || String(p.id);
      const nombre       = p.nombre || '(Sin nombre)';
      const precioVenta  = Number(p.precio_venta || p.precio || 0);
      const stockActual  = Number(p.stock_actual || p.stock || 0);
      const imagen       = Array.isArray(p.imagenes) && p.imagenes[0]
                           ? p.imagenes[0]
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
        const c = this.dataset.codigo;
        const n = this.dataset.nombre;
        const pr= Number(this.dataset.precio || 0);
        const st= Number(this.dataset.stock || 0);
        const im= this.dataset.imagen;

        if (typeof agregarProductoATabla !== 'function') {
          console.error('agregarProductoATabla no está disponible (cargá primero buscadorPresupuesto.js)');
          if (window.Swal) Swal.fire('Error', 'No se pudo agregar el producto (función no disponible)', 'error');
          return;
        }

        // Reutiliza la lógica de tu buscador escrito
        agregarProductoATabla(c, n, pr, st, im);
        cerrarModal();
      });

      cont.appendChild(item);
    });

    modalResultados.innerHTML = '';
    modalResultados.appendChild(cont);
  }

  // Carga inicial
  cargarCategoriasYMarcas();
})();
