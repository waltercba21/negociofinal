document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('selectProveedor');
  const form = document.getElementById('formProveedor');
  const modal = new bootstrap.Modal(document.getElementById('modalProveedor'));
  const btnEditarProveedor = document.getElementById('btnEditarProveedor');
  const btnEliminar = document.getElementById('btnEliminarProveedor');
  const btnEliminarDirecto = document.getElementById('btnEliminarDirecto');
  const btnNuevoProveedor = document.getElementById('btnNuevoProveedor');
  const contenedor = document.getElementById('detalleProveedor');
  let proveedorSeleccionado = null;

  function actualizarListaProveedores(selectedId = null) {
    console.clear();
    console.group('🔁 Actualizando lista de proveedores');

    fetch('/administracion/api/proveedores')
      .then(res => {
        if (!res.ok) throw new Error("❌ Respuesta no válida del servidor");
        return res.json();
      })
      .then(proveedores => {
        console.log('📦 Proveedores recibidos:', proveedores);

        // Limpiar el select antes de insertar
        select.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Seleccionar proveedor.';
        select.appendChild(defaultOption);

        const idsUnicos = new Set();

        proveedores.forEach(prov => {
          if (!idsUnicos.has(prov.id)) {
            const option = document.createElement('option');
            option.value = prov.id;
            option.textContent = prov.nombre;
            select.appendChild(option);
            idsUnicos.add(prov.id);
          } else {
            console.warn(`⚠️ Proveedor duplicado ignorado: ID=${prov.id}, Nombre=${prov.nombre}`);
          }
        });

        console.log('📌 Options finales renderizados:', Array.from(select.options).map(opt => `${opt.value} - ${opt.textContent}`));

        if (selectedId) {
          select.value = selectedId;
          select.dispatchEvent(new Event('change'));
        }

        console.groupEnd();
      })
      .catch(err => {
        console.error('❌ Error al cargar proveedores:', err);
      });
  }

  if (select) {
    actualizarListaProveedores(); // Carga inicial

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
          console.log('📄 Detalle proveedor seleccionado:', proveedor);
          renderDetalle(proveedor);
          btnEditarProveedor.disabled = false;
          btnEliminarDirecto.disabled = false;
        })
        .catch(err => {
          console.error('❌ Error al obtener proveedor por ID:', err);
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
      form.proveedorId.value = proveedorSeleccionado.id;
      form.nombre.value = proveedorSeleccionado.nombre || '';
      form.contacto.value = proveedorSeleccionado.contacto || '';
      form.telefono.value = proveedorSeleccionado.telefono || '';
      form.mail.value = proveedorSeleccionado.mail || '';
      form.direccion.value = proveedorSeleccionado.direccion || '';
      form.ciudad.value = proveedorSeleccionado.ciudad || '';
      form.provincia.value = proveedorSeleccionado.provincia || '';
      form.cuit.value = proveedorSeleccionado.cuit || '';
      document.getElementById('modalProveedorLabel').textContent = 'Editar Proveedor';
      btnEliminar.style.display = 'inline-block';
      modal.show();
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('proveedorId').value;
      const data = Object.fromEntries(new FormData(form).entries());

      const confirmText = id
        ? `¿Querés guardar los cambios para "${form.nombre.value}"?`
        : `¿Crear nuevo proveedor "${form.nombre.value}"?`;

      Swal.fire({
        title: 'Confirmar',
        text: confirmText,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí',
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
              console.log('🟢 Proveedor guardado:', resp);
              const proveedorId = resp.insertId || id;
              actualizarListaProveedores(proveedorId);
              modal.hide();
            })
            .catch(err => {
              console.error('❌ Error al guardar proveedor:', err);
              Swal.fire('Error', 'No se pudo guardar el proveedor.', 'error');
            });
        }
      });
    });
  }

  if (btnEliminar) {
    btnEliminar.addEventListener('click', () => {
      const id = document.getElementById('proveedorId').value;
      if (!id) return;

      Swal.fire({
        title: '¿Eliminar proveedor?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (result.isConfirmed) {
          fetch(`/administracion/api/proveedores/${id}`, {
            method: 'DELETE'
          })
            .then(res => res.json())
            .then(resp => {
              console.log('🗑️ Proveedor eliminado:', resp);
              actualizarListaProveedores();
              modal.hide();
            })
            .catch(err => {
              console.error('❌ Error al eliminar proveedor:', err);
              Swal.fire('Error', 'No se pudo eliminar el proveedor.', 'error');
            });
        }
      });
    });
  }
});
