document.addEventListener('DOMContentLoaded', () => {
  const btnBuscar = document.getElementById('btnBuscarListados');
  const modal = new bootstrap.Modal(document.getElementById('modalResultadosListados'));
  const contenedorResultados = document.getElementById('contenedorResultadosListados');
  const btnAnterior = document.getElementById('btnAnteriorPagina');
  const btnSiguiente = document.getElementById('btnSiguientePagina');
  const indicadorPagina = document.getElementById('indicadorPagina');
  const btnGuardarCambios = document.getElementById('btnGuardarCambiosDocumento');
  


  let datosFiltrados = [];
  let paginaActual = 1;
  const tarjetasPorPagina = 6;

  btnBuscar.addEventListener('click', async () => {
    const proveedor = document.getElementById('filtroProveedor').value;
    const tipo = document.getElementById('filtroTipo').value;
    const fechaDesde = document.getElementById('filtroFechaDesde').value;
    const fechaHasta = document.getElementById('filtroFechaHasta').value;
    const condicion = document.getElementById('filtroCondicion').value;
    const numero = document.getElementById('filtroNumero').value;

    try {
      const query = new URLSearchParams({
        proveedor,
        tipo,
        fechaDesde,
        fechaHasta,
        condicion,
        numero
      });

      const res = await fetch(`/administracion/api/documentos?${query.toString()}`);
      if (!res.ok || res.headers.get("content-type")?.includes("text/html")) {
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

      tarjeta.innerHTML = `
  <div class="card resultado-doc shadow-sm">
    <div class="card-body">
      <h6>${doc.tipo.toUpperCase()}</h6>
      <p><strong>Proveedor:</strong> ${doc.nombre_proveedor}</p>
      <p><strong>Número:</strong> ${doc.numero}</p>
      <p><strong>Fecha:</strong> ${new Date(doc.fecha).toLocaleDateString()}</p>
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

  // Futuro: acción del botón Ver más
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('ver-mas-documento')) {
      const id = e.target.dataset.id;
      const tipo = e.target.dataset.tipo;
      console.log(`🔍 Ver más ${tipo} con ID ${id}`);
      // Se puede abrir otro modal con los detalles en el siguiente paso
    }
  });

document.getElementById('btnVerVencimientos').addEventListener('click', async () => {
  try {
    const res = await fetch('/administracion/api/documentos?condicion=pendiente');
    const documentos = await res.json();
    const hoy = new Date();

    // Clasificamos y ordenamos
    const vencidos = [];
    const proximos = [];
    const aTiempo = [];

    documentos.forEach(doc => {
      const vencimiento = new Date(doc.fecha_pago);
      const dias = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
      const item = {
        ...doc,
        dias,
        fechaFormateada: vencimiento.toLocaleDateString('es-AR'),
        vencimiento
      };

      if (dias < 0) {
        vencidos.push(item);
      } else if (dias <= 7) {
        proximos.push(item);
      } else {
        aTiempo.push(item);
      }
    });

    // Ordenar internamente por fecha de vencimiento
    vencidos.sort((a, b) => a.vencimiento - b.vencimiento);
    proximos.sort((a, b) => a.vencimiento - b.vencimiento);
    aTiempo.sort((a, b) => a.vencimiento - b.vencimiento);

    const contenedor = document.getElementById('contenedorVencimientos');
    contenedor.innerHTML = '';
    
function renderGrupo(titulo, grupo, colorClase) {
  if (grupo.length === 0) return;

  // Calcular total
  // Calcular total
  let totalGrupo = 0;
  grupo.forEach(doc => {
    totalGrupo += parseFloat(doc.importe || 0);
  });

  contenedor.innerHTML += `<h6 class="fw-bold mt-4 mb-2 text-${colorClase}">${titulo}</h6>`;
  contenedor.innerHTML += `
    <table class="table table-sm table-bordered align-middle">
      <thead class="table-${colorClase}">
        <tr>
          <th>Tipo</th>
          <th>Proveedor</th>
          <th>Número</th>
          <th>Vencimiento</th>
          <th>Días</th>
          <th>Importe</th>
        </tr>
      </thead>
      <tbody>
        ${grupo.map(doc => {
          const importe = parseFloat(doc.importe || 0);



          return `
            <tr>
              <td class="text-uppercase">${doc.tipo}</td>
              <td>${doc.nombre_proveedor}</td>
              <td>${doc.numero}</td>
              <td>${doc.fechaFormateada}</td>
              <td>${doc.dias < 0 ? `Vencido hace ${Math.abs(doc.dias)} días` : `Faltan ${doc.dias} días`}</td>
              <td>$${importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    <p class="fw-bold text-end text-${colorClase}">Total: $${totalGrupo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
  `;

}  
document.getElementById('btnImprimirDeuda').addEventListener('click', () => {
  window.open('/administracion/pdf/deuda-pendiente', '_blank');
});


    renderGrupo('🔴 Documentos vencidos', vencidos, 'danger');
    renderGrupo('🟠 Prontos a vencer (≤ 7 días)', proximos, 'warning');
    renderGrupo('🟢 Documentos aún dentro del plazo', aTiempo, 'success');

    new bootstrap.Modal(document.getElementById('modalVencimientos')).show();

  } catch (err) {
    console.error('❌ Error al cargar vencimientos:', err);
    Swal.fire('Error', 'No se pudieron obtener los vencimientos', 'error');
  }
});


});
document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('ver-mas-documento')) {
    const id = e.target.dataset.id;
    const tipo = e.target.dataset.tipo;

    try {
      const res = await fetch(`/administracion/api/${tipo}/${id}`);
      const data = await res.json();
      renderDetalleDocumento(data, tipo);
    } catch (error) {
      console.error('❌ Error al obtener el detalle:', error);
      Swal.fire('Error', 'No se pudo cargar el detalle del documento', 'error');
    }
  }
});
async function obtenerProveedores() {
  const res = await fetch('/administracion/api/proveedores');
  return await res.json();
}

