document.addEventListener('DOMContentLoaded', () => {
  const modal = new bootstrap.Modal(document.getElementById('modalProductosPresupuesto'));
  const btnAbrirModal = document.getElementById('btnAgregarProductosPresupuesto');
  const buscador = document.getElementById('buscadorProductoPresupuesto');
  const resultados = document.getElementById('resultadosBusquedaPresupuesto');
  const tabla = document.getElementById('tablaProductosPresupuesto').querySelector('tbody');
  const btnConfirmar = document.getElementById('btnConfirmarProductosPresupuesto');
  const btnGuardarPresupuesto = document.getElementById('btnGuardarPresupuesto');
  const selectProveedor = document.getElementById('presupuestoProveedor');

  let productosSeleccionados = [];
  let debounceTimer = null;
  let controladorActual = null;

  // ── SVG basura inline ──
  const ICONO_BASURA = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
  </svg>`;

  // ── Dropdown flotante con estética dark ──
  Object.assign(resultados.style, {
    position:        'absolute',
    top:             '100%',
    left:            '0',
    right:           '0',
    zIndex:          '9999',
    maxHeight:       '320px',
    overflowY:       'auto',
    display:         'none',
    margin:          '2px 0 0 0',
    padding:         '4px 0',
    border:          '1px solid rgba(31,72,126,0.35)',
    borderRadius:    '10px',
    backgroundColor: '#0e1929',
    boxShadow:       '0 8px 28px rgba(0,0,0,0.55)'
  });

  const wrapBuscador = buscador.parentElement;
  if (getComputedStyle(wrapBuscador).position === 'static') {
    wrapBuscador.style.position = 'relative';
  }

  buscador.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarResultados(); });
  document.addEventListener('click', (e) => { if (!wrapBuscador.contains(e.target)) cerrarResultados(); });

  function cerrarResultados() {
    resultados.innerHTML = '';
    resultados.style.display = 'none';
  }

  btnAbrirModal.addEventListener('click', () => {
    modal.show();
    buscador.value = '';
    cerrarResultados();
    renderizarTabla();
  });

  buscador.addEventListener('input', () => {
    const query = buscador.value.trim();
    cerrarResultados();
    if (controladorActual) { controladorActual.abort(); controladorActual = null; }
    clearTimeout(debounceTimer);
    if (query.length < 2) return;

    debounceTimer = setTimeout(async () => {
      controladorActual = new AbortController();
      const signal = controladorActual.signal;
      const querySnapshot = buscador.value.trim();
      const proveedorId = selectProveedor ? selectProveedor.value : '';

      // Detectar si el proveedor seleccionado empieza con "DM".
      // Si es así, buscar en todos los proveedores cuyo nombre empiece con "DM"
      // y unificar los resultados (evitando duplicados por id de producto).
      let proveedorIds = [];
      if (proveedorId && selectProveedor) {
        const optSeleccionada = selectProveedor.options[selectProveedor.selectedIndex];
        const nombreProv = optSeleccionada ? optSeleccionada.text.trim().toUpperCase() : '';

        if (nombreProv.startsWith('DM')) {
          proveedorIds = Array.from(selectProveedor.options)
            .filter(opt => opt.value && opt.text.trim().toUpperCase().startsWith('DM'))
            .map(opt => opt.value);
        } else {
          proveedorIds = [proveedorId];
        }
      }

      try {
        let productos = [];

        if (proveedorIds.length > 1) {
          // Caso DM: múltiples proveedores. Búsquedas en paralelo + unificación.
          const promesas = proveedorIds.map(id =>
            fetch(`/productos/api/buscar?q=${encodeURIComponent(query)}&proveedor_id=${encodeURIComponent(id)}`, { signal })
              .then(r => r.json())
              .catch(() => [])
          );
          const resultadosArr = await Promise.all(promesas);

          // Deduplicar por id de producto
          const mapa = new Map();
          resultadosArr.flat().forEach(p => {
            if (p && p.id != null && !mapa.has(p.id)) mapa.set(p.id, p);
          });
          productos = Array.from(mapa.values());
        } else {
          // Caso normal: un solo proveedor o ninguno (búsqueda general).
          let url = `/productos/api/buscar?q=${encodeURIComponent(query)}`;
          if (proveedorIds.length === 1) url += `&proveedor_id=${encodeURIComponent(proveedorIds[0])}`;
          const res = await fetch(url, { signal });
          productos = await res.json();
        }

        if (buscador.value.trim() !== querySnapshot) return;
        resultados.innerHTML = '';

        if (!Array.isArray(productos) || !productos.length) {
          const vacio = document.createElement('div');
          vacio.style.cssText = 'padding:12px 14px;color:rgba(240,244,255,0.35);font-size:13px;font-family:DM Sans,sans-serif;';
          vacio.textContent = proveedorId
            ? 'No se encontraron productos de este proveedor.'
            : 'No se encontraron productos.';
          resultados.appendChild(vacio);
          resultados.style.display = 'block';
          return;
        }

        productos.forEach(producto => resultados.appendChild(crearItemDropdown(producto)));
        resultados.style.display = 'block';

      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('❌ Error al buscar productos:', err);
      }
    }, 350);
  });

  // ── Fila del dropdown: imagen + nombre + input cantidad + botón + ──
  function crearItemDropdown(producto) {
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px;
      border-bottom: 1px solid rgba(31,72,126,0.12);
      transition: background 0.12s;
    `;
    item.addEventListener('mouseenter', () => { item.style.background = 'rgba(31,72,126,0.18)'; });
    item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });

    // Imagen miniatura
    if (producto.imagenes && producto.imagenes.length > 0) {
      const img = document.createElement('img');
      img.src = '/uploads/productos/' + producto.imagenes[0].imagen;
      img.style.cssText = 'width:38px;height:38px;object-fit:cover;border-radius:6px;flex-shrink:0;border:1px solid rgba(31,72,126,0.2);';
      item.appendChild(img);
    }

    // Nombre
    const nombre = document.createElement('span');
    nombre.textContent = producto.nombre;
    nombre.style.cssText = `
      flex:1; font-size:13px; font-family:'DM Sans',sans-serif;
      color:rgba(240,244,255,0.88);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    `;
    item.appendChild(nombre);

    // Input de cantidad
    const inputCantidad = document.createElement('input');
    inputCantidad.type = 'number';
    inputCantidad.value = '1';
    inputCantidad.min = '1';
    inputCantidad.style.cssText = `
      width:56px; flex-shrink:0;
      background:rgba(255,255,255,0.07);
      border:1.5px solid rgba(31,72,126,0.3);
      border-radius:7px;
      color:#f0f4ff; font-size:13px; font-family:'DM Sans',sans-serif;
      text-align:center; padding:4px 6px; outline:none;
    `;
    inputCantidad.addEventListener('focus', () => {
      inputCantidad.style.borderColor = '#1F487E';
      inputCantidad.style.boxShadow = '0 0 0 3px rgba(31,72,126,0.2)';
    });
    inputCantidad.addEventListener('blur', () => {
      inputCantidad.style.borderColor = 'rgba(31,72,126,0.3)';
      inputCantidad.style.boxShadow = 'none';
    });
    inputCantidad.addEventListener('click', (e) => e.stopPropagation());
    item.appendChild(inputCantidad);

    // Botón +
    const btnAdd = document.createElement('button');
    btnAdd.type = 'button';
    btnAdd.title = 'Agregar a la lista';
    btnAdd.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"/>
    </svg>`;
    btnAdd.style.cssText = `
      flex-shrink:0; width:30px; height:30px;
      border-radius:8px;
      border:1.5px solid rgba(74,222,128,0.35);
      background:rgba(74,222,128,0.1);
      color:#4ade80;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; transition:background .12s, border-color .12s;
    `;
    btnAdd.addEventListener('mouseenter', () => {
      if (!btnAdd.dataset.added) {
        btnAdd.style.background = 'rgba(74,222,128,0.22)';
        btnAdd.style.borderColor = 'rgba(74,222,128,0.6)';
      }
    });
    btnAdd.addEventListener('mouseleave', () => {
      if (!btnAdd.dataset.added) {
        btnAdd.style.background = 'rgba(74,222,128,0.1)';
        btnAdd.style.borderColor = 'rgba(74,222,128,0.35)';
      }
    });
    btnAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      const cantidad = Math.max(1, parseInt(inputCantidad.value) || 1);
      agregarProducto(producto, cantidad, btnAdd, inputCantidad);
    });
    item.appendChild(btnAdd);

    return item;
  }

  function agregarProducto(prod, cantidad, btnRef, inputRef) {
    const existente = productosSeleccionados.find(p => p.id === prod.id);
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      productosSeleccionados.push({
        id:          prod.id,
        nombre:      prod.nombre,
        proveedores: prod.proveedores || [],
        imagenes:    prod.imagenes   || [],
        cantidad:    cantidad
      });
    }
    renderizarTabla();

    if (btnRef) {
      const svgOrig = btnRef.innerHTML;
      btnRef.dataset.added = '1';
      btnRef.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/>
      </svg>`;
      btnRef.style.background = 'rgba(74,222,128,0.25)';
      btnRef.style.borderColor = 'rgba(74,222,128,0.7)';
      setTimeout(() => {
        btnRef.innerHTML = svgOrig;
        btnRef.dataset.added = '';
        btnRef.style.background = 'rgba(74,222,128,0.1)';
        btnRef.style.borderColor = 'rgba(74,222,128,0.35)';
        if (inputRef) inputRef.value = '1';
      }, 900);
    }
  }

  function renderizarTabla() {
    tabla.innerHTML = '';
    // ID del proveedor actualmente seleccionado en el formulario de presupuesto
    const provIdSeleccionado = selectProveedor ? Number(selectProveedor.value) : null;

    productosSeleccionados.forEach(prod => {
      const fila = document.createElement('tr');
      fila.dataset.id = prod.id;

      // Buscar el código del proveedor con el que estamos trabajando;
      // si el producto no tiene ese proveedor, mostrar '-'
      const provMatch = provIdSeleccionado
        ? (prod.proveedores || []).find(p => Number(p.id) === provIdSeleccionado)
        : null;
      const codigoProveedor = provMatch?.codigo || prod.proveedores?.[0]?.codigo || '-';
      const imagenSrc = prod.imagenes?.[0]?.imagen
        ? '/uploads/productos/' + prod.imagenes[0].imagen
        : '/uploads/noimg.jpg';

      fila.innerHTML = `
        <td>${codigoProveedor}</td>
        <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${prod.nombre}</td>
        <td><img src="${imagenSrc}" class="miniatura-tabla"></td>
        <td>
          <input type="number" class="form-control form-control-sm cantidad-input"
                 value="${prod.cantidad}" min="1"
                 style="width:72px;margin:auto;text-align:center;">
        </td>
        <td>
          <button class="btn btn-sm btn-danger boton-eliminar-factura" title="Eliminar"
                  style="color:#ff4d6d !important; display:inline-flex; align-items:center; justify-content:center;">
            ${ICONO_BASURA}
          </button>
        </td>
      `;

      fila.querySelector('.cantidad-input').addEventListener('input', (e) => {
        const item = productosSeleccionados.find(p => p.id === prod.id);
        const val = parseInt(e.target.value);
        item.cantidad = (!val || val < 1) ? 1 : val;
      });

      fila.querySelector('.boton-eliminar-factura').addEventListener('click', () => {
        productosSeleccionados = productosSeleccionados.filter(p => p.id !== prod.id);
        renderizarTabla();
      });

      tabla.appendChild(fila);
    });
  }

  btnConfirmar.addEventListener('click', () => {
    if (!productosSeleccionados.length) {
      return Swal.fire('Atención', 'Debes agregar al menos un producto.', 'warning');
    }
    cerrarResultados();
    modal.hide();
    Swal.fire('Confirmado', 'Productos listos para guardar.', 'success');
  });

  btnGuardarPresupuesto.addEventListener('click', async () => {
    const proveedor     = document.getElementById('presupuestoProveedor').value;
    const fecha         = document.getElementById('presupuestoFecha').value;
    const numero        = document.getElementById('presupuestoNumero').value;
    const importe       = document.getElementById('presupuestoImporte').value;
    const condicion     = document.getElementById('presupuestoCondicion').value;
    const fecha_pago    = document.getElementById('presupuestoFechaPago').value;
    const administrador = document.getElementById('presupuestoAdministrador').value;

    if (!proveedor || !fecha || !numero || !importe || !condicion || !fecha_pago || !administrador) {
      let msg = 'Los siguientes campos son obligatorios:\n';
      if (!proveedor)    msg += '- Proveedor\n';
      if (!fecha)        msg += '- Fecha del presupuesto\n';
      if (!numero)       msg += '- Número\n';
      if (!importe)      msg += '- Importe\n';
      if (!fecha_pago)   msg += '- Fecha de vencimiento\n';
      if (!condicion)    msg += '- Condición de pago\n';
      if (!administrador)msg += '- Administrador\n';
      return Swal.fire('Faltan datos', msg, 'warning');
    }

    if (!productosSeleccionados.length) {
      const c = await Swal.fire({
        title: 'Presupuesto sin productos',
        text: 'Estás por guardar un presupuesto sin productos. ¿Deseás continuar?',
        icon: 'warning', showCancelButton: true,
        confirmButtonText: 'Sí, guardar de todos modos', cancelButtonText: 'Cancelar'
      });
      if (!c.isConfirmed) return;
    }

    try {
      const res = await fetch('/administracion/api/presupuestos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_proveedor: proveedor, fecha, numero_presupuesto: numero, importe, condicion, fecha_pago, administrador })
      });
      const respuesta = await res.json();
      if (!respuesta.insertId) throw new Error('No se pudo crear el presupuesto');

      const pRes = await fetch('/administracion/api/presupuestos/productos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuestoId: respuesta.insertId, items: productosSeleccionados })
      });
      console.log('✅ Productos guardados:', await pRes.json());

      Swal.fire('Éxito', 'Presupuesto y productos guardados correctamente.', 'success');
      ['presupuestoProveedor','presupuestoFecha','presupuestoNumero',
       'presupuestoImporte','presupuestoFechaPago'].forEach(id => {
        document.getElementById(id).value = '';
      });
      document.getElementById('presupuestoCondicion').value = 'pendiente';
      productosSeleccionados = [];
      tabla.innerHTML = '';

    } catch (err) {
      console.error('❌ Error:', err);
      Swal.fire('Error', err.message || 'Ocurrió un error al guardar.', 'error');
    }
  });

  document.getElementById('presupuestoFecha').addEventListener('change', function () {
    if (!this.value) return;
    const d = new Date(this.value);
    d.setDate(d.getDate() + 30);
    document.getElementById('presupuestoFechaPago').value = d.toISOString().split('T')[0];
  });

  document.getElementById('presupuestoNumero').addEventListener('blur', async () => {
    const proveedor = document.getElementById('presupuestoProveedor').value;
    const fecha     = document.getElementById('presupuestoFecha').value;
    const numero    = document.getElementById('presupuestoNumero').value;
    if (!proveedor || !fecha || !numero) return;
    try {
      const res  = await fetch(`/administracion/verificar-duplicado?tipo=presupuesto&proveedor=${proveedor}&fecha=${fecha}&numero=${encodeURIComponent(numero)}`);
      const data = await res.json();
      if (data.existe) Swal.fire({ icon:'warning', title:'Documento duplicado', text:'Ya existe un presupuesto con esos datos.', confirmButtonText:'Revisar' });
    } catch (err) { console.error('Error al verificar duplicado:', err); }
  });
});