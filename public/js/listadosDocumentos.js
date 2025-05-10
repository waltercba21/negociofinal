document.addEventListener('DOMContentLoaded', () => {
  const btnBuscar = document.getElementById('btnBuscarListados');
  const resultadosListado = document.getElementById('resultadosListado');
  const contenidoDetalle = document.getElementById('contenidoDetalleDocumento');

  let documentosFiltrados = [];
  let paginaActual = 1;
  const porPagina = 6;

  const formatearFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  const formatearPesos = (monto) => {
    const numero = parseFloat(monto);
    if (isNaN(numero)) return '-';
    const opciones = { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 };
    return new Intl.NumberFormat('es-AR', opciones).format(numero);
  };

  function renderizarPaginado() {
    resultadosListado.innerHTML = '';
    const inicio = (paginaActual - 1) * porPagina;
    const documentosPagina = documentosFiltrados.slice(inicio, inicio + porPagina);

    const fila = document.createElement('div');
    fila.classList.add('row');

    documentosPagina.forEach(doc => {
      const col = document.createElement('div');
      col.classList.add('col-md-6', 'mb-3');

      const tarjeta = document.createElement('div');
      tarjeta.classList.add('border', 'rounded', 'p-3', 'shadow-sm', 'h-100');

      tarjeta.innerHTML = `
        <h6 class="mb-2">${doc.nombre_proveedor}</h6>
        <p class="mb-1">${doc.tipo.toUpperCase()} N°: <strong>${doc.numero}</strong></p>
        <p class="mb-1">Fecha: ${formatearFecha(doc.fecha)}</p>
        <p class="mb-2">Condición: <strong>${doc.condicion.toUpperCase()}</strong></p>
        <button class="btn btn-sm btn-outline-primary verDocumentoBtn" data-id="${doc.id}" data-tipo="${doc.tipo}">Ver</button>
      `;

      col.appendChild(tarjeta);
      fila.appendChild(col);
    });

    resultadosListado.appendChild(fila);

    const totalPaginas = Math.ceil(documentosFiltrados.length / porPagina);
    if (totalPaginas > 1) {
      const paginador = document.createElement('div');
      paginador.classList.add('mt-3', 'text-center');

      for (let i = 1; i <= totalPaginas; i++) {
        const btn = document.createElement('button');
        btn.classList.add('btn', 'btn-sm', i === paginaActual ? 'btn-primary' : 'btn-outline-primary', 'me-1', 'paginadorBtn');
        btn.textContent = i;
        btn.dataset.pag = i;
        paginador.appendChild(btn);
      }

      resultadosListado.appendChild(paginador);
    }
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
        resultadosListado.innerHTML = '<div class="alert alert-warning">No se encontraron resultados.</div>';
        return;
      }

      documentosFiltrados = data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      paginaActual = 1;
      renderizarPaginado();
    } catch (error) {
      console.error('❌ Error al obtener documentos:', error);
      resultadosListado.innerHTML = '<div class="alert alert-danger">Ocurrió un error al buscar los documentos.</div>';
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('paginadorBtn')) {
      paginaActual = parseInt(e.target.dataset.pag);
      renderizarPaginado();
    }

    if (e.target.classList.contains('verDocumentoBtn')) {
      const id = e.target.dataset.id;
      const tipo = e.target.dataset.tipo;
      mostrarDetalleDocumento(tipo, id);
    }
  });

  async function mostrarDetalleDocumento(tipo, id) {
    try {
      const res = await fetch(`/administracion/api/${tipo}/${id}`);
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
          <p><strong>Comprobante:</strong> 
            ${datos.comprobante_pago 
              ? `<a href="/uploads/comprobantes/${datos.comprobante_pago}" target="_blank">${datos.comprobante_pago}</a>` 
              : 'Sin archivo'}
          </p>
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

      if (datos.productos && datos.productos.length) {
        html += `
          <div class="mt-3">
            <button class="btn btn-outline-info" id="btnVerProductosDocumento">Ver Productos</button>
          </div>
        `;
      }

      contenedor.innerHTML = html;

      const btnProductos = document.getElementById('btnVerProductosDocumento');
      if (btnProductos) {
        btnProductos.addEventListener('click', () => {
          abrirModalProductosDocumento(datos.productos);
        });
      }

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
      tbody.innerHTML = `<tr><td colspan="4">No hay productos cargados.</td></tr>`;
      return;
    }

    productos.forEach(prod => {
      const fila = document.createElement('tr');
      const imagen = prod.imagenes?.[0]?.imagen
        ? `<img src="/uploads/productos/${prod.imagenes[0].imagen}" style="width:40px;height:40px;object-fit:contain">`
        : '—';

      const codigoProv = prod.proveedores?.[0]?.codigo || '—';

      fila.innerHTML = `
        <td>${imagen}</td>
        <td>${prod.nombre}</td>
        <td>${codigoProv}</td>
        <td>${prod.cantidad}</td>
      `;
      tbody.appendChild(fila);
    });

    const modal = new bootstrap.Modal(document.getElementById('modalProductosDocumento'));
    modal.show();
  }
});
