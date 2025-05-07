document.addEventListener('DOMContentLoaded', () => {
  const modal = new bootstrap.Modal(document.getElementById('modalProveedor'));
  const form = document.getElementById('formProveedor');
  const btnAgregar = document.getElementById('btnAgregarProveedor');
  const btnEliminar = document.getElementById('btnEliminarProveedor');
  const select = document.getElementById('selectProveedor');
  const contenedor = document.getElementById('detalleProveedor');
  const btnNuevoProveedor = document.getElementById('btnNuevoProveedor');
  const btnEditarProveedor = document.getElementById('btnEditarProveedor');
  const btnEliminarDirecto = document.getElementById('btnEliminarProveedorDirecto');

  let proveedorSeleccionado = null;

  if (select) {
    select.addEventListener('change', () => {
      const id = select.value;
      if (!id) {
        contenedor.innerHTML = '<p class="text-muted">Seleccioná un proveedor para ver sus datos.</p>';
        btnEditarProveedor.disabled = true;
        btnEliminarDirecto.disabled = true;
        proveedorSeleccionado = null;
        return;
      }

      fetch(`/administracion/api/proveedores/${id}`)
        .then(res => res.json())
        .then(proveedor => {
          proveedorSeleccionado = proveedor;
          const descuentoTexto = proveedor.descuento !== null ? `${proveedor.descuento}%` : 'Sin descuento';
          contenedor.innerHTML = `
            <p><strong>Contacto:</strong> ${proveedor.contacto || '-'}</p>
            <p><strong>Teléfono:</strong> ${proveedor.telefono || '-'}</p>
            <p><strong>Email:</strong> ${proveedor.mail || '-'}</p>
            <p><strong>Dirección:</strong> ${proveedor.direccion || '-'}</p>
            <p><strong>Ciudad:</strong> ${proveedor.ciudad || '-'} - ${proveedor.provincia || '-'}</p>
            <p><strong>CUIT:</strong> ${proveedor.cuit || '-'}</p>
            <p><strong>Banco:</strong> ${proveedor.banco || '-'}</p>
            <p><strong>CBU:</strong> ${proveedor.cbu || '-'}</p>
            <p><strong>Alias:</strong> ${proveedor.alias || '-'}</p>
            <p><strong>Descuento:</strong> ${descuentoTexto}</p>
          `;
          btnEditarProveedor.disabled = false;
          btnEliminarDirecto.disabled = false;
        })
        .catch(err => {
          console.error(err);
          contenedor.innerHTML = '<p class="text-danger">Error al cargar los datos del proveedor.</p>';
        });
    });
  }

  if (btnNuevoProveedor) {
    btnNuevoProveedor.addEventListener('click', () => {
      form.reset();
      document.getElementById('proveedorId').value = '';
      document.getElementById('modalProveedorLabel').textContent = 'Nuevo Proveedor';
      btnEliminar.style.display = 'none';
      modal.show();
    });
  }

  if (btnEditarProveedor) {
    btnEditarProveedor.addEventListener('click', () => {
      if (!proveedorSeleccionado) return;
      document.getElementById('proveedorId').value = proveedorSeleccionado.id;
      form.nombre.value = proveedorSeleccionado.nombre || '';
      form.contacto.value = proveedorSeleccionado.contacto || '';
      form.telefono.value = proveedorSeleccionado.telefono || '';
      form.mail.value = proveedorSeleccionado.mail || '';
      form.direccion.value = proveedorSeleccionado.direccion || '';
      form.ciudad.value = proveedorSeleccionado.ciudad || '';
      form.provincia.value = proveedorSeleccionado.provincia || '';
      form.cuit.value = proveedorSeleccionado.cuit || '';
      form.banco.value = proveedorSeleccionado.banco || '';
      form.cbu.value = proveedorSeleccionado.cbu || '';
      form.alias.value = proveedorSeleccionado.alias || '';
      form.descuento.value = proveedorSeleccionado.descuento ?? '';

      document.getElementById('modalProveedorLabel').textContent = 'Editar Proveedor';
      btnEliminar.style.display = 'inline-block';
      modal.show();
    });
  }

  if (btnEliminarDirecto) {
    btnEliminarDirecto.addEventListener('click', () => {
      if (!proveedorSeleccionado) return;
      if (confirm('¿Seguro que querés eliminar este proveedor?')) {
        fetch(`/administracion/api/proveedores/${proveedorSeleccionado.id}`, {
          method: 'DELETE'
        })
          .then(res => res.json())
          .then(resp => {
            alert(resp.message);
            location.reload();
          })
          .catch(err => {
            console.error('Error al eliminar proveedor:', err);
            alert('Error al eliminar proveedor.');
          });
      }
    });
  }

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const id = document.getElementById('proveedorId').value;
      const data = Object.fromEntries(new FormData(form).entries());

      const confirmText = id
        ? `¿Estás seguro de que querés guardar los cambios para el proveedor "${form.nombre.value}"?\n\nIMPORTANTE: Si modificás el descuento, afectará los precios de toda la lista.`
        : `¿Estás seguro de que querés crear un nuevo proveedor con el nombre "${form.nombre.value}"?`;

      Swal.fire({
        title: 'Confirmar cambios',
        text: confirmText,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#198754',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (result.isConfirmed) {
          fetch(id ? `/administracion/api/proveedores/${id}` : '/administracion/api/proveedores', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          })
            .then(res => res.json())
            .then(resp => {
              console.log('🟢 Respuesta al guardar proveedor:', resp);
              const proveedorId = resp.insertId || id;

              actualizarListaProveedores(proveedorId); // ✅ esta función asegura limpiar duplicados
              modal.hide();
            })
            .catch(err => {
              console.error('Error al guardar:', err);
              Swal.fire('Error', 'No se pudo guardar el proveedor.', 'error');
            });
        }
      });
    });
  }

  if (btnEliminar) {
    btnEliminar.addEventListener('click', () => {
      const id = document.getElementById('proveedorId').value;
      if (confirm('¿Estás seguro que querés eliminar este proveedor?')) {
        fetch(`/administracion/api/proveedores/${id}`, {
          method: 'DELETE'
        })
          .then(res => res.json())
          .then(resp => {
            alert(resp.message);
            location.reload();
          })
          .catch(err => {
            console.error('Error al eliminar proveedor:', err);
            alert('Error al eliminar proveedor.');
          });
      }
    });
  }
});

// 🔁 Refrescar lista
function actualizarListaProveedores(selectedId = null) {
  const select = document.getElementById('selectProveedor');
  if (!select) return;

  fetch('/administracion/api/proveedores')
    .then(res => res.json())
    .then(proveedores => {
      console.group('🔁 Actualizando lista de proveedores');
      console.log('🧾 Proveedores:', proveedores);

      select.innerHTML = ''; // Limpia todos los options

      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Seleccionar proveedor...';
      select.appendChild(defaultOption);

      proveedores.forEach(prov => {
        const option = document.createElement('option');
        option.value = prov.id;
        option.textContent = prov.nombre;
        select.appendChild(option);
      });

      if (selectedId) {
        select.value = selectedId;
        select.dispatchEvent(new Event('change'));
      }

      console.groupEnd();
    })
    .catch(err => {
      console.error('❌ Error al obtener proveedores:', err);
    });
}
