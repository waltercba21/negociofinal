document.addEventListener('DOMContentLoaded', () => {
  const btnBuscar = document.getElementById('btnBuscarListados');
  const resultados = document.getElementById('resultadosListado');
  const modalDetalleEl = document.getElementById('modalDetalleDocumento');
  const contenidoDetalle = document.getElementById('contenidoDetalleDocumento');

  let modalDetalle = null;
  let datosGlobales = [];

  // Verificación de existencia del modal
  if (!modalDetalleEl) {
    console.error('⛔ No se encontró el modalDetalleDocumento en el DOM.');
  } else {
    modalDetalle = new bootstrap.Modal(modalDetalleEl);
  }

  btnBuscar.addEventListener('click', async () => {
    const tipo = document.getElementById('filtroTipo')?.value || '';
    const proveedor = document.getElementById('filtroProveedor')?.value || '';
    const fechaDesde = document.getElementById('filtroFechaDesde')?.value || '';
    const fechaHasta = document.getElementById('filtroFechaHasta')?.value || '';
    const condicion = document.getElementById('filtroCondicion')?.value || '';

    resultados.innerHTML = '<p class="text-muted">Buscando resultados...</p>';

    try {
      const res = await fetch(`/administracion/api/documentos?tipo=${tipo}&proveedor=${proveedor}&fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&condicion=${condicion}`);
      const data = await res.json();

      datosGlobales = data;
      renderizarResultados(data);
    } catch (err) {
      resultados.innerHTML = '<div class="alert alert-danger">Ocurrió un error al buscar documentos.</div>';
      console.error('❌ Error en fetch:', err);
    }
  });

  function renderizarResultados(lista) {
    resultados.innerHTML = '';

    if (!lista.length) {
      resultados.innerHTML = '<div class="alert alert-warning">No se encontraron documentos.</div>';
      return;
    }

    const row = document.createElement('div');
    row.className = 'row';

    lista.forEach(doc => {
      const col = document.createElement('div');
      col.className = 'col-md-6 mb-3';

      col.innerHTML = `
        <div class="card p-3 shadow-sm">
          <h6>${doc.nombre_proveedor}</h6>
          <p><strong>${doc.tipo.toUpperCase()}:</strong> ${doc.numero}</p>
          <p><strong>Fecha:</strong> ${formatearFecha(doc.fecha)}</p>
          <p><strong>Condición:</strong> ${doc.condicion}</p>
          <button class="btn btn-sm btn-primary" data-id="${doc.id}" data-tipo="${doc.tipo}">Ver</button>
        </div>
      `;

      const btn = col.querySelector('button');
      btn.addEventListener('click', () => mostrarDetalle(doc.id, doc.tipo));

      row.appendChild(col);
    });

    resultados.appendChild(row);
  }

  async function mostrarDetalle(id, tipo) {
    try {
      const res = await fetch(`/administracion/api/${tipo}/${id}`);
      const doc = await res.json();

      if (!contenidoDetalle) {
        console.error('⛔ No se encontró #contenidoDetalleDocumento.');
        return;
      }

      contenidoDetalle.innerHTML = `
        <p><strong>Proveedor:</strong> ${doc.nombre_proveedor}</p>
        <p><strong>Número:</strong> ${doc.numero_factura || doc.numero_presupuesto}</p>
        <p><strong>Fecha:</strong> ${formatearFecha(doc.fecha)}</p>
        <p><strong>Total:</strong> $${doc.importe || doc.importe_factura}</p>
        <p><strong>Condición:</strong> ${doc.condicion}</p>
      `;

      if (modalDetalle) {
        modalDetalle.show();
      } else {
        console.error('⛔ modalDetalle no fue inicializado correctamente.');
      }

    } catch (err) {
      console.error('❌ Error al mostrar detalle del documento:', err);
      Swal.fire('Error', 'No se pudo mostrar el detalle del documento.', 'error');
    }
  }

  function formatearFecha(fechaStr) {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString('es-AR');
  }
});
