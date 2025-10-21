// public/js/catalogosAdmin.js
(() => {
  const $ = (sel) => document.querySelector(sel);

  // ====== DOM refs
  const selCategoria = $('#selectCategoria');
  const btnNuevaCategoria = $('#btnNuevaCategoria');
  const btnEditarCategoria = $('#btnEditarCategoria');
  const btnEliminarCategoria = $('#btnEliminarCategoria');

  const selMarca = $('#selectMarca');
  const btnNuevaMarca = $('#btnNuevaMarca');
  const btnEditarMarca = $('#btnEditarMarca');
  const btnEliminarMarca = $('#btnEliminarMarca');

  const selModelo = $('#selectModelo');
  const btnNuevoModelo = $('#btnNuevoModelo');
  const btnEditarModelo = $('#btnEditarModelo');
  const btnEliminarModelo = $('#btnEliminarModelo');
  const filtroMarcaModelos = $('#filtroMarcaModelos');

  // Modales
  const modalCategoria = new bootstrap.Modal('#modalCategoria');
  const formCategoria = $('#formCategoria');
  const categoriaId = $('#categoriaId');
  const categoriaNombre = $('#categoriaNombre');

  const modalMarca = new bootstrap.Modal('#modalMarca');
  const formMarca = $('#formMarca');
  const marcaId = $('#marcaId');
  const marcaNombre = $('#marcaNombre');

  const modalModelo = new bootstrap.Modal('#modalModelo');
  const formModelo = $('#formModelo');
  const modeloId = $('#modeloId');
  const modeloNombre = $('#modeloNombre');
  const modeloMarcaId = $('#modeloMarcaId');

  // ===== Helpers REST
  async function apiGet(url){ const r=await fetch(url); if(!r.ok) throw new Error('GET '+url); return r.json(); }
  async function apiSend(url, method, data){
    const r = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    if(!r.ok) throw new Error(method+' '+url);
    return r.json();
  }

  // ===== Carga inicial
  async function cargarCategorias(){
    const rows = await apiGet('/administracion/api/categorias');
    selCategoria.innerHTML = `<option value="">Seleccioná...</option>` + rows.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
    toggleBotones(selCategoria, btnEditarCategoria, btnEliminarCategoria);
  }
  async function cargarMarcas(){
    const rows = await apiGet('/administracion/api/marcas');
    selMarca.innerHTML = `<option value="">Seleccioná...</option>` + rows.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
    // Popular combos dependientes
    filtroMarcaModelos.innerHTML = `<option value="">Todas</option>` + rows.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
    modeloMarcaId.innerHTML = rows.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
    toggleBotones(selMarca, btnEditarMarca, btnEliminarMarca);
  }
  async function cargarModelos(){
    const marcaId = filtroMarcaModelos.value || '';
    const q = marcaId ? ('?marca_id='+encodeURIComponent(marcaId)) : '';
    const rows = await apiGet('/administracion/api/modelos'+q);
    selModelo.innerHTML = `<option value="">Seleccioná...</option>` + rows.map(r => {
      const label = r.marca ? `${r.marca} — ${r.nombre}` : r.nombre;
      return `<option value="${r.id}" data-marca="${r.marca_id}">${label}</option>`;
    }).join('');
    toggleBotones(selModelo, btnEditarModelo, btnEliminarModelo);
  }

  function toggleBotones(select, btnEdit, btnDel){
    const enable = !!select.value;
    btnEdit.disabled = !enable;
    btnDel.disabled = !enable;
  }

  // ===== Eventos selects
  selCategoria?.addEventListener('change', () => toggleBotones(selCategoria, btnEditarCategoria, btnEliminarCategoria));
  selMarca?.addEventListener('change', () => toggleBotones(selMarca, btnEditarMarca, btnEliminarMarca));
  selModelo?.addEventListener('change', () => toggleBotones(selModelo, btnEditarModelo, btnEliminarModelo));
  filtroMarcaModelos?.addEventListener('change', cargarModelos);

  // ===== Categorías: ABM
  btnNuevaCategoria?.addEventListener('click', () => {
    categoriaId.value = '';
    categoriaNombre.value = '';
    modalCategoria.show();
  });
  btnEditarCategoria?.addEventListener('click', () => {
    const opt = selCategoria.selectedOptions[0];
    if(!opt) return;
    categoriaId.value = opt.value;
    categoriaNombre.value = opt.textContent;
    modalCategoria.show();
  });
  btnEliminarCategoria?.addEventListener('click', async () => {
    const id = selCategoria.value;
    if(!id) return;
    if(!confirm('¿Eliminar la categoría seleccionada?')) return;
    await apiSend('/administracion/api/categorias/'+id, 'DELETE');
    await cargarCategorias();
  });
  formCategoria?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = categoriaId.value;
    const nombre = categoriaNombre.value.trim();
    if(!nombre) return;
    if(id) await apiSend('/administracion/api/categorias/'+id, 'PUT', { nombre });
    else   await apiSend('/administracion/api/categorias', 'POST', { nombre });
    modalCategoria.hide();
    await cargarCategorias();
  });

  // ===== Marcas: ABM
  btnNuevaMarca?.addEventListener('click', () => {
    marcaId.value = '';
    marcaNombre.value = '';
    modalMarca.show();
  });
  btnEditarMarca?.addEventListener('click', () => {
    const opt = selMarca.selectedOptions[0];
    if(!opt) return;
    marcaId.value = opt.value;
    marcaNombre.value = opt.textContent;
    modalMarca.show();
  });
  btnEliminarMarca?.addEventListener('click', async () => {
    const id = selMarca.value;
    if(!id) return;
    if(!confirm('¿Eliminar la marca seleccionada? Esto puede afectar modelos asociados.')) return;
    await apiSend('/administracion/api/marcas/'+id, 'DELETE');
    await cargarMarcas();
    await cargarModelos(); // refrescar modelos por si dependían de la marca
  });
  formMarca?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = marcaId.value;
    const nombre = marcaNombre.value.trim();
    if(!nombre) return;
    if(id) await apiSend('/administracion/api/marcas/'+id, 'PUT', { nombre });
    else   await apiSend('/administracion/api/marcas', 'POST', { nombre });
    modalMarca.hide();
    await cargarMarcas();
  });

  // ===== Modelos: ABM
  btnNuevoModelo?.addEventListener('click', () => {
    modeloId.value = '';
    modeloNombre.value = '';
    // Preseleccionar marca del filtro si existe
    const mf = filtroMarcaModelos.value;
    if (mf) modeloMarcaId.value = mf;
    modalModelo.show();
  });
  btnEditarModelo?.addEventListener('click', () => {
    const opt = selModelo.selectedOptions[0];
    if(!opt) return;
    modeloId.value = opt.value;
    modeloNombre.value = opt.textContent.replace(/^.*—\s*/, ''); // quita "Marca — " si viene
    modeloMarcaId.value = opt.dataset.marca || '';
    modalModelo.show();
  });
  btnEliminarModelo?.addEventListener('click', async () => {
    const id = selModelo.value;
    if(!id) return;
    if(!confirm('¿Eliminar el modelo seleccionado?')) return;
    await apiSend('/administracion/api/modelos/'+id, 'DELETE');
    await cargarModelos();
  });
  formModelo?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = modeloId.value;
    const payload = {
      nombre: (modeloNombre.value || '').trim(),
      marca_id: modeloMarcaId.value
    };
    if(!payload.nombre || !payload.marca_id) return;
    if(id) await apiSend('/administracion/api/modelos/'+id, 'PUT', payload);
    else   await apiSend('/administracion/api/modelos', 'POST', payload);
    modalModelo.hide();
    await cargarModelos();
  });

// Init
(async () => {
  try {
    await cargarCategorias();
    await cargarMarcas();
    await cargarModelos();
  } catch (e) {
    console.warn('Catálogos: no se pudieron cargar inicialmente.', e);
    // intencionalmente sin alert()
  }
})();

})();
