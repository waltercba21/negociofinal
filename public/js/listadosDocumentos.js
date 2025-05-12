document.addEventListener('DOMContentLoaded', () => {
  const btnBuscar = document.getElementById('btnBuscarListados');
  const modal = new bootstrap.Modal(document.getElementById('modalResultadosListados'));
  const contenedorResultados = document.getElementById('contenedorResultadosListados');

  btnBuscar.addEventListener('click', async () => {
    const proveedor = document.getElementById('filtroProveedor').value;
    const tipo = document.getElementById('filtroTipo').value;
    const fechaDesde = document.getElementById('filtroFechaDesde').value;
    const fechaHasta = document.getElementById('filtroFechaHasta').value;
    const condicion = document.getElementById('filtroCondicion').value;

    try {
      const query = new URLSearchParams({
        proveedor,
        tipo,
        fechaDesde,
        fechaHasta,
        condicion
      });

      const res = await fetch(`/administracion/api/listarDocumentos?${query.toString()}`);
      const datos = await res.json();

      contenedorResultados.innerHTML = '';

      if (!datos.length) {
        contenedorResultados.innerHTML = '<p class="text-muted">No se encontraron resultados.</p>';
        return modal.show();
      }

      datos.forEach(doc => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'col-md-6 mb-3';

        tarjeta.innerHTML = `
          <div class="card shadow-sm">
            <div class="card-body">
              <h6 class="card-subtitle mb-2 text-muted">${doc.tipo.toUpperCase()}</h6>
              <p class="card-text mb-1"><strong>Número:</strong> ${doc.numero}</p>
              <p class="card-text mb-1"><strong>Fecha:</strong> ${new Date(doc.fecha).toLocaleDateString()}</p>
              <p class="card-text"><strong>Proveedor:</strong> ${doc.nombre_proveedor}</p>
              <button class="btn btn-outline-primary btn-sm ver-mas-documento" data-id="${doc.id}" data-tipo="${doc.tipo}">
                Ver más
              </button>
            </div>
          </div>
        `;

        contenedorResultados.appendChild(tarjeta);
      });

      modal.show();
    } catch (err) {
      console.error('❌ Error al buscar documentos:', err);
      Swal.fire('Error', 'Ocurrió un error al buscar los documentos.', 'error');
    }
  });

  // Futuro: acción del botón Ver más
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('ver-mas-documento')) {
      const id = e.target.dataset.id;
      const tipo = e.target.dataset.tipo;
      console.log(`🔍 Ver más ${tipo} con ID ${id}`);
      // Implementaremos esto después
    }
  });
});
