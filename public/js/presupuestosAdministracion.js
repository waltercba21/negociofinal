document.addEventListener('DOMContentLoaded', () => {
  const modal = new bootstrap.Modal(document.getElementById('modalProductosPresupuesto'));
  const btnAbrirModal = document.getElementById('btnAgregarProductosPresupuesto');
  const buscador = document.getElementById('buscadorProductoPresupuesto');
  const resultados = document.getElementById('resultadosBusquedaPresupuesto');
  const tabla = document.getElementById('tablaProductosPresupuesto').querySelector('tbody');
  const btnConfirmar = document.getElementById('btnConfirmarProductosPresupuesto');
  const btnGuardarPresupuesto = document.getElementById('btnGuardarPresupuesto');

  // ── Selector de proveedor del modal principal ──
  const selectProveedor = document.getElementById('presupuestoProveedor');

  let productosSeleccionados = [];

  let debounceTimer = null;
  let controladorActual = null;

  // ── ESTILOS: el dropdown flota sobre el contenido sin desplazar nada ──
  Object.assign(resultados.style, {
    position:  'absolute',
    top:       '100%',
    left:      '0',
    right:     '0',
    zIndex:    '9999',
    maxHeight: '260px',
    overflowY: 'auto',
    display:   'none',
    margin:    '0',
    padding:   '0',
    border:    '1px solid rgba(0,0,0,.15)',
    borderRadius: '0 0 6px 6px',
    backgroundColor: '#fff',
    boxShadow: '0 6px 20px rgba(0,0,0,.18)'
  });

  // El contenedor del buscador debe ser position:relative para que el absolute funcione
  const wrapBuscador = buscador.parentElement;
  if (getComputedStyle(wrapBuscador).position === 'static') {
    wrapBuscador.style.position = 'relative';
  }

  // ── Cerrar resultados con Escape o clic fuera ──
  buscador.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarResultados();
  });
  document.addEventListener('click', (e) => {
    if (!wrapBuscador.contains(e.target)) cerrarResultados();
  });

  function cerrarResultados() {
    resultados.innerHTML = '';
    resultados.style.display = 'none';
  }

  btnAbrirModal.addEventListener('click', () => {
    modal.show();
    buscador.value = '';
    cerrarResultados();
    tabla.innerHTML = '';
    renderizarTabla();
  });

  buscador.addEventListener('input', () => {
    const query = buscador.value.trim();

    cerrarResultados();

    if (controladorActual) {
      controladorActual.abort();
      controladorActual = null;
    }
    clearTimeout(debounceTimer);

    if (query.length < 2) return;

    debounceTimer = setTimeout(async () => {
      controladorActual = new AbortController();
      const signal = controladorActual.signal;
      const queryAlMomentoDelFetch = buscador.value.trim();

      // Leer el proveedor seleccionado en el modal de presupuesto
      const proveedorId = selectProveedor ? selectProveedor.value : '';

      let url = `/productos/api/buscar?q=${encodeURIComponent(query)}`;
      if (proveedorId) url += `&proveedor_id=${encodeURIComponent(proveedorId)}`;

      try {
        const res = await fetch(url, { signal });
        const productos = await res.json();

        if (buscador.value.trim() !== queryAlMomentoDelFetch) return;

        resultados.innerHTML = '';

        if (!productos.length) {
          const sinResultados = document.createElement('div');
          sinResultados.style.cssText = 'padding:10px 14px;color:#666;font-size:13px;';
          sinResultados.textContent = proveedorId
            ? 'No se encontraron productos de este proveedor.'
            : 'No se encontraron productos.';
          resultados.appendChild(sinResultados);
          resultados.style.display = 'block';
          return;
        }

        productos.forEach(producto => {
          const item = document.createElement('div');
          item.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 7px 10px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
            gap: 8px;
          `;
          item.addEventListener('mouseenter', () => item.style.backgroundColor = '#f5f7fa');
          item.addEventListener('mouseleave', () => item.style.backgroundColor = '');

          // Parte izquierda: imagen + nombre
          const izquierda = document.createElement('div');
          izquierda.style.cssText = 'display:flex;align-items:center;gap:8px;flex:1;min-width:0;';

          if (producto.imagenes && producto.imagenes.length > 0) {
            const img = document.createElement('img');
            img.src = '/uploads/productos/' + producto.imagenes[0].imagen;
            img.style.cssText = 'width:36px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0;';
            izquierda.appendChild(img);
          }

          const nombre = document.createElement('span');
          nombre.textContent = producto.nombre;
          nombre.style.cssText = 'font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
          izquierda.appendChild(nombre);

          // Botón "+" (agrega sin cerrar el dropdown)
          const btnAgregar = document.createElement('button');
          btnAgregar.type = 'button';
          btnAgregar.textContent = '+';
          btnAgregar.style.cssText = `
            flex-shrink: 0;
            width: 28px; height: 28px;
            border-radius: 50%;
            border: none;
            background: #198754;
            color: #fff;
            font-size: 18px;
            line-height: 1;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            transition: background .15s;
          `;
          btnAgregar.addEventListener('mouseenter', () => btnAgregar.style.background = '#146c43');
          btnAgregar.addEventListener('mouseleave', () => btnAgregar.style.background = '#198754');
          btnAgregar.addEventListener('click', (e) => {
            e.stopPropagation();
            agregarProducto(producto, btnAgregar);
          });

          item.appendChild(izquierda);
          item.appendChild(btnAgregar);

          // Click en la fila también agrega
          item.addEventListener('click', () => {
            agregarProducto(producto, btnAgregar);
          });

          resultados.appendChild(item);
        });

        resultados.style.display = 'block';

      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('❌ Error al buscar productos:', err);
      }
    }, 350);
  });

  function agregarProducto(prod, btnRef) {
    const yaExiste = productosSeleccionados.some(p => p.id === prod.id);

    if (!yaExiste) {
      productosSeleccionados.push({
        id: prod.id,
        nombre: prod.nombre,
        proveedores: prod.proveedores || [],
        imagenes: prod.imagenes || [],
        cantidad: 1
      });
      renderizarTabla();
    }

    // Feedback visual en el botón: check verde momentáneo
    if (btnRef) {
      const textoOriginal = btnRef.textContent;
      btnRef.textContent = '✓';
      btnRef.style.background = yaExiste ? '#6c757d' : '#146c43';
      setTimeout(() => {
        btnRef.textContent = textoOriginal;
        btnRef.style.background = yaExiste ? '#6c757d' : '#198754';
      }, 800);
    }
  }

  function renderizarTabla() {
    tabla.innerHTML = '';
    productosSeleccionados.forEach(prod => {
      const fila = document.createElement('tr');
      fila.dataset.id = prod.id;

      const codigoProveedor = (prod.proveedores && prod.proveedores[0]?.codigo) || '-';
      const imagenSrc = (prod.imagenes?.[0]?.imagen)
        ? '/uploads/productos/' + prod.imagenes[0].imagen
        : '/uploads/noimg.jpg';

      fila.innerHTML = `
        <td>${codigoProveedor}</td>
        <td>${prod.nombre}</td>
        <td><img src="${imagenSrc}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;"></td>
        <td>
          <input type="number" class="form-control form-control-sm cantidad-input" value="${prod.cantidad}" min="1" style="width:80px;margin:auto;">
        </td>
        <td>
          <button class="btn btn-sm btn-danger boton-eliminar-factura">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;

      fila.querySelector('.cantidad-input').addEventListener('input', (e) => {
        const cantidad = parseInt(e.target.value);
        const item = productosSeleccionados.find(p => p.id === prod.id);
        item.cantidad = isNaN(cantidad) ? 1 : cantidad;
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
    const proveedor = document.getElementById('presupuestoProveedor').value;
    const fecha = document.getElementById('presupuestoFecha').value;
    const numero = document.getElementById('presupuestoNumero').value;
    const importe = document.getElementById('presupuestoImporte').value;
    const condicion = document.getElementById('presupuestoCondicion').value;
    const fecha_pago = document.getElementById('presupuestoFechaPago').value;
    const administrador = document.getElementById('presupuestoAdministrador').value;

    if (!proveedor || !fecha || !numero || !importe || !condicion || !fecha_pago || !administrador) {
      let mensaje = 'Los siguientes campos son obligatorios:\n';
      if (!proveedor) mensaje += '- Proveedor\n';
      if (!fecha) mensaje += '- Fecha del presupuesto\n';
      if (!numero) mensaje += '- Número\n';
      if (!importe) mensaje += '- Importe\n';
      if (!fecha_pago) mensaje += '- Fecha de vencimiento\n';
      if (!condicion) mensaje += '- Condición de pago\n';
      if (!administrador) mensaje += '- Administrador\n';
      return Swal.fire('Faltan datos', mensaje, 'warning');
    }

    if (!productosSeleccionados.length) {
      const confirmacion = await Swal.fire({
        title: 'Presupuesto sin productos',
        text: 'Estás por guardar un presupuesto sin productos asociados. ¿Deseás continuar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar de todos modos',
        cancelButtonText: 'Cancelar'
      });
      if (!confirmacion.isConfirmed) return;
    }

    try {
      const res = await fetch('/administracion/api/presupuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_proveedor: proveedor,
          fecha,
          numero_presupuesto: numero,
          importe,
          condicion,
          fecha_pago,
          administrador
        })
      });

      const respuesta = await res.json();
      if (!respuesta.insertId) throw new Error('No se pudo crear el presupuesto');

      const productosRes = await fetch('/administracion/api/presupuestos/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presupuestoId: respuesta.insertId,
          items: productosSeleccionados
        })
      });

      const productosResp = await productosRes.json();
      console.log('✅ Productos guardados:', productosResp);

      Swal.fire('Éxito', 'Presupuesto y productos guardados correctamente.', 'success');

      document.getElementById('presupuestoProveedor').value = '';
      document.getElementById('presupuestoFecha').value = '';
      document.getElementById('presupuestoNumero').value = '';
      document.getElementById('presupuestoImporte').value = '';
      document.getElementById('presupuestoFechaPago').value = '';
      document.getElementById('presupuestoCondicion').value = 'pendiente';
      productosSeleccionados = [];
      tabla.innerHTML = '';

    } catch (err) {
      console.error('❌ Error general al guardar presupuesto o productos:', err);
      Swal.fire('Error', err.message || 'Ocurrió un error al guardar.', 'error');
    }
  });

  // Cálculo automático de fecha de pago
  const inputFechaPresupuesto = document.getElementById('presupuestoFecha');
  const inputFechaPago = document.getElementById('presupuestoFechaPago');

  inputFechaPresupuesto.addEventListener('change', () => {
    const valorFecha = inputFechaPresupuesto.value;
    if (!valorFecha) return;
    const fecha = new Date(valorFecha);
    fecha.setDate(fecha.getDate() + 30);
    inputFechaPago.value = fecha.toISOString().split('T')[0];
  });

  document.getElementById('presupuestoNumero').addEventListener('blur', async () => {
    const tipo = 'presupuesto';
    const proveedor = document.getElementById('presupuestoProveedor').value;
    const fecha = document.getElementById('presupuestoFecha').value;
    const numero = document.getElementById('presupuestoNumero').value;
    if (!proveedor || !fecha || !numero) return;
    try {
      const res = await fetch(`/administracion/verificar-duplicado?tipo=${tipo}&proveedor=${proveedor}&fecha=${fecha}&numero=${encodeURIComponent(numero)}`);
      const data = await res.json();
      if (data.existe) {
        Swal.fire({ icon: 'warning', title: 'Documento duplicado', text: `Ya existe una ${tipo} con esos datos.`, confirmButtonText: 'Revisar' });
      }
    } catch (err) {
      console.error('Error al verificar duplicado:', err);
    }
  });
});