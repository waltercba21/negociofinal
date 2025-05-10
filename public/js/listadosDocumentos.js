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

  let documentosFiltrados = [];
  let paginaActual = 1;
  const porPagina = 6;

function renderizarPaginado() {
  const inicio = (paginaActual - 1) * porPagina;
  const fin = inicio + porPagina;
  const pagina = documentosFiltrados.slice(inicio, fin);

  const html = `
    <div class="row">
      ${pagina.map(doc => `
        <div class="col-md-6 mb-3">
          <div class="card border-0 shadow-sm p-3 h-100">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="fw-bold">${doc.nombre_proveedor}</div>
                <div class="text-muted small">${doc.tipo.toUpperCase()} N° ${doc.numero}</div>
                <div class="text-muted small">Fecha: ${formatoFecha(doc.fecha)}</div>
              </div>
              <button class="btn btn-sm btn-outline-primary verDocumentoBtn" data-id="${doc.id}" data-tipo="${doc.tipo}">
                Ver
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  const totalPaginas = Math.ceil(documentosFiltrados.length / porPagina);
  let paginacionHTML = '<div class="d-flex justify-content-center mt-3 gap-2">';
  for (let i = 1; i <= totalPaginas; i++) {
    paginacionHTML += `
      <button class="btn btn-sm ${i === paginaActual ? 'btn-dark' : 'btn-outline-secondary'} paginadorBtn" data-pag="${i}">${i}</button>
    `;
  }
  paginacionHTML += '</div>';

  contenidoDetalle.innerHTML = html + paginacionHTML;
  modal.show();
}


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

      // Ordenar por fecha descendente
      documentosFiltrados = data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      paginaActual = 1;
      renderizarPaginado();
    } catch (error) {
      console.error('❌ Error al obtener documentos:', error);
      resultadosListado.innerHTML = '<div class="alert alert-danger">Ocurrió un error al buscar los documentos.</div>';
    }
  });

  // Delegación para paginación
  document.getElementById('contenidoDetalleDocumento').addEventListener('click', (e) => {
    if (e.target.classList.contains('paginadorBtn')) {
      paginaActual = parseInt(e.target.dataset.pag);
      renderizarPaginado();
    }
  });

  // Delegación para botón "Ver"
  document.getElementById('contenidoDetalleDocumento').addEventListener('click', async (e) => {
    if (e.target.classList.contains('verDocumentoBtn')) {
      const id = e.target.dataset.id;
      const tipo = e.target.dataset.tipo;

      try {
        const response = await fetch(`/administracion/api/${tipo}/${id}`);
        console.log('📡 Fetching documento desde URL:', `/administracion/api/${tipo}/${id}`);

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
  function formatearFecha(fechaStr) {
  const fecha = new Date(fechaStr);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function formatearPesos(monto) {
  const numero = parseFloat(monto);
  if (isNaN(numero)) return '-';
  const opciones = { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 };
  const formato = new Intl.NumberFormat('es-AR', opciones).format(numero);
  return formato;
}

async function mostrarDetalleDocumento(tipo, id) {
  try {
    const res = await fetch(`/administracion/api/documentos/${tipo}/${id}`);
    const datos = await res.json();

    const contenedor = document.getElementById('contenidoDetalleDocumento');
    if (!contenedor) return;

let html = `<h5 class="mb-3">${datos.nombre_proveedor || 'Proveedor'}</h5>`;

if (tipo === 'factura') {
  html += `
    <p><strong>Factura N°:</strong> ${datos.numero_factura}</p>
    <p><strong>Fecha:</strong> ${formatearFecha(datos.fecha)}</p>
    <p><strong>Importe Bruto:</strong> ${formatearPesos(datos.importe_bruto)}</p>
    <p><strong>IVA:</strong> ${datos.iva}%</p>
    <p><strong>Importe Total:</strong> ${formatearPesos(datos.importe_factura)}</p>
    <p><strong>Vencimiento:</strong> ${formatearFecha(datos.fecha_pago)}</p>
    <p><strong>Condición:</strong> ${datos.condicion}</p>
    <p><strong>Comprobante:</strong> ${datos.comprobante_pago ? `<a href="/uploads/comprobantes/${datos.comprobante_pago}" target="_blank">${datos.comprobante_pago}</a>` : 'Sin archivo'}</p>
  `;
} else if (tipo === 'presupuesto') {
  html += `
    <p><strong>Presupuesto N°:</strong> ${datos.numero_presupuesto}</p>
    <p><strong>Fecha:</strong> ${formatearFecha(datos.fecha)}</p>
    <p><strong>Importe Total:</strong> ${formatearPesos(datos.importe)}</p>
    <p><strong>Vencimiento:</strong> ${formatearFecha(datos.fecha_pago)}</p>
    <p><strong>Condición:</strong> ${datos.condicion}</p>
  `;
}

html += `
  <button class="btn btn-outline-info mt-3" id="btnVerProductosDocumento">
    Ver Productos
  </button>
`;

contenedor.innerHTML = html;

// ✅ Asociar botón luego de renderizar
document.getElementById('btnVerProductosDocumento')?.addEventListener('click', () => {
  abrirModalProductosDocumento(datos.productos);
});

const modal = new bootstrap.Modal(document.getElementById('modalDetalleDocumento'));
modal.show();


  } catch (err) {
    console.error('❌ Error al cargar detalle del documento:', err);
    Swal.fire('Error', 'No se pudo cargar el detalle.', 'error');
  }
}
function abrirModalProductosDocumento(productos = []) {
  const tbody = document.getElementById('tbodyProductosDetalle');
  tbody.innerHTML = '';

  if (!productos.length) {
    const fila = document.createElement('tr');
    fila.innerHTML = `<td colspan="4">Sin productos registrados.</td>`;
    tbody.appendChild(fila);
  } else {
    productos.forEach(prod => {
      const fila = document.createElement('tr');

      const imagen = prod.imagenes && prod.imagenes.length > 0
        ? `<img src="/uploads/productos/${prod.imagenes[0].imagen}" style="width:40px;height:40px;object-fit:contain">`
        : '—';

      const codigoProveedor = prod.proveedores?.[0]?.codigo || '—';

      fila.innerHTML = `
        <td>${imagen}</td>
        <td>${prod.nombre}</td>
        <td>${codigoProveedor}</td>
        <td>${prod.cantidad}</td>
      `;
      tbody.appendChild(fila);
    });
  }

  const modal = new bootstrap.Modal(document.getElementById('modalProductosDocumento'));
  modal.show();
}

});
