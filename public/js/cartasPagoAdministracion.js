/* public/js/cartasPagoAdministracion.js — v2
   Autofaros — Carta de Pago con notas de crédito y pagos parciales
   ─────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // ── Modales Bootstrap ──────────────────────────────────────────────────────
  const modalCarta     = new bootstrap.Modal(document.getElementById('modalCartaPago'));
  const modalHistorial = new bootstrap.Modal(document.getElementById('modalHistorialCartas'));

  // ── Elementos DOM ──────────────────────────────────────────────────────────
  const selProveedor   = document.getElementById('cartaProveedor');
  const selTipo        = document.getElementById('cartaTipoDocumento');
  const btnCargarDocs  = document.getElementById('btnCargarDocumentos');
  const contenedorDocs = document.getElementById('contenedorDocumentosDisponibles');
  const tablaSelBody   = document.getElementById('tablaDocumentosSeleccionados').querySelector('tbody');
  const spanTotal      = document.getElementById('cartaTotalDocumentos');
  const inputEfectivo  = document.getElementById('cartaEfectivo');
  const inputTransf    = document.getElementById('cartaTransferencia');
  const inputCheque    = document.getElementById('cartaCheque');
  const seccionCheque  = document.getElementById('seccionCheque');
  const spanTotalPago  = document.getElementById('cartaTotalPago');
  const spanDiferencia = document.getElementById('cartaDiferencia');
  const alertDif       = document.getElementById('alertaDiferencia');
  const btnGuardar     = document.getElementById('btnGuardarCartaPago');
  const btnVerHistorial= document.getElementById('btnVerHistorialCartas');

  // ── Estado ─────────────────────────────────────────────────────────────────
  // Cada ítem: { tipo, id, numero_documento, fecha_documento, fecha_pago,
  //              importe (saldo pendiente real), importe_original,
  //              nota_credito_id, nota_credito_numero, nota_credito_importe,
  //              tipo_pago ('total'|'parcial'), importe_abonado, saldo_pendiente }
  let documentosSeleccionados = [];
  let notasCreditoDisponibles = [];

  // ── Abrir modal ────────────────────────────────────────────────────────────
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open="modalCartaPago"]')) {
      resetModal();
      modalCarta.show();
    }
  });

  function resetModal() {
    selProveedor.value = '';
    selTipo.value = 'factura';
    contenedorDocs.innerHTML = '<p class="cp-hint">Seleccioná un proveedor y hacé clic en <strong>Cargar documentos</strong>.</p>';
    documentosSeleccionados = [];
    notasCreditoDisponibles = [];
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

  // ── Cambio de proveedor → limpiar documentos y cargar notas ───────────────
  selProveedor.addEventListener('change', () => {
    documentosSeleccionados = [];
    notasCreditoDisponibles = [];
    contenedorDocs.innerHTML = '<p class="cp-hint">Seleccioná un proveedor y hacé clic en <strong>Cargar documentos</strong>.</p>';
    renderTablaSeleccionados();
    actualizarTotalesPago();

    const idProv = selProveedor.value;
    if (!idProv) return;

    // Cargar notas de crédito en segundo plano
    fetch(`/administracion/api/cartas-pago/notas-credito-disponibles?proveedor_id=${idProv}`)
      .then(r => r.json())
      .then(data => { notasCreditoDisponibles = data; })
      .catch(err => console.error('Error cargando notas de crédito:', err));
  });

  // ── Cargar documentos disponibles ─────────────────────────────────────────
  btnCargarDocs.addEventListener('click', async () => {
    const idProv = selProveedor.value;
    const tipo   = selTipo.value;
    if (!idProv) return Swal.fire('Atención', 'Seleccioná un proveedor primero.', 'warning');

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
        const saldo      = parseFloat(doc.saldo_pendiente || doc.importe) || 0;
        const abonado    = parseFloat(doc.total_abonado)  || 0;
        const tieneSaldo = abonado > 0;

        const card = document.createElement('div');
        card.className = 'cp-doc-card' + (yaAgregado ? ' cp-doc-card--added' : '');
        card.dataset.id   = doc.id;
        card.dataset.tipo = doc.tipo;

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
            ${tieneSaldo ? `<span class="cp-doc-card__abonado">Abonado: $ ${fmtMonto(abonado)}</span>` : ''}
            <span class="cp-doc-card__importe">Saldo: $ ${fmtMonto(saldo)}</span>
          </div>
          <button class="cp-doc-card__btn ${yaAgregado ? 'cp-doc-card__btn--added' : ''}">
            ${yaAgregado ? '<i class="fa-solid fa-check"></i> Agregado' : '<i class="fa-solid fa-plus"></i> Agregar'}
          </button>
        `;

        card.querySelector('.cp-doc-card__btn').addEventListener('click', () => {
          toggleDocumento({
            tipo:              doc.tipo,
            id:                doc.id,
            numero_documento:  doc.numero_documento,
            fecha_documento:   doc.fecha_documento,
            fecha_pago:        doc.fecha_pago,
            importe:           saldo,           // saldo actual (lo que se debe)
            importe_original:  parseFloat(doc.importe) || saldo,
            total_abonado:     abonado,
          }, card);
        });

        contenedorDocs.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      contenedorDocs.innerHTML = '<p class="cp-hint cp-hint--error">Error al cargar documentos.</p>';
    }
  });

  // ── Toggle agregar/quitar ──────────────────────────────────────────────────
  function toggleDocumento(doc, card) {
    const idx = documentosSeleccionados.findIndex(d => d.tipo === doc.tipo && d.id === doc.id);
    const btn = card.querySelector('.cp-doc-card__btn');

    if (idx === -1) {
      documentosSeleccionados.push({
        ...doc,
        nota_credito_id:      null,
        nota_credito_numero:  null,
        nota_credito_importe: 0,
        tipo_pago:            'total',
        importe_abonado:      null,   // se calcula al guardar según medios de pago
        saldo_pendiente:      null,   // se calcula al guardar
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

  // ── Helpers de estado visual en tabla ────────────────────────────────────
  function estadoSaldoHTML(doc) {
    const neto = Math.max(doc.importe - (doc.nota_credito_importe || 0), 0);
    if (doc.tipo_pago === 'total') {
      return '<span class="badge" style="background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.3);font-size:10px;">Se abona el total</span>';
    }
    // Pago parcial
    const abonado = doc.importe_abonado || 0;
    const saldo   = parseFloat((neto - abonado).toFixed(2));
    if (saldo <= 0) {
      return '<span class="badge" style="background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.3);font-size:10px;">Se abona el total</span>';
    }
    return `<span class="fw-bold text-danger">$ ${fmtMonto(saldo)} pendiente</span>`;
  }

  // ── Render tabla de documentos seleccionados ───────────────────────────────
  function renderTablaSeleccionados() {
    tablaSelBody.innerHTML = '';
    let totalDocs = 0;

    documentosSeleccionados.forEach((doc, idx) => {
      const netoPagar = doc.importe - doc.nota_credito_importe; // saldo - NC
      totalDocs += Math.max(netoPagar, 0);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="cp-doc-badge cp-doc-badge--${doc.tipo}">${doc.tipo === 'factura' ? 'Factura' : 'Presupuesto'}</span></td>
        <td class="fw-semibold">${doc.numero_documento}</td>
        <td>${fmtFecha(doc.fecha_documento)}</td>
        <td class="${esVencido(doc.fecha_pago) ? 'text-danger fw-bold' : ''}">${fmtFecha(doc.fecha_pago)}</td>
        <td class="text-end">$ ${fmtMonto(doc.importe)}</td>
        <td class="text-center">
          ${renderSelectorNC(doc, idx)}
        </td>
        <td class="text-end fw-bold ${doc.nota_credito_importe > 0 ? 'text-warning' : ''}">
          - $ ${fmtMonto(doc.nota_credito_importe)}
        </td>
        <td>
          ${renderSelectorTipoPago(doc, idx)}
        </td>
        <td class="text-end fw-bold">
          ${doc.tipo_pago === 'parcial' && doc.importe_abonado != null
            ? '$ ' + fmtMonto(doc.importe_abonado)
            : '<span class="text-muted" style="font-size:11px;">—</span>'}
        </td>
        <td class="text-end">
          ${estadoSaldoHTML(doc)}
        </td>
        <td class="text-center">
          <button class="btn btn-sm btn-danger boton-quitar-doc" data-idx="${idx}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;

      // Selector de nota de crédito
      const selNC = tr.querySelector('.sel-nota-credito');
      if (selNC) {
        selNC.addEventListener('change', () => aplicarNotaCredito(idx, selNC.value));
      }

      // Selector tipo pago
      const selTipoPago = tr.querySelector('.sel-tipo-pago');
      if (selTipoPago) {
        selTipoPago.addEventListener('change', () => cambiarTipoPago(idx, selTipoPago.value, tr));
      }

      // Input pago parcial
      const inputParcial = tr.querySelector('.input-pago-parcial');
      if (inputParcial) {
        inputParcial.addEventListener('input', () => actualizarPagoParcial(idx, inputParcial.value));
      }

      tr.querySelector('.boton-quitar-doc').addEventListener('click', () => {
        documentosSeleccionados.splice(idx, 1);
        sincronizarCardsConLista();
        renderTablaSeleccionados();
        actualizarTotalesPago();
      });

      tablaSelBody.appendChild(tr);
    });

    spanTotal.textContent = '$ ' + fmtMonto(totalDocs);

    const placeholder = document.getElementById('tablaDocumentosPlaceholder');
    if (placeholder) placeholder.style.display = documentosSeleccionados.length ? 'none' : 'table-row';

    actualizarTotalesPago();
  }

  function renderSelectorNC(doc, idx) {
    if (!notasCreditoDisponibles.length) return '<span class="text-muted" style="font-size:11px;">Sin NC</span>';

    let opts = '<option value="">Sin nota de crédito</option>';
    notasCreditoDisponibles.forEach(nc => {
      const sel = doc.nota_credito_id == nc.id ? 'selected' : '';
      opts += `<option value="${nc.id}" data-importe="${nc.importe_total}" ${sel}>${nc.numero_nota_credito} — $ ${fmtMonto(nc.importe_total)}</option>`;
    });
    return `<select class="form-select form-select-sm sel-nota-credito" style="min-width:160px;">${opts}</select>`;
  }

  function renderSelectorTipoPago(doc, idx) {
    const netoPagar = Math.max(doc.importe - doc.nota_credito_importe, 0);
    const esParcial = doc.tipo_pago === 'parcial';
    return `
      <div class="d-flex flex-column gap-1" style="min-width:150px;">
        <select class="form-select form-select-sm sel-tipo-pago">
          <option value="total"   ${!esParcial ? 'selected' : ''}>Pago total</option>
          <option value="parcial" ${ esParcial ? 'selected' : ''}>Pago parcial</option>
        </select>
        ${esParcial ? `
        <div class="input-group input-group-sm">
          <span class="input-group-text">$</span>
          <input type="number" class="form-control input-pago-parcial"
                 value="${fmtMontoPlain(doc.importe_abonado)}"
                 min="0" max="${netoPagar}" step="0.01"
                 placeholder="Monto a abonar">
        </div>` : ''}
      </div>
    `;
  }

  // ── Aplicar nota de crédito a un ítem ─────────────────────────────────────
  function aplicarNotaCredito(idx, ncId) {
    const doc = documentosSeleccionados[idx];
    if (!ncId) {
      doc.nota_credito_id      = null;
      doc.nota_credito_numero  = null;
      doc.nota_credito_importe = 0;
    } else {
      const nc = notasCreditoDisponibles.find(n => n.id == ncId);
      if (nc) {
        doc.nota_credito_id      = nc.id;
        doc.nota_credito_numero  = nc.numero_nota_credito;
        doc.nota_credito_importe = parseFloat(nc.importe_total) || 0;
      }
    }
    // Recalcular abonado y saldo según tipo de pago
    recalcularItem(idx);
    renderTablaSeleccionados();
    actualizarTotalesPago();
  }

  // ── Cambiar tipo de pago ───────────────────────────────────────────────────
  function cambiarTipoPago(idx, tipoPago, tr) {
    documentosSeleccionados[idx].tipo_pago = tipoPago;
    recalcularItem(idx);
    renderTablaSeleccionados();
    actualizarTotalesPago();
  }

  // ── Actualizar monto de pago parcial ──────────────────────────────────────
  function actualizarPagoParcial(idx, valor) {
    const doc         = documentosSeleccionados[idx];
    const netoPagar   = Math.max(doc.importe - doc.nota_credito_importe, 0);
    const abonado     = Math.min(parseFloat(valor) || 0, netoPagar);
    doc.importe_abonado  = abonado;
    doc.saldo_pendiente  = Math.max(netoPagar - abonado, 0);
    actualizarTotalesPago();
    // Refrescar solo el total sin re-renderizar toda la tabla
    spanTotal.textContent = '$ ' + fmtMonto(
      documentosSeleccionados.reduce((s, d) => s + Math.max(d.importe - d.nota_credito_importe, 0), 0)
    );
  }

  // ── Recalcular importe_abonado y saldo_pendiente de un ítem ───────────────
  function recalcularItem(idx) {
    const doc       = documentosSeleccionados[idx];
    const netoPagar = Math.max(doc.importe - doc.nota_credito_importe, 0);

    if (doc.tipo_pago === 'total') {
      // "Pago total" = intención de pagar todo; el estado real se define al guardar
      doc.importe_abonado = null;
      doc.saldo_pendiente = null;
    } else {
      // "Pago parcial" = el admin ingresa cuánto abona ahora
      const abonado = Math.min(doc.importe_abonado || 0, netoPagar);
      doc.importe_abonado = abonado;
      doc.saldo_pendiente = parseFloat((netoPagar - abonado).toFixed(2));
    }
  }

  // ── Sincronizar cards con la lista (para el botón quitar desde tabla) ──────
  function sincronizarCardsConLista() {
    document.querySelectorAll('.cp-doc-card').forEach(card => {
      const tipo = card.dataset.tipo;
      const id   = parseInt(card.dataset.id);
      const btn  = card.querySelector('.cp-doc-card__btn');
      const esta = documentosSeleccionados.some(d => d.tipo === tipo && d.id === id);
      card.classList.toggle('cp-doc-card--added', esta);
      if (btn) {
        btn.classList.toggle('cp-doc-card__btn--added', esta);
        btn.innerHTML = esta
          ? '<i class="fa-solid fa-check"></i> Agregado'
          : '<i class="fa-solid fa-plus"></i> Agregar';
      }
    });
  }

  // ── Totales de pago ────────────────────────────────────────────────────────
  inputCheque.addEventListener('input', () => {
    seccionCheque.classList.toggle('d-none', (parseFloat(inputCheque.value) || 0) <= 0);
    actualizarTotalesPago();
  });
  inputEfectivo.addEventListener('input', actualizarTotalesPago);
  inputTransf.addEventListener('input',   actualizarTotalesPago);

  function actualizarTotalesPago() {
    const totalDocs = documentosSeleccionados.reduce((s, d) => {
      return s + Math.max(d.importe - d.nota_credito_importe, 0);
    }, 0);
    const totalAbonado = documentosSeleccionados.reduce((s, d) => {
      const neto = Math.max(d.importe - d.nota_credito_importe, 0);
      return s + (d.tipo_pago === 'total' ? neto : (d.importe_abonado || 0));
    }, 0);

    const efectivo = parseFloat(inputEfectivo.value) || 0;
    const transf   = parseFloat(inputTransf.value)   || 0;
    const cheque   = parseFloat(inputCheque.value)   || 0;
    const totalPago = efectivo + transf + cheque;
    const diferencia = totalPago - totalAbonado;

    spanTotalPago.textContent  = '$ ' + fmtMonto(totalPago);
    spanDiferencia.textContent = (diferencia >= 0 ? '+' : '') + '$ ' + fmtMonto(diferencia);
    spanDiferencia.className   = 'fw-bold ' + (
      Math.abs(diferencia) < 0.01 ? 'text-success' :
      diferencia > 0 ? 'text-warning' : 'text-danger'
    );

    // Actualizar label total docs en resumen
    const el2 = document.getElementById('cartaTotalDocumentos2');
    if (el2) el2.textContent = '$ ' + fmtMonto(totalDocs);

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

    const errores = [];
    if (!idProv)  errores.push('Proveedor');
    if (!fecha)   errores.push('Fecha');
    if (!admin)   errores.push('Administrador');
    if (!documentosSeleccionados.length) errores.push('Al menos un documento');
    if (efectivo + transf + cheque <= 0) errores.push('Al menos un medio de pago con monto > 0');

    // Validar pagos parciales: el monto parcial no puede ser 0
    const parcialSinMonto = documentosSeleccionados.some(
      d => d.tipo_pago === 'parcial' && (!d.importe_abonado || d.importe_abonado <= 0)
    );
    if (parcialSinMonto) errores.push('Ingresá el monto a abonar en los pagos parciales');

    if (errores.length) return Swal.fire('Faltan datos', errores.join('\n'), 'warning');

    const totalAbonado = documentosSeleccionados.reduce((s, d) => {
      const neto = Math.max(d.importe - d.nota_credito_importe, 0);
      return s + (d.tipo_pago === 'total' ? neto : (d.importe_abonado || 0));
    }, 0);
    const totalPago    = efectivo + transf + cheque;
    const totalDocs    = documentosSeleccionados.reduce((s, d) => s + Math.max(d.importe - d.nota_credito_importe, 0), 0);
    const diferencia   = Math.abs(totalPago - totalAbonado);

    if (diferencia >= 0.01) {
      const ok = await Swal.fire({
        icon: 'warning',
        title: 'Diferencia en los montos',
        html: `Total a abonar por documentos: <strong>$ ${fmtMonto(totalAbonado)}</strong><br>
               Medios de pago ingresados: <strong>$ ${fmtMonto(totalPago)}</strong><br>
               ¿Deseás continuar de todas formas?`,
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Revisar',
      });
      if (!ok.isConfirmed) return;
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
      items: documentosSeleccionados.map(d => {
        const neto       = Math.max(d.importe - (d.nota_credito_importe || 0), 0);
        const abonado    = d.tipo_pago === 'total' ? neto : (d.importe_abonado || 0);
        const saldoResta = parseFloat((neto - abonado).toFixed(2));
        return {
          tipo_documento:       d.tipo,
          documento_id:         d.id,
          numero_documento:     d.numero_documento,
          fecha_documento:      d.fecha_documento,
          importe:              d.importe,
          importe_original:     d.importe_original,
          nota_credito_id:      d.nota_credito_id   || null,
          nota_credito_importe: d.nota_credito_importe || 0,
          tipo_pago:            d.tipo_pago,
          importe_abonado:      abonado,
          saldo_pendiente:      saldoResta,
        };
      }),
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

      const result = await Swal.fire({
        icon: 'success',
        title: `Carta ${data.numero} guardada`,
        html: `Registrada correctamente.<br><small class="text-muted">ID: #${data.insertId}</small>`,
        showDenyButton:   true,
        confirmButtonText: '<i class="fa-solid fa-file-pdf"></i> Descargar PDF',
        denyButtonText:    'Cerrar',
        denyButtonColor:   '#6b7a99',
      });
      if (result.isConfirmed) {
        window.open(`/administracion/api/cartas-pago/${data.insertId}/pdf`, '_blank');
      }
    } catch (err) {
      console.error('❌ Error al guardar carta:', err);
      Swal.fire('Error', err.message || 'No se pudo guardar la carta de pago.', 'error');
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Carta';
    }
  });

  // ── Historial ──────────────────────────────────────────────────────────────
  btnVerHistorial.addEventListener('click', async () => {
    modalHistorial.show();
    await cargarHistorial();
  });

  async function cargarHistorial() {
    const tbody = document.getElementById('tablaHistorialCartas').querySelector('tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

    const filtroP = document.getElementById('historialFiltroProveedor')?.value || '';
    const filtroE = document.getElementById('historialFiltroEstado')?.value    || '';
    let url = '/administracion/api/cartas-pago?';
    if (filtroP) url += `proveedor_id=${filtroP}&`;
    if (filtroE) url += `estado=${filtroE}&`;

    try {
      const res   = await fetch(url);
      const lista = await res.json();
      tbody.innerHTML = '';

      if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Sin resultados.</td></tr>';
        return;
      }

      lista.forEach(carta => {
        const badgeClass = { emitida: 'bg-success', borrador: 'bg-warning text-dark', anulada: 'bg-danger' }[carta.estado] || 'bg-secondary';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="fw-semibold">${carta.numero}</td>
          <td>${fmtFecha(carta.fecha)}</td>
          <td>${carta.nombre_proveedor}</td>
          <td>$ ${fmtMonto(carta.total_documentos)}</td>
          <td>$ ${fmtMonto(carta.total_pagado)}</td>
          <td><span class="badge ${badgeClass}">${carta.estado}</span></td>
          <td class="text-center">
            <a href="/administracion/api/cartas-pago/${carta.id}/pdf" target="_blank"
               class="btn btn-sm btn-primary me-1"><i class="fa-solid fa-file-pdf"></i></a>
            ${carta.estado !== 'anulada' ? `
            <button class="btn btn-sm btn-danger btn-anular" data-id="${carta.id}" data-num="${carta.numero}">
              <i class="fa-solid fa-ban"></i>
            </button>` : ''}
          </td>
        `;
        tr.querySelector('.btn-anular')?.addEventListener('click', () => anularCarta(carta.id, carta.numero));
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar.</td></tr>';
    }
  }

  document.getElementById('btnBuscarHistorialCartas')?.addEventListener('click', cargarHistorial);

  async function anularCarta(id, numero) {
    const ok = await Swal.fire({
      icon: 'warning', title: `Anular ${numero}`,
      text: 'Esta acción no se puede deshacer.',
      showCancelButton: true, confirmButtonText: 'Sí, anular',
      confirmButtonColor: '#dc3545', cancelButtonText: 'Cancelar',
    });
    if (!ok.isConfirmed) return;
    try {
      const r = await fetch(`/administracion/api/cartas-pago/${id}/anular`, { method: 'PUT' });
      const d = await r.json();
      if (!d.ok) throw new Error();
      Swal.fire('Anulada', `La carta ${numero} fue anulada.`, 'success');
      cargarHistorial();
    } catch {
      Swal.fire('Error', 'No se pudo anular.', 'error');
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

  function fmtMontoPlain(n) {
    return (parseFloat(n) || 0).toFixed(2);
  }

  function esVencido(fechaVal) {
    if (!fechaVal) return false;
    return new Date(fechaVal) < new Date();
  }
});