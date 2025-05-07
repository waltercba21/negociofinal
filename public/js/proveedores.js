document.addEventListener('DOMContentLoaded', () => {
    const modal = new bootstrap.Modal(document.getElementById('modalProveedor'));
    const form = document.getElementById('formProveedor');
    const btnAgregar = document.getElementById('btnAgregarProveedor'); // botón dentro del modal
    const btnEliminar = document.getElementById('btnEliminarProveedor'); // botón dentro del modal
  
    const select = document.getElementById('selectProveedor');
    const contenedor = document.getElementById('detalleProveedor');
  
    const btnNuevoProveedor = document.getElementById('btnNuevoProveedor'); // externo
    const btnEditarProveedor = document.getElementById('btnEditarProveedor'); // externo
    const btnEliminarDirecto = document.getElementById('btnEliminarProveedorDirecto'); // externo
  
    let proveedorSeleccionado = null;
  
    // ✅ Mostrar datos del proveedor seleccionado
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
  
    // ➕ Botón NUEVO
    if (btnNuevoProveedor) {
      btnNuevoProveedor.addEventListener('click', () => {
        form.reset();
        document.getElementById('proveedorId').value = '';
        document.getElementById('modalProveedorLabel').textContent = 'Nuevo Proveedor';
        btnEliminar.style.display = 'none';
        modal.show();
      });
    }
  
    // ✏️ Botón EDITAR
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
  
    // 🗑️ Botón ELIMINAR DIRECTO
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
  
    // ✅ Guardar proveedor desde el modal (crear o editar)
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
              Swal.fire('Cambios guardados', resp.message, 'success').then(() => {
                const proveedorId = resp.insertId || document.getElementById('proveedorId').value;
            
                // ✅ Regeneramos todo el listado limpio
                actualizarListaProveedores(proveedorId);
            
                // ✅ Cerramos el modal
                modal.hide();
              });
            })
            
            .catch(err => {
              console.error('Error al guardar:', err);
              Swal.fire('Error', 'No se pudo guardar el proveedor.', 'error');
            });
            
            
          }
        });
      });
      
    }
  
    // ❌ Eliminar proveedor desde botón del modal
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
  function actualizarListaProveedores(selectedId = null) {
    const select = document.getElementById('selectProveedor');
  
    if (!select) {
      console.warn('❌ No se encontró el select de proveedores.');
      return;
    }
  
    fetch('/administracion/api/proveedores')
      .then(res => res.json())
      .then(proveedores => {
        console.group('🧾 Refrescando lista de proveedores...');
        console.log('Proveedores recibidos:', proveedores);
  
        // Limpieza completa del select
        while (select.options.length > 0) {
          select.remove(0);
        }
  
        // Opción por defecto
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Seleccionar proveedor...';
        select.appendChild(defaultOption);
  
        const idsAgregados = new Set();
  
        proveedores.forEach(prov => {
          if (!idsAgregados.has(prov.id)) {
            const option = document.createElement('option');
            option.value = prov.id;
            option.textContent = prov.nombre;
            select.appendChild(option);
            idsAgregados.add(prov.id);
          } else {
            console.warn(`⚠️ Proveedor duplicado detectado y evitado: ${prov.id} - ${prov.nombre}`);
          }
        });
  
        // Reasignar proveedor seleccionado
        if (selectedId) {
          select.value = selectedId;
          select.dispatchEvent(new Event('change'));
        }
  
        console.groupEnd();
      })
      .catch(err => {
        console.error('❌ Error al actualizar lista de proveedores:', err);
      });
  }
  