function renderDetalleDocumento(data, tipo) {
  const contenedor = document.getElementById('contenedorDetalleDocumento');
  const modal = new bootstrap.Modal(document.getElementById('modalDetalleDocumento'));
  const formatearFechaInput = fecha => {
  const d = new Date(fecha);
  return d.toISOString().split('T')[0];
};
  document.getElementById('btnImprimirDetallePDF').href = `/administracion/pdf/${tipo}/${data.id}`;
  const isFactura = tipo === 'factura';

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
          <input type="text" name="numero" class="form-control" value="${isFactura ? data.numero_factura : data.numero_presupuesto}" readonly>

        </div>
      </div>

      ${isFactura ? `
        <div class="row">
          <div class="col-md-4 mb-2">
            <label>Importe Bruto</label>
            <input type="number" name="importe_bruto" class="form-control" step="0.01" value="${data.importe_bruto}" disabled>
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
            <input type="number" name="importe_factura" class="form-control" step="0.01" value="${data.importe_factura}" disabled>
          </div>
        </div>
      ` : `
        <div class="mb-2">
          <label>Importe Total</label>
          <input type="number" name="importe" class="form-control" step="0.01" value="${data.importe}" disabled>
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
  const selectProv = document.getElementById('selectProveedorDetalleDocumento');
obtenerProveedores().then(proveedores => {
  proveedores.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.nombre;
    if (p.id === data.id_proveedor) option.selected = true;
    selectProv.appendChild(option);
  });
});

  // Activar botón guardar
  const btnGuardar = document.getElementById('btnGuardarCambiosDocumento');
  btnGuardar.dataset.tipo = tipo;
  btnGuardar.dataset.id = data.id;

     
  modal.show();
}

document.getElementById('btnHabilitarEdicion').addEventListener('click', () => {
  const form = document.querySelector('#formDetalleDocumento');
  form.querySelectorAll('input, select').forEach(el => {
  el.disabled = false;
  if (el.hasAttribute('readonly')) el.removeAttribute('readonly');
});

  document.getElementById('btnGuardarCambiosDocumento').classList.remove('d-none');
});

document.getElementById('btnGuardarCambiosDocumento').addEventListener('click', async () => {
  const form = document.querySelector('#formDetalleDocumento');
  const tipo = document.getElementById('btnGuardarCambiosDocumento').dataset.tipo;
  const id = document.getElementById('btnGuardarCambiosDocumento').dataset.id;
const datos = {
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


  try {
    const res = await fetch(`/administracion/api/${tipo}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });

    if (!res.ok) throw new Error();

    Swal.fire('Éxito', `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} actualizado correctamente`, 'success');
    document.getElementById('btnGuardarCambiosDocumento').classList.add('d-none');
    form.querySelectorAll('input, select').forEach(el => el.disabled = true);
  } catch (err) {
    Swal.fire('Error', 'No se pudo guardar los cambios', 'error');
  }
});
document.getElementById('btnGenerarPDFResumenFacturas').addEventListener('click', () => {
  const desde = document.getElementById('filtroFechaDesde').value;
  const hasta = document.getElementById('filtroFechaHasta').value;
  const proveedor = document.getElementById('filtroProveedor').value;
  const condicion = document.getElementById('filtroCondicion').value;


  if (!desde || !hasta) {
    Swal.fire('Faltan fechas', 'Debés seleccionar un rango de fechas.', 'warning');
    return;
  }

  const url = `/administracion/pdf/resumen/facturas?desde=${desde}&hasta=${hasta}&proveedor=${proveedor}&condicion=${condicion}`;
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

  const url = `/administracion/pdf/resumen/presupuestos?desde=${desde}&hasta=${hasta}&proveedor=${proveedor}&condicion=${condicion}`;
  window.open(url, '_blank');
});

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
    const res = await fetch(`/administracion/api/${tipo}/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error();

    Swal.fire('Eliminado', 'Documento eliminado correctamente.', 'success');
    document.getElementById('modalDetalleDocumento').classList.remove('show');
    document.querySelector('.modal-backdrop').remove();
    document.body.classList.remove('modal-open');
  } catch (err) {
    Swal.fire('Error', 'No se pudo eliminar el documento.', 'error');
  }
});
