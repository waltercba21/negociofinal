document.addEventListener('DOMContentLoaded', () => {
  const btnBuscar = document.getElementById('btnBuscarListados');
  const filtroProveedor = document.getElementById('filtroProveedor');
  const filtroFecha = document.getElementById('filtroFecha');
  const filtroCondicion = document.getElementById('filtroCondicion');
  const resultados = document.getElementById('resultadosListado');
  const modal = new bootstrap.Modal(document.getElementById('modalDetalleDocumento'));
  const contenidoModal = document.getElementById('contenidoDetalleDocumento');

  btnBuscar.addEventListener('click', async () => {
    const proveedor = filtroProveedor.value;
    const fecha = filtroFecha.value;
    const condicion = filtroCondicion.value;

    resultados.innerHTML = '<p class="text-muted">Buscando...</p>';

    try {
      const res = await fetch(`/administracion/api/documentos?proveedor=${proveedor}&fecha=${fecha}&condicion=${condicion}`);
      const documentos = await res.json();

      if (!documentos.length) {
        resultados.innerHTML = '<p class="text-muted">No se encontraron resultados.</p>';
        return;
      }

      const lista = document.createElement('ul');
      lista.classList.add('list-group');

      documentos.forEach(doc => {
        const item = document.createElement('li');
        item.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
        item.innerHTML = `
          <span>
            <strong>${doc.tipo.toUpperCase()}</strong> #${doc.numero} - ${doc.nombre_proveedor} (${doc.fecha})
          </span>
          <button class="btn btn-sm btn-primary" data-id="${doc.id}" data-tipo="${doc.tipo}">Ver</button>
        `;

        item.querySelector('button').addEventListener('click', () => cargarDetalleDocumento(doc.id, doc.tipo));
        lista.appendChild(item);
      });

      resultados.innerHTML = '';
      resultados.appendChild(lista);

    } catch (err) {
      console.error('Error al cargar documentos:', err);
      resultados.innerHTML = '<p class="text-danger">Ocurrió un error.</p>';
    }
  });

  async function cargarDetalleDocumento(id, tipo) {
    try {
      const res = await fetch(`/administracion/api/${tipo}/${id}`);
      const data = await res.json();

      contenidoModal.innerHTML = `
        <form id="formEditarDocumento">
          <input type="hidden" name="id" value="${data.id}">
          <div class="mb-3">
            <label class="form-label">Proveedor</label>
            <input type="text" class="form-control" value="${data.nombre_proveedor}" disabled>
          </div>
          <div class="mb-3">
            <label class="form-label">Número</label>
            <input type="text" class="form-control" name="numero" value="${data.numero}">
          </div>
          <div class="mb-3">
            <label class="form-label">Fecha</label>
            <input type="date" class="form-control" name="fecha" value="${data.fecha}">
          </div>
          <div class="mb-3">
            <label class="form-label">Condición</label>
            <select name="condicion" class="form-select">
              <option value="pendiente" ${data.condicion === 'pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value="pagado" ${data.condicion === 'pagado' ? 'selected' : ''}>Pagado</option>
            </select>
          </div>
        </form>
        <p class="mt-3"><strong>Productos:</strong></p>
        <ul class="list-group">
          ${data.productos.map(p => `<li class="list-group-item">${p.nombre} - Cantidad: ${p.cantidad}</li>`).join('')}
        </ul>
      `;

      modal.show();

      document.getElementById('btnGuardarCambiosDocumento').onclick = async () => {
        const form = document.getElementById('formEditarDocumento');
        const datos = Object.fromEntries(new FormData(form));

        try {
          const res = await fetch(`/administracion/api/${tipo}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
          });
          const respuesta = await res.json();
          Swal.fire('Actualizado', respuesta.message || 'Cambios guardados.', 'success');
          modal.hide();
        } catch (err) {
          console.error('Error al guardar cambios:', err);
          Swal.fire('Error', 'No se pudieron guardar los cambios.', 'error');
        }
      };
    } catch (err) {
      console.error('Error al cargar detalle:', err);
      Swal.fire('Error', 'No se pudo cargar el detalle.', 'error');
    }
  }
});
