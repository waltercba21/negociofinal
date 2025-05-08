document.addEventListener('DOMContentLoaded', () => {
  console.log('🟢 Script cargado');

  const modal = new bootstrap.Modal(document.getElementById('modalProveedor'));
  const form = document.getElementById('formProveedor');
  const select = document.getElementById('selectProveedor');
  const contenedor = document.getElementById('detalleProveedor');
  const btnNuevoProveedor = document.getElementById('btnNuevoProveedor');
  const btnEditarProveedor = document.getElementById('btnEditarProveedor');
  const btnEliminarProveedor = document.getElementById('btnEliminarProveedor');
  const btnEliminarDirecto = document.getElementById('btnEliminarProveedorDirecto');

  let proveedorSeleccionado = null;

  window.actualizarListaProveedores = async function (selectedId = null) {
    console.log('🔁 Ejecutando actualizarListaProveedores');

    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Seleccionar proveedor...';
    select.appendChild(defaultOption);

    try {
      const res = await fetch('/administracion/api/proveedores');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const proveedores = await res.json();

      const idsAgregados = new Set();

      proveedores.forEach(p => {
        if (idsAgregados.has(p.id)) return;
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.nombre;
        select.appendChild(option);
        idsAgregados.add(p.id);
      });

      if (selectedId) {
        select.value = selectedId;
        select.dispatchEvent(new Event('change'));
      }
    } catch (err) {
      console.error('❌ Error al cargar proveedores:', err);
    }
  };

  select.addEventListener('change', () => {
    const id = select.value;
    if (!id) {
      contenedor.innerHTML = '<p class="text-muted">Seleccioná un proveedor</p>';
      btnEditarProveedor.disabled = true;
      btnEliminarDirecto.disabled = true;
      proveedorSeleccionado = null;
      return;
    }

    fetch(`/administracion/api/proveedores/${id}`)
      .then(res => res.json())
      .then(prov => {
        proveedorSeleccionado = prov;

        const descuento = prov.descuento !== null ? `${prov.descuento}%` : '-';

        contenedor.innerHTML = `
          <p><strong>Contacto:</strong> ${prov.contacto || '-'}</p>
          <p><strong>Teléfono:</strong> ${prov.telefono || '-'}</p>
          <p><strong>Email:</strong> ${prov.mail || '-'}</p>
          <p><strong>Dirección:</strong> ${prov.direccion || '-'}</p>
          <p><strong>Ciudad:</strong> ${prov.ciudad || '-'} - ${prov.provincia || '-'}</p>
          <p><strong>CUIT:</strong> ${prov.cuit || '-'}</p>
          <p><strong>Banco:</strong> ${prov.banco || '-'}</p>
          <p><strong>CBU:</strong> ${prov.cbu || '-'}</p>
          <p><strong>Alias:</strong> ${prov.alias || '-'}</p>
          <p><strong>Descuento:</strong> ${descuento}</p>
        `;

        btnEditarProveedor.disabled = false;
        btnEliminarDirecto.disabled = false;
      });
  });

  btnNuevoProveedor.addEventListener('click', () => {
    form.reset();
    form.proveedorId.value = '';
    document.getElementById('modalProveedorLabel').textContent = 'Nuevo Proveedor';
    btnEliminarProveedor.classList.add('d-none');
    modal.show();
  });

  btnEditarProveedor.addEventListener('click', () => {
    if (!proveedorSeleccionado) return;

    for (const key in proveedorSeleccionado) {
      const input = form.elements.namedItem(key);
      if (input) input.value = proveedorSeleccionado[key] || '';
    }

    document.getElementById('modalProveedorLabel').textContent = 'Editar Proveedor';
    btnEliminarProveedor.classList.remove('d-none');
    modal.show();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = form.proveedorId.value;
    const data = Object.fromEntries(new FormData(form).entries());

    Swal.fire({
      title: '¿Guardar cambios?',
      text: id ? 'Estás por modificar este proveedor.' : 'Se creará un nuevo proveedor.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) return;

      fetch(id ? `/administracion/api/proveedores/${id}` : '/administracion/api/proveedores', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(res => res.json())
        .then(resp => {
          const proveedorId = resp.insertId || id;
          actualizarListaProveedores(proveedorId);
          modal.hide();
          Swal.fire('Éxito', 'Proveedor guardado correctamente.', 'success');
        })
        .catch(err => {
          console.error('❌ Error al guardar proveedor:', err);
          Swal.fire('Error', 'No se pudo guardar el proveedor.', 'error');
        });
    });
  });

  btnEliminarProveedor.addEventListener('click', () => {
    const id = form.proveedorId.value;
    if (!id) return;

    Swal.fire({
      title: '¿Eliminar proveedor?',
      text: 'Esta acción eliminará también el descuento.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) return;

      fetch(`/administracion/api/proveedores/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(resp => {
          actualizarListaProveedores();
          contenedor.innerHTML = '<p class="text-muted">Seleccioná un proveedor</p>';
          modal.hide();
          Swal.fire('Eliminado', 'Proveedor eliminado correctamente.', 'success');
        })
        .catch(err => {
          console.error('❌ Error al eliminar proveedor:', err);
          Swal.fire('Error', 'No se pudo eliminar el proveedor.', 'error');
        });
    });
  });

  btnEliminarDirecto.addEventListener('click', () => {
    if (!proveedorSeleccionado) return;

    Swal.fire({
      title: '¿Eliminar proveedor?',
      text: 'Esta acción eliminará también su descuento.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) return;

      fetch(`/administracion/api/proveedores/${proveedorSeleccionado.id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(resp => {
          actualizarListaProveedores();
          contenedor.innerHTML = '<p class="text-muted">Seleccioná un proveedor</p>';
          Swal.fire('Eliminado', 'Proveedor eliminado correctamente.', 'success');
        })
        .catch(err => {
          console.error('❌ Error al eliminar proveedor:', err);
          Swal.fire('Error', 'No se pudo eliminar el proveedor.', 'error');
        });
    });
  });

  // Carga inicial solo si el select viene vacío
  if (!select || select.options.length <= 1) {
    actualizarListaProveedores();
  }
});
