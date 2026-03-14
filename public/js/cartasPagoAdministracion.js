/* public/js/cartasPagoAdministracion.js
   Autofaros — Carta de Pago v1.0
   ─────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // ── Elementos DOM ──────────────────────────────────────────────────────────
  const modalCarta      = new bootstrap.Modal(document.getElementById('modalCartaPago'));
  const modalHistorial  = new bootstrap.Modal(document.getElementById('modalHistorialCartas'));

  const selProveedor    = document.getElementById('cartaProveedor');
  const selTipo         = document.getElementById('cartaTipoDocumento');
  const btnCargarDocs   = document.getElementById('btnCargarDocumentos');
  const contenedorDocs  = document.getElementById('contenedorDocumentosDisponibles');
  const tablaSelBody    = document.getElementById('tablaDocumentosSeleccionados').querySelector('tbody');
  const spanTotal       = document.getElementById('cartaTotalDocumentos');

  const inputEfectivo   = document.getElementById('cartaEfectivo');
  const inputTransf     = document.getElementById('cartaTransferencia');
  const inputCheque     = document.getElementById('cartaCheque');
  const seccionCheque   = document.getElementById('seccionCheque');
  const spanTotalPago   = document.getElementById('cartaTotalPago');
  const spanDiferencia  = document.getElementById('cartaDiferencia');
  const alertDif        = document.getElementById('alertaDiferencia');

  const btnGuardar      = document.getElementById('btnGuardarCartaPago');
  const btnVerHistorial = document.getElementById('btnVerHistorialCartas');

  let documentosSeleccionados = []; // [{ tipo, id, numero, fecha, fecha_pago, importe }]

  // ── Abrir modal ────────────────────────────────────────────────────────────
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open="modalCartaPago"]')) {
      resetModal();
      modalCarta.show();
    }
  });

  // ── Reset completo del modal ───────────────────────────────────────────────
  function resetModal() {
    selProveedor.value     = '';
    selTipo.value          = 'factura';
    contenedorDocs.innerHTML = '<p class="cp-hint">Seleccioná un proveedor y hacé clic en <strong>Cargar documentos</strong>.</p>';
    documentosSeleccionados = [];
    renderTablaSeleccionados();
    ['cartaFecha','cartaAdministrador','cartaObservaciones',
     'cartaEfectivo','cartaTransferencia','cartaCheque',
     'cartaBancoCheque','cartaNumeroCheque','cartaFechaCheque'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('cartaFecha').value = new Date().toISOString().split('T')[0];
    seccionCheque.classList.add('d-none');
    actualizarTotalesPago();
  }

  // ── Cargar documentos disponibles ─────────────────────────────────────────
  btnCargarDocs.addEventListener('click', async () => {
    const idProv = selProveedor.value;
    const tipo   = selTipo.value;
    if (!idProv) {
      return Swal.fire('Atención', 'Seleccioná un proveedor primero.', 'warning');
    }

    contenedorDocs.innerHTML = '<p class="cp-hint"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</p>';

    try {
      const res  = await fetch(`/administracion/api/cartas-pago/documentos-disponibles?proveedor_id=${idProv}&tipo=${tipo}`);
      const docs = await res.json();

      if (!docs.length) {
        contenedorDocs.innerHTML = `<p class="cp-hint">No hay ${tipo === 'factura' ? 'facturas' : 'presupuestos'} pendientes para este proveedor.</p>`;
        return;
      }

      contenedorDocs.innerHTML = '';
      docs.forEach(doc => {
        const yaAgregado = documentosSeleccionados.some(d => d.tipo === doc.tipo && d.id === doc.id);
        const card = document.createElement('div');
        card.className = 'cp-doc-card' + (yaAgregado ? ' cp-doc-card--added' : '');
        card.dataset.id   = doc.id;
        card.dataset.tipo = doc.tipo;

        const imp = parseFloat(doc.importe) || 0;
        card.innerHTML = `
          <div class="cp-doc-card__header">
            <span class="cp-doc-badge cp-doc-badge--${doc.tipo}">${doc.tipo === 'factura' ? 'Factura' : 'Presupuesto'}</span>
            <span class="cp-doc-card__numero">${doc.numero_documento}</span>
          </div>
          <div class="cp-doc-card__body">
            <span class="cp-doc-card__fecha"><i class="fa-regular fa-calendar"></i> ${fmtFecha(doc.fecha_documento)}</span>
            ${doc.fecha_pago ? `<span class="cp-doc-card__venc ${esVencido(doc.fecha_pago) ? 'cp-doc-card__venc--danger' : ''}">
              <i class="fa-solid fa-clock"></i> Vence: ${fmtFecha(doc.fecha_pago)}
            </span>` : ''}
            <span class="cp-doc-card__importe">$ ${fmtMonto(imp)}</span>
          </div>
          <button class="cp-doc-card__btn ${yaAgregado ? 'cp-doc-card__btn--added' : ''}" data-id="${doc.id}" data-tipo="${doc.tipo}">
            ${yaAgregado ? '<i class="fa-solid fa-check"></i> Agregado' : '<i class="fa-solid fa-plus"></i> Agregar'}
          </button>
        `;

        card.querySelector('.cp-doc-card__btn').addEventListener('click', () => {
          toggleDocumento(doc, card);
        });

        contenedorDocs.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      contenedorDocs.innerHTML = '<p class="cp-hint cp-hint--error">Error al cargar documentos.</p>';
    }
  });

  // ── Toggle agregar/quitar documento ───────────────────────────────────────
  function toggleDocumento(doc, card) {
    const idx = documentosSeleccionados.findIndex(d => d.tipo === doc.tipo && d.id === doc.id);
    const btn = card.querySelector('.cp-doc-card__btn');

    if (idx === -1) {
      documentosSeleccionados.push({
        tipo:             doc.tipo,
        id:               doc.id,
        numero_documento: doc.numero_documento,
        fecha_documento:  doc.fecha_documento,
        fecha_pago:       doc.fecha_pago,
        importe:          parseFloat(doc.importe) || 0,
      });
      card.classList.add('cp-doc-card--added');
      btn.classList.add('cp-doc-card__btn--added');
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Agregado';
    } else {
      documentosSeleccionados.splice(idx, 1);
      card.classList.remove('cp-doc-card--added');
      btn.classList.remove('cp-doc-card__btn--added');
      btn.innerHTML = '<i class="fa-solid fa-plus"></i> Agregar';
    }

    renderTablaSeleccionados();
    actualizarTotalesPago();
  }

  // ── Render tabla de documentos seleccionados ───────────────────────────────
  function renderTablaSeleccionados() {
    tablaSelBody.innerHTML = '';
    let total = 0;

    documentosSeleccionados.forEach((doc, i) => {
      total += doc.importe;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="cp-doc-badge cp-doc-badge--${doc.tipo}">${doc.tipo === 'factura' ? 'Factura' : 'Presupuesto'}</span></td>
        <td class="fw-semibold">${doc.numero_documento}</td>
        <td>${fmtFecha(doc.fecha_documento)}</td>
        <td class="${esVencido(doc.fecha_pago) ? 'text-danger fw-bold' : ''}">${fmtFecha(doc.fecha_pago)}</td>
        <td class="text-end fw-semibold">$ ${fmtMonto(doc.importe)}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-danger boton-quitar-doc" data-idx="${i}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
      tr.querySelector('.boton-quitar-doc').addEventListener('click', () => {
        quitarDocumentoDesdTabla(i);
      });
      tablaSelBody.appendChild(tr);
    });

    spanTotal.textContent = '$ ' + fmtMonto(total);

    // Mostrar/ocultar placeholder
    const placeholder = document.getElementById('tablaDocumentosPlaceholder');
    if (placeholder) placeholder.style.display = documentosSeleccionados.length ? 'none' : 'table-row';
  }

  // ── Quitar desde tabla ─────────────────────────────────────────────────────
  function quitarDocumentoDesdTabla(idx) {
    documentosSeleccionados.splice(idx, 1);
    renderTablaSeleccionados();
    actualizarTotalesPago();
    // Re-render cards si están visibles
    document.querySelectorAll('.cp-doc-card').forEach(card => {
      const tipo = card.dataset.tipo;
      const id   = parseInt(card.dataset.id);
      const btn  = card.querySelector('.cp-doc-card__btn');
      const estaEnLista = documentosSeleccionados.some(d => d.tipo === tipo && d.id === id);
      card.classList.toggle('cp-doc-card--added', estaEnLista);
      btn.classList.toggle('cp-doc-card__btn--added', estaEnLista);
      btn.innerHTML = estaEnLista
        ? '<i class="fa-solid fa-check"></i> Agregado'
        : '<i class="fa-solid fa-plus"></i> Agregar';
    });
  }

  // ── Cheque: mostrar/ocultar sección ───────────────────────────────────────
  inputCheque.addEventListener('input', () => {
    const v = parseFloat(inputCheque.value) || 0;
    seccionCheque.classList.toggle('d-none', v <= 0);
    actualizarTotalesPago();
  });

  inputEfectivo.addEventListener('input',  actualizarTotalesPago);
  inputTransf.addEventListener('input',    actualizarTotalesPago);

  // ── Calcular totales de pago ───────────────────────────────────────────────
  function actualizarTotalesPago() {
    const totalDocs  = documentosSeleccionados.reduce((s, d) => s + d.importe, 0);
    const efectivo   = parseFloat(inputEfectivo.value) || 0;
    const transf     = parseFloat(inputTransf.value)   || 0;
    const cheque     = parseFloat(inputCheque.value)   || 0;
    const totalPago  = efectivo + transf + cheque;
    const diferencia = totalPago - totalDocs;

    spanTotalPago.textContent  = '$ ' + fmtMonto(totalPago);
    spanDiferencia.textContent = (diferencia >= 0 ? '+' : '') + '$ ' + fmtMonto(diferencia);

    spanDiferencia.className = 'fw-bold ' + (
      Math.abs(diferencia) < 0.01 ? 'text-success' :
      diferencia > 0 ? 'text-warning' : 'text-danger'
    );

    if (alertDif) {
      alertDif.classList.toggle('d-none', Math.abs(diferencia) < 0.01);
      if (Math.abs(diferencia) >= 0.01) {
        alertDif.textContent = diferencia > 0
          ? `⚠️ El pago excede el total en $ ${fmtMonto(Math.abs(diferencia))}`
          : `⚠️ El pago es menor al total en $ ${fmtMonto(Math.abs(diferencia))}`;
      }
    }
  }

  // ── Guardar carta ──────────────────────────────────────────────────────────
  btnGuardar.addEventListener('click', async () => {
    const idProv   = selProveedor.value;
    const fecha    = document.getElementById('cartaFecha').value;
    const admin    = document.getElementById('cartaAdministrador').value;
    const obs      = document.getElementById('cartaObservaciones').value;
    const efectivo = parseFloat(inputEfectivo.value) || 0;
    const transf   = parseFloat(inputTransf.value)   || 0;
    const cheque   = parseFloat(inputCheque.value)   || 0;

    // Validaciones
    const errores = [];
    if (!idProv)    errores.push('Proveedor');
    if (!fecha)     errores.push('Fecha');
    if (!admin)     errores.push('Administrador');
    if (!documentosSeleccionados.length) errores.push('Al menos un documento');
    if (efectivo + transf + cheque <= 0) errores.push('Al menos un medio de pago con monto > 0');

    if (errores.length) {
      return Swal.fire('Faltan datos', 'Completá: ' + errores.join(', '), 'warning');
    }

    const totalDocs = documentosSeleccionados.reduce((s, d) => s + d.importe, 0);
    const totalPago = efectivo + transf + cheque;
    const diferencia = Math.abs(totalPago - totalDocs);

    // Advertir si hay diferencia pero permitir continuar
    if (diferencia >= 0.01) {
      const confirmar = await Swal.fire({
        icon: 'warning',
        title: 'Diferencia en los montos',
        html: `El total de documentos es <strong>$ ${fmtMonto(totalDocs)}</strong> y el total a pagar es <strong>$ ${fmtMonto(totalPago)}</strong>.<br>¿Deseás continuar de todas formas?`,
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Revisar',
      });
      if (!confirmar.isConfirmed) return;
    }

    const payload = {
      id_proveedor:        idProv,
      fecha,
      administrador:       admin,
      observaciones:       obs,
      monto_efectivo:      efectivo,
      monto_transferencia: transf,
      monto_cheque:        cheque,
      banco_cheque:        document.getElementById('cartaBancoCheque').value || null,
      numero_cheque:       document.getElementById('cartaNumeroCheque').value || null,
      fecha_cheque:        document.getElementById('cartaFechaCheque').value || null,
      total_documentos:    totalDocs,
      total_pagado:        totalPago,
      items: documentosSeleccionados.map(d => ({
        tipo_documento:   d.tipo,
        documento_id:     d.id,
        numero_documento: d.numero_documento,
        fecha_documento:  d.fecha_documento,
        importe:          d.importe,
      })),
    };

    try {
      btnGuardar.disabled = true;
      btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

      const res  = await fetch('/administracion/api/cartas-pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.insertId) throw new Error(data.error || 'Error desconocido');

      modalCarta.hide();

      const resultado = await Swal.fire({
        icon: 'success',
        title: `Carta ${data.numero} guardada`,
        html: `La carta de pago fue registrada correctamente.<br>
               <small class="text-muted">ID interno: #${data.insertId}</small>`,
        showDenyButton:    true,
        showCancelButton:  false,
        confirmButtonText: '<i class="fa-solid fa-file-pdf"></i> Descargar PDF',
        denyButtonText:    'Cerrar',
        denyButtonColor:   '#6b7a99',
      });

      if (resultado.isConfirmed) {
        window.open(`/administracion/api/cartas-pago/${data.insertId}/pdf`, '_blank');
      }

    } catch (err) {
      console.error('❌ Error al guardar carta de pago:', err);
      Swal.fire('Error', err.message || 'No se pudo guardar la carta de pago.', 'error');
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Carta';
    }
  });

  // ── Ver historial ──────────────────────────────────────────────────────────
  btnVerHistorial.addEventListener('click', async () => {
    modalHistorial.show();
    await cargarHistorial();
  });

  async function cargarHistorial() {
    const tbody = document.getElementById('tablaHistorialCartas').querySelector('tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</td></tr>';

    try {
      const filtroP = document.getElementById('historialFiltroProveedor')?.value || '';
      const filtroE = document.getElementById('historialFiltroEstado')?.value    || '';
      let url = '/administracion/api/cartas-pago?';
      if (filtroP) url += `proveedor_id=${filtroP}&`;
      if (filtroE) url += `estado=${filtroE}&`;

      const res   = await fetch(url);
      const lista = await res.json();

      tbody.innerHTML = '';

      if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">No hay cartas de pago registradas.</td></tr>';
        return;
      }

      lista.forEach(carta => {
        const estadoClass = {
          emitida:  'badge bg-success',
          borrador: 'badge bg-warning text-dark',
          anulada:  'badge bg-danger',
        }[carta.estado] || 'badge bg-secondary';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="fw-semibold">${carta.numero}</td>
          <td>${fmtFecha(carta.fecha)}</td>
          <td>${carta.nombre_proveedor}</td>
          <td>$ ${fmtMonto(carta.total_documentos)}</td>
          <td>$ ${fmtMonto(carta.total_pagado)}</td>
          <td><span class="${estadoClass}">${carta.estado}</span></td>
          <td class="text-center">
            <a href="/administracion/api/cartas-pago/${carta.id}/pdf" target="_blank"
               class="btn btn-sm btn-primary me-1" title="Ver PDF">
              <i class="fa-solid fa-file-pdf"></i>
            </a>
            ${carta.estado !== 'anulada' ? `
            <button class="btn btn-sm btn-danger btn-anular-carta" data-id="${carta.id}" data-numero="${carta.numero}" title="Anular">
              <i class="fa-solid fa-ban"></i>
            </button>` : ''}
          </td>
        `;

        tr.querySelector('.btn-anular-carta')?.addEventListener('click', () => anularCarta(carta.id, carta.numero));
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar historial.</td></tr>';
    }
  }

  // Filtros historial
  document.getElementById('btnBuscarHistorialCartas')?.addEventListener('click', cargarHistorial);

  // ── Anular ─────────────────────────────────────────────────────────────────
  async function anularCarta(id, numero) {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: `Anular ${numero}`,
      text: 'Esta acción no se puede deshacer. ¿Confirmás la anulación?',
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      confirmButtonColor: '#dc3545',
      cancelButtonText: 'Cancelar',
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/administracion/api/cartas-pago/${id}/anular`, { method: 'PUT' });
      const data = await res.json();
      if (!data.ok) throw new Error();
      Swal.fire('Anulada', `La carta ${numero} fue anulada.`, 'success');
      cargarHistorial();
    } catch {
      Swal.fire('Error', 'No se pudo anular la carta.', 'error');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function fmtFecha(val) {
    if (!val) return '-';
    const d = new Date(val);
    if (isNaN(d)) return val;
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }

  function fmtMonto(n) {
    return (parseFloat(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function esVencido(fechaVal) {
    if (!fechaVal) return false;
    return new Date(fechaVal) < new Date();
  }
});
