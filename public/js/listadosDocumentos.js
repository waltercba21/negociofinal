document.addEventListener('DOMContentLoaded', () => {
  const btnBuscar = document.getElementById('btnBuscarListados');
  const modal = new bootstrap.Modal(document.getElementById('modalResultadosListados'));
  const contenedorResultados = document.getElementById('contenedorResultadosListados');
  const btnAnterior = document.getElementById('btnAnteriorPagina');
  const btnSiguiente = document.getElementById('btnSiguientePagina');
  const indicadorPagina = document.getElementById('indicadorPagina');

  let datosFiltrados = [];
  let paginaActual = 1;
  const tarjetasPorPagina = 10;

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
});
