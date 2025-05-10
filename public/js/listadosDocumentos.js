document.addEventListener('DOMContentLoaded', () => {
  const btnBuscar = document.getElementById('btnBuscarListados');
  const resultadosListado = document.getElementById('resultadosListado');
  const modal = new bootstrap.Modal(document.getElementById('modalDetalleDocumento'));
  const contenidoDetalle = document.getElementById('contenidoDetalleDocumento');

  const formatoFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  btnBuscar.addEventListener('click', async () => {
    const tipo = document.getElementById('filtroTipo')?.value || '';
    const proveedor = document.getElementById('filtroProveedor')?.value || '';
    const fechaDesde = document.getElementById('filtroFechaDesde')?.value || '';
    const fechaHasta = document.getElementById('filtroFechaHasta')?.value || '';
    const condicion = document.getElementById('filtroCondicion')?.value || '';

    try {
      const response = await fetch(`/administracion/api/documentos?tipo=${tipo}&proveedor=${proveedor}&fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&condicion=${condicion}`);
      const data = await response.json();

      resultadosListado.innerHTML = '';

      if (!data.length) {
        resultadosListado.innerHTML = '<div class="alert alert-warning">No se encontraron resultados para los filtros aplicados.</div>';
        return;
      }

      // Abrimos el modal y mostramos el listado de documentos
      const html = data.map(doc => `
        <div class="border rounded p-3 mb-2">
          <strong>${doc.nombre_proveedor}</strong><br>
          <span>${doc.tipo.toUpperCase()} N° ${doc.numero}</span><br>
          <span>Fecha: ${formatoFecha(doc.fecha)}</span><br>
          <span>Estado: ${doc.condicion.toUpperCase()}</span><br>
          <button class="btn btn-sm btn-outline-primary mt-2 verDocumentoBtn" data-id="${doc.id}" data-tipo="${doc.tipo}">
            Ver
          </button>
        </div>
      `).join('');

      contenidoDetalle.innerHTML = html;
      modal.show();
    } catch (error) {
      console.error('❌ Error al obtener documentos:', error);
      resultadosListado.innerHTML = '<div class="alert alert-danger">Ocurrió un error al buscar los documentos.</div>';
    }
  });

  // Delegación para botón "Ver"
  document.getElementById('contenidoDetalleDocumento').addEventListener('click', async (e) => {
    if (e.target.classList.contains('verDocumentoBtn')) {
      const id = e.target.dataset.id;
      const tipo = e.target.dataset.tipo;

      try {
        const response = await fetch(`/administracion/api/${tipo}s/${id}`);
        const data = await response.json();

        let detalleHTML = `
          <h5>${tipo.toUpperCase()} N° ${data.numero}</h5>
          <p><strong>Proveedor:</strong> ${data.nombre_proveedor}</p>
          <p><strong>Fecha:</strong> ${formatoFecha(data.fecha)}</p>
          <p><strong>Condición:</strong> ${data.condicion.toUpperCase()}</p>
        `;

        if (data.productos && data.productos.length) {
          detalleHTML += `<h6 class="mt-3">Productos</h6><ul>`;
          data.productos.forEach(p => {
            detalleHTML += `<li>${p.nombre} - Cantidad: ${p.cantidad}</li>`;
          });
          detalleHTML += `</ul>`;
        }

        contenidoDetalle.innerHTML = detalleHTML;
      } catch (error) {
        console.error('❌ Error al cargar detalles del documento:', error);
        contenidoDetalle.innerHTML = '<div class="alert alert-danger">Error al mostrar el detalle del documento.</div>';
      }
    }
  });
});
