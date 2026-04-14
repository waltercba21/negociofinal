document.addEventListener('DOMContentLoaded', () => {
  const modal = new bootstrap.Modal(document.getElementById('modalProductosFactura'));
  const btnAbrirModal = document.getElementById('btnAgregarProductosFactura');
  const buscador = document.getElementById('buscadorProducto');
  const resultados = document.getElementById('resultadosBusqueda');
  const tabla = document.getElementById('tablaProductosFactura').querySelector('tbody');
  const btnConfirmar = document.getElementById('btnConfirmarProductosFactura');
  const btnGuardarFactura = document.getElementById('btnGuardarFactura');

  // ── Selector de proveedor del modal principal ──
  const selectProveedor = document.getElementById('facturaProveedor');

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

      // Leer el proveedor seleccionado en el modal de factura
      const proveedorId = selectProveedor ? selectProveedor.value : '';

      let url = `/productos/api/buscar?q=${encodeURIComponent(query)}`;
      if (proveedorId) url += `&proveedor_id=${encodeURIComponent(proveedorId)}`;

      try {
        const res = await fetch(url, { signal });
        const productos = await res.json();

        if (buscador.value.trim() !== queryAlMomentoDelFetch) return;

        resultados.innerHTML = '';

        if (!productos.length) {
          // Mostrar mensaje cuando no hay resultados
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

          // Click en la fila también agrega (pero cierra)
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

  // Confirmar productos (guardar temporalmente)
  btnConfirmar.addEventListener('click', () => {
    if (!productosSeleccionados.length) {
      return Swal.fire('Atención', 'Debes agregar al menos un producto.', 'warning');
    }
    cerrarResultados();
    modal.hide();
    Swal.fire('Confirmado', 'Productos listos para guardar con la factura.', 'success');
  });

  // Guardar factura SIN comprobante de pago
  btnGuardarFactura.addEventListener('click', async () => {
    const administrador = document.getElementById('facturaAdministrador').value;
    const proveedor = document.getElementById('facturaProveedor').value;
    const fecha = document.getElementById('facturaFecha').value;
    const numero = document.getElementById('facturaNumero').value;
    const bruto = document.getElementById('facturaImporteBruto').value;
    const iva = document.getElementById('facturaIVA').value;
    const total = document.getElementById('facturaImporteTotal').value;
    const condicion = document.getElementById('facturaCondicion').value;
    const fecha_pago = document.getElementById('facturaFechaPago').value;

    if (!proveedor || !fecha || !numero || !bruto || !iva || !total || !fecha_pago || !condicion || !administrador) {
      let mensaje = 'Los siguientes campos son obligatorios:\n';
      if (!proveedor) mensaje += '- Proveedor\n';
      if (!fecha) mensaje += '- Fecha de factura\n';
      if (!numero) mensaje += '- Número de factura\n';
      if (!bruto) mensaje += '- Importe bruto\n';
      if (!iva) mensaje += '- IVA\n';
      if (!total) mensaje += '- Importe total\n';
      if (!fecha_pago) mensaje += '- Fecha de vencimiento\n';
      if (!condicion) mensaje += '- Condición de pago\n';
      if (!administrador) mensaje += '- Administrador\n';
      return Swal.fire('Faltan datos', mensaje, 'warning');
    }

    if (!productosSeleccionados.length) {
      const confirmacion = await Swal.fire({
        title: 'Factura sin productos',
        text: 'Estás por guardar una factura sin productos asociados. ¿Deseás continuar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar de todos modos',
        cancelButtonText: 'Cancelar'
      });
      if (!confirmacion.isConfirmed) return;
    }

    try {
      const formData = new FormData();
      formData.append('id_proveedor', proveedor);
      formData.append('fecha', fecha);
      formData.append('numero_factura', numero);
      formData.append('importe_bruto', bruto);
      formData.append('iva', iva);
      formData.append('importe_factura', total);
      formData.append('fecha_pago', fecha_pago);
      formData.append('condicion', condicion);
      formData.append('administrador', administrador);

      const res = await fetch('/administracion/api/facturas', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Error al guardar factura:', errorText);
        throw new Error('Error al guardar la factura (backend)');
      }

      const respuesta = await res.json();
      if (!respuesta.insertId) throw new Error('No se pudo crear la factura');

      const productosRes = await fetch('/administracion/api/factura/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facturaId: respuesta.insertId,
          items: productosSeleccionados
        })
      });

      if (!productosRes.ok) {
        const errorText = await productosRes.text();
        console.error('❌ Error al guardar productos:', errorText);
        throw new Error('Error al guardar productos');
      }

      await productosRes.json();

      Swal.fire('Éxito', 'Factura y productos guardados correctamente.', 'success');

      document.getElementById('facturaProveedor').value = '';
      document.getElementById('facturaFecha').value = '';
      document.getElementById('facturaNumero').value = '';
      document.getElementById('facturaImporteBruto').value = '';
      document.getElementById('facturaIVA').value = '';
      document.getElementById('facturaImporteTotal').value = '';
      document.getElementById('facturaFechaPago').value = '';
      document.getElementById('facturaCondicion').value = 'pendiente';
      productosSeleccionados = [];
      tabla.innerHTML = '';

    } catch (err) {
      console.error('❌ Error general al guardar factura o productos:', err);
      Swal.fire('Error', err.message || 'Ocurrió un error al guardar.', 'error');
    }
  });

  // Fecha de pago = fecha + 30 días
  const inputFechaFactura = document.getElementById('facturaFecha');
  const inputFechaPago = document.getElementById('facturaFechaPago');

  inputFechaFactura.addEventListener('change', () => {
    const valorFecha = inputFechaFactura.value;
    if (!valorFecha) return;
    const fecha = new Date(valorFecha);
    fecha.setDate(fecha.getDate() + 30);
    inputFechaPago.value = fecha.toISOString().split('T')[0];
  });

  // Verificación de duplicados
  document.getElementById('facturaNumero').addEventListener('blur', async () => {
    const tipo = 'factura';
    const proveedor = document.getElementById('facturaProveedor').value;
    const fecha = document.getElementById('facturaFecha').value;
    const numero = document.getElementById('facturaNumero').value;
    if (!proveedor || !fecha || !numero) return;
    try {
      const res = await fetch(`/administracion/verificar-duplicado?tipo=${tipo}&proveedor=${proveedor}&fecha=${fecha}&numero=${numero}`);
      const data = await res.json();
      if (data.existe) {
        Swal.fire({ icon: 'warning', title: 'Documento duplicado', text: `Ya existe una ${tipo} con esos datos.`, confirmButtonText: 'Revisar' });
      }
    } catch (err) {
      console.error('Error al verificar duplicado:', err);
    }
  });

  // Recalcular Importe Bruto desde Total + IVA
  const inputTotal = document.getElementById('facturaImporteTotal');
  const inputIVA = document.getElementById('facturaIVA');
  const inputBruto = document.getElementById('facturaImporteBruto');

  function recalcularBrutoDesdeTotal() {
    const total = parseFloat(inputTotal.value);
    const iva = parseFloat(inputIVA.value);
    if (isNaN(total) || isNaN(iva)) return;
    inputBruto.value = (total / (1 + (iva / 100))).toFixed(2);
  }

  inputTotal.addEventListener('input', recalcularBrutoDesdeTotal);
  inputIVA.addEventListener('change', recalcularBrutoDesdeTotal);

  const btnGuardarCambios = document.getElementById('btnGuardarCambiosDocumento');
});