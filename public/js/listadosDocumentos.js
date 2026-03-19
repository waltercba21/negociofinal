document.addEventListener('DOMContentLoaded', () => {
  const btnBuscar = document.getElementById('btnBuscarListados');
  const modal = new bootstrap.Modal(document.getElementById('modalResultadosListados'));
  const contenedorResultados = document.getElementById('contenedorResultadosListados');
  const btnAnterior = document.getElementById('btnAnteriorPagina');
  const btnSiguiente = document.getElementById('btnSiguientePagina');
  const indicadorPagina = document.getElementById('indicadorPagina');

  let datosFiltrados = [];
  let paginaActual = 1;
  const tarjetasPorPagina = 6;

  // ---------------- HELPERS ----------------
  const adminPrefix = window.location.pathname.startsWith('/administracion') ? '/administracion' : '';

  function isHTMLResponse(res) {
    return res.headers.get("content-type")?.includes("text/html");
  }

  function formatearFechaInput(fecha) {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }

  function fmtMoneyARS(value) {
    const n = parseFloat(value || 0) || 0;
    return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function obtenerProveedores() {
    const res = await fetch(`${adminPrefix}/api/proveedores`);
    return await res.json();
  }

  // ---------------- BUSCAR LISTADOS ----------------
  btnBuscar.addEventListener('click', async () => {
    const proveedor = document.getElementById('filtroProveedor').value;
    const tipo = document.getElementById('filtroTipo').value;
    const fechaDesde = document.getElementById('filtroFechaDesde').value;
    const fechaHasta = document.getElementById('filtroFechaHasta').value;
    const condicion = document.getElementById('filtroCondicion').value;
    const numero = document.getElementById('filtroNumero').value;

    // ✅ validación existente (la mantengo)
    if (numero && !tipo) {
      Swal.fire('Atención', 'Si vas a buscar por número, debés seleccionar el tipo de documento.', 'warning');
      return;
    }

    try {
      // ✅ NOTAS DE CREDITO: usa endpoint propio
      if (tipo === 'nota_credito') {
        // tu API espera: proveedor, desde, hasta, tipo, iva, numeroNC, numeroFactura
        // en UI solo tenemos "numero" -> lo uso como numeroNC
        const queryNC = new URLSearchParams({
          proveedor,
          desde: fechaDesde || '',
          hasta: fechaHasta || '',
          tipo: '',          // si luego agregás filtro de tipo nc en UI, lo conectamos
          iva: '',           // idem
          numeroNC: numero || '',
          numeroFactura: ''  // si luego agregás input, lo conectamos
        });

        const resNC = await fetch(`${adminPrefix}/api/notas-credito?${queryNC.toString()}`);
        if (!resNC.ok || isHTMLResponse(resNC)) throw new Error("Respuesta inválida del servidor");

        const notas = await resNC.json();

        // Normalizo al mismo formato que facturas/presupuestos para no romper render
        datosFiltrados = (notas || []).map(nc => ({
          id: nc.id,
          tipo: 'nota_credito',
          nombre_proveedor: nc.nombre_proveedor || '',
          numero: nc.numero_nota_credito || '',
          fecha: nc.fecha || null,

          // extras para mostrar luego si querés
          numero_factura: nc.numero_factura,
          tipo_nc: nc.tipo,
          iva: nc.iva,
          importe_total: nc.importe_total
        }));

        paginaActual = 1;
        renderizarPagina(paginaActual);
        modal.show();
        return;
      }

      // ✅ FACTURAS / PRESUPUESTOS (endpoint combinado)
      const query = new URLSearchParams({
        proveedor,
        tipo,
        fechaDesde,
        fechaHasta,
        condicion,
        numero
      });

      const res = await fetch(`${adminPrefix}/api/documentos?${query.toString()}`);
      if (!res.ok || isHTMLResponse(res)) {
        throw new Error("Respuesta inválida del servidor");
      }

      const datos = await res.json();
      datosFiltrados = datos;
      paginaActual = 1;
      renderizarPagina(paginaActual);
      modal.show();
    } catch (err) {
      console.error('❌ Error al buscar documentos:', err);
      Swal.fire('Error', 'Ocurrió un error al buscar los documentos.', 'error');
    }
  });

  // ---------------- PAGINACION ----------------
  function renderizarPagina(pagina) {
    contenedorResultados.innerHTML = '';
    const inicio = (pagina - 1) * tarjetasPorPagina;
    const fin = inicio + tarjetasPorPagina;
    const datosPagina = datosFiltrados.slice(inicio, fin);

    if (!datosPagina.length) {
      contenedorResultados.innerHTML = '<p class="text-muted">No hay resultados para esta página.</p>';
      return;
    }

    datosPagina.forEach(doc => {
      const tarjeta = document.createElement('div');
      tarjeta.className = 'col-md-4 mb-3';

      const extraNC = doc.tipo === 'nota_credito'
        ? `
          <hr class="my-2" />
          <p class="mb-1"><strong>Factura:</strong> ${doc.numero_factura || '-'}</p>
          <p class="mb-1"><strong>Tipo NC:</strong> ${doc.tipo_nc || '-'}</p>
          <p class="mb-1"><strong>IVA:</strong> ${doc.iva || '-'}%</p>
          <p class="mb-1"><strong>Total:</strong> $${fmtMoneyARS(doc.importe_total)}</p>
        `
        : '';

      tarjeta.innerHTML = `
        <div class="card resultado-doc shadow-sm">
          <div class="card-body">
            <h6>${String(doc.tipo || '').toUpperCase()}</h6>
            <p><strong>Proveedor:</strong> ${doc.nombre_proveedor || ''}</p>
            <p><strong>Número:</strong> ${doc.numero || ''}</p>
            <p><strong>Fecha:</strong> ${doc.fecha ? new Date(doc.fecha).toLocaleDateString('es-AR') : '-'}</p>
            ${extraNC}
            <button class="btn btn-outline-primary btn-sm ver-mas-documento" data-id="${doc.id}" data-tipo="${doc.tipo}">
              Ver más
            </button>
          </div>
        </div>
      `;
      contenedorResultados.appendChild(tarjeta);
    });

    const totalPaginas = Math.ceil(datosFiltrados.length / tarjetasPorPagina);
    indicadorPagina.textContent = `Página ${pagina} de ${totalPaginas}`;
    btnAnterior.disabled = pagina <= 1;
    btnSiguiente.disabled = pagina >= totalPaginas;
  }

  btnAnterior.addEventListener('click', () => {
    if (paginaActual > 1) {
      paginaActual--;
      renderizarPagina(paginaActual);
    }
  });

  btnSiguiente.addEventListener('click', () => {
    const totalPaginas = Math.ceil(datosFiltrados.length / tarjetasPorPagina);
    if (paginaActual < totalPaginas) {
      paginaActual++;
      renderizarPagina(paginaActual);
    }
  });

  // ---------------- VER VENCIMIENTOS (se deja tal cual, NO incluye NC) ----------------
  document.getElementById('btnVerVencimientos').addEventListener('click', async () => {
    const { modalEl, contenedor, btnPrint } = ensureVencimientosModal();

    try {
      const res = await fetch(`${adminPrefix}/api/documentos?condicion=pendiente`);
      if (!res.ok) throw new Error('Respuesta inválida del servidor');
      const documentos = await res.json();
      const hoy = new Date();

      const vencidos = [], proximos = [], aTiempo = [];
      documentos.forEach(doc => {
        const vto = new Date(doc.fecha_pago);
        const dias = Math.ceil((vto - hoy) / (1000 * 60 * 60 * 24));
        const item = { ...doc, dias, fechaFormateada: vto.toLocaleDateString('es-AR'), vto };
        if (dias < 0) vencidos.push(item);
        else if (dias <= 7) proximos.push(item);
        else aTiempo.push(item);
      });

      const byVto = (a, b) => a.vto - b.vto;
      vencidos.sort(byVto); proximos.sort(byVto); aTiempo.sort(byVto);

      contenedor.innerHTML = '';
      const renderGrupo = (titulo, grupo, colorClase) => {
        if (!grupo.length) return;
        const total = grupo.reduce((acc, d) => acc + parseFloat(d.importe || 0), 0);
        contenedor.insertAdjacentHTML('beforeend', `
          <h6 class="fw-bold mt-4 mb-2 text-${colorClase}">${titulo}</h6>
          <table class="table table-sm table-bordered align-middle">
            <thead class="table-${colorClase}">
              <tr>
                <th>Tipo</th><th>Proveedor</th><th>Número</th>
                <th>Vencimiento</th><th>Días</th><th>Importe</th>
              </tr>
            </thead>
            <tbody>
              ${grupo.map(d => `
                <tr>
                  <td class="text-uppercase">${d.tipo}</td>
                  <td>${d.nombre_proveedor}</td>
                  <td>${d.numero}</td>
                  <td>${d.fechaFormateada}</td>
                  <td>${d.dias < 0 ? `Vencido hace ${Math.abs(d.dias)} días` : `Faltan ${d.dias} días`}</td>
                  <td>$${parseFloat(d.importe || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          <p class="fw-bold text-end text-${colorClase}">Total: $${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
        `);
      };

      renderGrupo('🔴 Documentos vencidos', vencidos, 'danger');
      renderGrupo('🟠 Prontos a vencer (≤ 7 días)', proximos, 'warning');
      renderGrupo('🟢 Documentos dentro del plazo', aTiempo, 'success');

      if (btnPrint && !btnPrint.dataset.bound) {
        btnPrint.addEventListener('click', () => window.open(`${adminPrefix}/pdf/deuda-pendiente`, '_blank'));
        btnPrint.dataset.bound = '1';
      }

      new bootstrap.Modal(modalEl).show();
    } catch (err) {
      console.error('❌ Error al cargar vencimientos:', err);
      Swal.fire('Error', 'No se pudieron obtener los vencimientos', 'error');
    }
  });

  // ---------------- VER MAS / DETALLE (UN SOLO LISTENER, incluyendo NC) ----------------
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.ver-mas-documento');
    if (!btn) return;

    const id = btn.dataset.id;
    const tipo = btn.dataset.tipo;

    try {
      const url = (tipo === 'nota_credito')
        ? `${adminPrefix}/api/notas-credito/${id}`
        : `${adminPrefix}/api/${tipo}/${id}`;

      const res = await fetch(url);
      if (!res.ok || isHTMLResponse(res)) throw new Error('Respuesta inválida del servidor');

      const data = await res.json();
      renderDetalleDocumento(data, tipo);
    } catch (error) {
      console.error('❌ Error al obtener el detalle:', error);
      Swal.fire('Error', 'No se pudo cargar el detalle del documento', 'error');
    }
  });

  // ---------------- DETALLE DOCUMENTO (incluye NC) ----------------
  function renderDetalleDocumento(data, tipo) {
    const contenedor = document.getElementById('contenedorDetalleDocumento');
    const modalDetalle = new bootstrap.Modal(document.getElementById('modalDetalleDocumento'));

    // Link imprimir (si tu backend lo soporta)
    const btnPrint = document.getElementById('btnImprimirDetallePDF');
    if (btnPrint) btnPrint.href = `${adminPrefix}/pdf/${tipo}/${data.id}`;

    const isFactura = tipo === 'factura';
    const isNC = tipo === 'nota_credito';

    // NC: no tiene fecha_pago/condicion/administrador en tu tabla actual
    if (isNC) {
      contenedor.innerHTML = `
        <form id="formDetalleDocumento">
          <input type="hidden" name="id" value="${data.id}">
          <div class="row">
            <div class="col-md-6 mb-2">
              <label>Proveedor</label>
              <select name="id_proveedor" class="form-select" disabled id="selectProveedorDetalleDocumento"></select>
            </div>
            <div class="col-md-6 mb-2">
              <label>Fecha</label>
              <input type="date" name="fecha" class="form-control" value="${formatearFechaInput(data.fecha)}" disabled>
            </div>
          </div>

          <div class="row">
            <div class="col-md-6 mb-2">
              <label>Número Nota de Crédito</label>
              <input type="text" name="numero_nota_credito" class="form-control" value="${data.numero_nota_credito || ''}" disabled>
            </div>
            <div class="col-md-6 mb-2">
              <label>Corresponde a Factura Nº</label>
              <input type="text" name="numero_factura" class="form-control" value="${data.numero_factura || ''}" disabled>
            </div>
          </div>

          <div class="row">
            <div class="col-md-6 mb-2">
              <label>Tipo</label>
              <select name="tipo" class="form-select" disabled>
                <option value="descuento" ${data.tipo === 'descuento' ? 'selected' : ''}>Descuento</option>
                <option value="devolucion_mercaderia" ${data.tipo === 'devolucion_mercaderia' ? 'selected' : ''}>Devolución mercadería</option>
                <option value="diferencia_precio" ${data.tipo === 'diferencia_precio' ? 'selected' : ''}>Diferencia de precio</option>
              </select>
            </div>
            <div class="col-md-3 mb-2">
              <label>IVA</label>
              <select name="iva" class="form-select" disabled>
                <option value="21" ${data.iva === '21' ? 'selected' : ''}>21%</option>
                <option value="10.5" ${data.iva === '10.5' ? 'selected' : ''}>10.5%</option>
              </select>
            </div>
            <div class="col-md-3 mb-2">
              <label>Importe Total</label>
              <input type="number" name="importe_total" class="form-control" step="0.01" value="${data.importe_total || 0}" disabled>
            </div>
          </div>
        </form>
      `;

      // cargar proveedores
      const selectProv = document.getElementById('selectProveedorDetalleDocumento');
      obtenerProveedores().then(proveedores => {
        selectProv.innerHTML = '';
        proveedores.forEach(p => {
          const option = document.createElement('option');
          option.value = p.id;
          option.textContent = p.nombre;
          if (String(p.id) === String(data.id_proveedor)) option.selected = true;
          selectProv.appendChild(option);
        });
      });

      // dataset para guardar/eliminar
      const btnGuardar = document.getElementById('btnGuardarCambiosDocumento');
      btnGuardar.dataset.tipo = 'nota_credito';
      btnGuardar.dataset.id = data.id;

      modalDetalle.show();
      return;
    }

    // FACTURA / PRESUPUESTO (tu versión original)
    contenedor.innerHTML = `
      <form id="formDetalleDocumento">
        <input type="hidden" name="id" value="${data.id}">

        <div class="row">
          <div class="col-md-6 mb-2">
            <label>Proveedor</label>
            <select name="id_proveedor" class="form-select" disabled id="selectProveedorDetalleDocumento"></select>
          </div>

          <div class="col-md-6 mb-2">
            <label>Administrador</label>
            <input type="text" class="form-control" name="administrador" value="${data.administrador || ''}" disabled>
          </div>
        </div>

        <div class="row">
          <div class="col-md-4 mb-2">
            <label>Fecha</label>
            <input type="date" name="fecha" class="form-control" value="${formatearFechaInput(data.fecha)}" disabled>
          </div>
          <div class="col-md-4 mb-2">
            <label>Fecha de Pago</label>
            <input type="date" name="fecha_pago" class="form-control" value="${formatearFechaInput(data.fecha_pago)}" disabled>
          </div>
          <div class="col-md-4 mb-2">
            <label>${isFactura ? 'Número de Factura' : 'Número de Presupuesto'}</label>
            <input type="text" name="numero" class="form-control"
              value="${isFactura ? (data.numero_factura || '') : (data.numero_presupuesto || '')}" readonly>
          </div>
        </div>

        ${isFactura ? `
          <div class="row">
            <div class="col-md-4 mb-2">
              <label>Importe Bruto</label>
              <input type="number" name="importe_bruto" class="form-control" step="0.01" value="${data.importe_bruto || 0}" disabled>
            </div>
            <div class="col-md-4 mb-2">
              <label>IVA</label>
              <select name="iva" class="form-select" disabled>
                <option value="21" ${data.iva === '21' ? 'selected' : ''}>21%</option>
                <option value="10.5" ${data.iva === '10.5' ? 'selected' : ''}>10.5%</option>
              </select>
            </div>
            <div class="col-md-4 mb-2">
              <label>Importe Total</label>
              <input type="number" name="importe_factura" class="form-control" step="0.01" value="${data.importe_factura || 0}" disabled>
            </div>
          </div>
        ` : `
          <div class="mb-2">
            <label>Importe Total</label>
            <input type="number" name="importe" class="form-control" step="0.01" value="${data.importe || 0}" disabled>
          </div>
        `}

        <div class="mb-2">
          <label>Condición</label>
          <select name="condicion" class="form-select" disabled>
            <option value="pendiente" ${data.condicion === 'pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="pagado" ${data.condicion === 'pagado' ? 'selected' : ''}>Pagado</option>
          </select>
        </div>

        <hr class="my-3" />

        <h6>Productos Asociados</h6>
        ${data.productos && data.productos.length ? `
          <ul class="list-group mb-3">
            ${data.productos.map(p => `<li class="list-group-item">${p.nombre} - Cantidad: ${p.cantidad}</li>`).join('')}
          </ul>
        ` : `<p class="text-muted">Sin productos asociados.</p>`}
      </form>
    `;

    // cargar proveedores
    const selectProv = document.getElementById('selectProveedorDetalleDocumento');
    obtenerProveedores().then(proveedores => {
      selectProv.innerHTML = '';
      proveedores.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.nombre;
        if (String(p.id) === String(data.id_proveedor)) option.selected = true;
        selectProv.appendChild(option);
      });
    });

    const btnGuardar = document.getElementById('btnGuardarCambiosDocumento');
    btnGuardar.dataset.tipo = tipo;
    btnGuardar.dataset.id = data.id;

    modalDetalle.show();
  }

  // ---------------- HABILITAR EDICION (mantengo tu lógica) ----------------
  document.getElementById('btnHabilitarEdicion').addEventListener('click', () => {
    const form = document.querySelector('#formDetalleDocumento');
    if (!form) return;

    form.querySelectorAll('input, select').forEach(el => {
      el.disabled = false;
      if (el.hasAttribute('readonly')) el.removeAttribute('readonly');
    });

    document.getElementById('btnGuardarCambiosDocumento').classList.remove('d-none');
  });

  // ---------------- GUARDAR CAMBIOS (AGREGO NC) ----------------
  document.getElementById('btnGuardarCambiosDocumento').addEventListener('click', async () => {
    const form = document.querySelector('#formDetalleDocumento');
    if (!form) return;

    const tipo = document.getElementById('btnGuardarCambiosDocumento').dataset.tipo;
    const id = document.getElementById('btnGuardarCambiosDocumento').dataset.id;

    let url = `${adminPrefix}/api/${tipo}/${id}`;
    let datos = {};

    if (tipo === 'nota_credito') {
      // payload NC según tu controller actualizarNotaCredito
      datos = {
        id_proveedor: form.id_proveedor.value,
        fecha: form.fecha.value,
        numero_nota_credito: form.numero_nota_credito.value,
        numero_factura: form.numero_factura.value,
        tipo: form.tipo.value,
        iva: form.iva.value,
        importe_total: form.importe_total.value
      };
      url = `${adminPrefix}/api/notas-credito/${id}`;
    } else {
      // tu payload original
      datos = {
        fecha: form.fecha.value,
        fecha_pago: form.fecha_pago.value,
        condicion: form.condicion.value,
        administrador: form.administrador.value,
        id_proveedor: form.id_proveedor.value
      };

      if (tipo === 'factura') {
        datos.numero_factura = form.numero.value;
        datos.importe_bruto = form.importe_bruto.value;
        datos.iva = form.iva.value;
        datos.importe_factura = form.importe_factura.value;
      } else {
        datos.numero_presupuesto = form.numero.value;
        datos.importe = form.importe.value;
      }
    }

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });

      if (!res.ok) throw new Error();

      Swal.fire('Éxito', 'Documento actualizado correctamente', 'success');
      document.getElementById('btnGuardarCambiosDocumento').classList.add('d-none');
      form.querySelectorAll('input, select').forEach(el => el.disabled = true);
    } catch (err) {
      Swal.fire('Error', 'No se pudo guardar los cambios', 'error');
    }
  });

  // ---------------- RESUMENES PDF (mantengo tal cual) ----------------
  document.getElementById('btnGenerarPDFResumenFacturas').addEventListener('click', () => {
    const desde = document.getElementById('filtroFechaDesde').value;
    const hasta = document.getElementById('filtroFechaHasta').value;
    const proveedor = document.getElementById('filtroProveedor').value;
    const condicion = document.getElementById('filtroCondicion').value;

    if (!desde || !hasta) {
      Swal.fire('Faltan fechas', 'Debés seleccionar un rango de fechas.', 'warning');
      return;
    }

    const url = `${adminPrefix}/pdf/resumen/facturas?desde=${desde}&hasta=${hasta}&proveedor=${proveedor}&condicion=${condicion}`;
    window.open(url, '_blank');
  });

  document.getElementById('btnGenerarPDFResumenPresupuestos').addEventListener('click', () => {
    const desde = document.getElementById('filtroFechaDesde').value;
    const hasta = document.getElementById('filtroFechaHasta').value;
    const proveedor = document.getElementById('filtroProveedor').value;
    const condicion = document.getElementById('filtroCondicion').value;

    if (!desde || !hasta) {
      Swal.fire('Faltan fechas', 'Debés seleccionar un rango de fechas.', 'warning');
      return;
    }

    const url = `${adminPrefix}/pdf/resumen/presupuestos?desde=${desde}&hasta=${hasta}&proveedor=${proveedor}&condicion=${condicion}`;
    window.open(url, '_blank');
  });

  // ---------------- ELIMINAR DOCUMENTO (AGREGO NC) ----------------
  document.getElementById('btnEliminarDocumento').addEventListener('click', async () => {
    const tipo = document.getElementById('btnGuardarCambiosDocumento').dataset.tipo;
    const id = document.getElementById('btnGuardarCambiosDocumento').dataset.id;

    const confirmacion = await Swal.fire({
      title: '¿Eliminar documento?',
      text: `Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      const url = (tipo === 'nota_credito')
        ? `${adminPrefix}/api/notas-credito/${id}`
        : `${adminPrefix}/api/${tipo}/${id}`;

      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error();

      Swal.fire('Eliminado', 'Documento eliminado correctamente.', 'success');

      // Cerrar modal de forma segura
      const modalEl = document.getElementById('modalDetalleDocumento');
      const instance = bootstrap.Modal.getInstance(modalEl);
      if (instance) instance.hide();

      // refrescar resultados del listado (opcional)
    } catch (err) {
      Swal.fire('Error', 'No se pudo eliminar el documento.', 'error');
    }
  });

  // ---------------- MODAL VENCIMIENTOS (tu función original) ----------------
  function ensureVencimientosModal() {
    let modal = document.getElementById('modalVencimientos');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal fade af-modal';
      modal.id = 'modalVencimientos';
      modal.tabIndex = -1;
      modal.innerHTML = `
        <div class="modal-dialog modal-xl modal-proveedor-dialog">
          <div class="modal-content modal-proveedor-content">
            <div class="modal-header modal-proveedor-header">
              <h5 class="modal-title"><i class="bi bi-calendar-event me-2"></i>Vencimientos de documentos</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <div id="contenedorVencimientos"></div>
            </div>
            <div class="modal-footer">
              <button type="button" id="btnImprimirDeuda" class="btn btn-outline-secondary">
                <i class="bi bi-printer me-1"></i> Imprimir Deuda Pendiente
              </button>
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    return {
      modalEl: modal,
      contenedor: modal.querySelector('#contenedorVencimientos'),
      btnPrint: modal.querySelector('#btnImprimirDeuda')
    };
  }
 // ── Resumen de compras ──────────────────────────────────────────────────────
const btnVerResumen   = document.getElementById('btnVerResumenCompras');
const btnPDFCompras   = document.getElementById('btnPDFResumenCompras');
const contenedorComp  = document.getElementById('contenedorResumenCompras');

function money(n) {
  return (+n||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

btnVerResumen?.addEventListener('click', async () => {
  const desde    = document.getElementById('filtroFechaDesde').value;
  const hasta    = document.getElementById('filtroFechaHasta').value;
  const proveedor = document.getElementById('filtroProveedor').value;
  const condicion = document.getElementById('filtroCondicion').value;
  if (!desde || !hasta) { Swal.fire('Faltan fechas','Seleccioná Desde y Hasta.','warning'); return; }

  const qs = new URLSearchParams({desde,hasta});
  if (proveedor) qs.set('proveedor', proveedor);
  if (condicion) qs.set('condicion', condicion);

  try {
    const r = await fetch(`${adminPrefix}/api/resumen-compras?${qs}`);
    if (!r.ok) throw new Error();
    const { dias, totales } = await r.json();

    if (!dias?.length) { contenedorComp.innerHTML='<p class="text-muted">Sin compras en el período.</p>'; return; }

    const filas = dias.map(d=>`
      <div style="display:grid;grid-template-columns:110px 60px 1fr 1fr 1fr;gap:8px;padding:7px 10px;border-bottom:1px solid rgba(240,244,255,0.07);font-size:13px">
        <div>${d.fecha}</div>
        <div style="text-align:center">${d.cant}</div>
        <div style="text-align:right">$ ${money(d.neto)}</div>
        <div style="text-align:right;color:#f59e0b"><b>$ ${money(d.iva)}</b></div>
        <div style="text-align:right"><b>$ ${money(d.total)}</b></div>
      </div>`).join('');

    contenedorComp.innerHTML = `
      <div style="border:1px solid rgba(31,72,126,0.25);border-radius:10px;overflow:hidden;font-family:'DM Sans',sans-serif">
        <div style="display:grid;grid-template-columns:110px 60px 1fr 1fr 1fr;gap:8px;padding:8px 10px;background:rgba(31,72,126,0.15);font-size:12px;font-weight:700;color:rgba(240,244,255,0.6);text-transform:uppercase;letter-spacing:.5px">
          <div>Fecha</div><div style="text-align:center">Fact.</div>
          <div style="text-align:right">Neto</div>
          <div style="text-align:right;color:#f59e0b">IVA</div>
          <div style="text-align:right">Total</div>
        </div>
        ${filas}
        <div style="display:grid;grid-template-columns:110px 60px 1fr 1fr 1fr;gap:8px;padding:9px 10px;background:rgba(31,72,126,0.2);font-size:13px;font-weight:700;border-top:2px solid rgba(240,244,255,0.15)">
          <div>TOTAL</div><div style="text-align:center">${totales.cant}</div>
          <div style="text-align:right">$ ${money(totales.neto)}</div>
          <div style="text-align:right;color:#f59e0b">$ ${money(totales.iva)}</div>
          <div style="text-align:right">$ ${money(totales.total)}</div>
        </div>
      </div>
      <div style="margin-top:10px;padding:10px 14px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:13px;color:#f59e0b">
        <strong>IVA total en compras del período: $ ${money(totales.iva)}</strong>
        &nbsp;·&nbsp; Neto: $ ${money(totales.neto)}
        &nbsp;·&nbsp; Total con IVA: $ ${money(totales.total)}
      </div>`;
  } catch { Swal.fire('Error','No se pudo obtener el resumen.','error'); }
});

btnPDFCompras?.addEventListener('click', () => {
  const desde    = document.getElementById('filtroFechaDesde').value;
  const hasta    = document.getElementById('filtroFechaHasta').value;
  const proveedor = document.getElementById('filtroProveedor').value;
  const condicion = document.getElementById('filtroCondicion').value;
  if (!desde || !hasta) { Swal.fire('Faltan fechas','Seleccioná Desde y Hasta.','warning'); return; }
  const qs = new URLSearchParams({desde,hasta});
  if (proveedor) qs.set('proveedor', proveedor);
  if (condicion) qs.set('condicion', condicion);
  window.open(`${adminPrefix}/pdf/resumen/compras-periodo?${qs}`, '_blank');
});
 });
