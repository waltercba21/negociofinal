document.addEventListener('DOMContentLoaded', () => {
  console.log('🟢 Archivo proveedores.js cargado');

  const modal = new bootstrap.Modal(document.getElementById('modalProveedor'));
  const form = document.getElementById('formProveedor');
  const select = document.getElementById('selectProveedor');
  const contenedor = document.getElementById('detalleProveedor');
  const btnNuevoProveedor = document.getElementById('btnNuevoProveedor');
  const btnEditarProveedor = document.getElementById('btnEditarProveedor');
  const btnEliminar = document.getElementById('btnEliminarProveedor');
  const btnEliminarDirecto = document.getElementById('btnEliminarProveedorDirecto');

  let proveedorSeleccionado = null;

  async function actualizarListaProveedores(selectedId = null) {
    console.group('🔁 ACTUALIZANDO SELECT DE PROVEEDORES');
  
    // Mostrar antes
    console.log('🧼 Opciones actuales:');
    [...select.options].forEach(opt => {
      console.log(`• ${opt.value} → ${opt.textContent}`);
    });
  
    // Limpiar todo el select
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  
    try {
      const res = await fetch('/administracion/api/proveedores');
      console.log('📶 Fetch ejecutado con status:', res.status);
      if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  
      const proveedores = await res.json();
      console.log('📦 Proveedores recibidos:', proveedores);
  
      // Agregar opción por defecto
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Seleccionar proveedor...';
      select.appendChild(defaultOption);
  
      const idsAgregados = new Set();
  
      proveedores.forEach(prov => {
        const idStr = String(prov.id);
  
        if (idsAgregados.has(idStr)) {
          console.warn(`⚠️ Duplicado ignorado: ${idStr} - ${prov.nombre}`);
          return;
        }
  
        const option = document.createElement('option');
        option.value = idStr;
        option.textContent = prov.nombre;
        select.appendChild(option);
        idsAgregados.add(idStr);
      });
  
      console.log('✅ Opciones finales en el <select>:');
      [...select.options].forEach(opt => {
        console.log(`• ${opt.value} → ${opt.textContent}`);
      });
  
      if (selectedId) {
        select.value = String(selectedId);
        select.dispatchEvent(new Event('change'));
      }
  
    } catch (err) {
      console.error('❌ Error al recuperar proveedores:', err);
    }
  
    console.groupEnd();
  }
  

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
          console.log('📄 Detalle del proveedor seleccionado:', proveedor);

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
          console.error('❌ Error al obtener proveedor:', err);
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
      form.banco.value = proveedorSeleccionado.banco || '';
      form.cbu.value = proveedorSeleccionado.cbu || '';
      form.alias.value = proveedorSeleccionado.alias || '';
      form.descuento.value = proveedorSeleccionado.descuento ?? '';

      document.getElementById('modalProveedorLabel').textContent = 'Editar Proveedor';
      btnEliminar.style.display = 'inline-block';
      modal.show();
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('🟨 Se envió el formulario de proveedor');
  
      const id = document.getElementById('proveedorId').value;
      const data = Object.fromEntries(new FormData(form).entries());
      console.log('📤 Datos del formulario:', data);
  
      Swal.fire({
        title: 'Confirmar acción',
        text: id
          ? `¿Guardar cambios para "${form.nombre.value}"?`
          : `¿Crear nuevo proveedor "${form.nombre.value}"?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (!result.isConfirmed) {
          console.log('❌ Usuario canceló la acción');
          return;
        }
  
        const url = id
          ? `/administracion/api/proveedores/${id}`
          : '/administracion/api/proveedores';
        const method = id ? 'PUT' : 'POST';
  
        console.log(`🔁 Enviando ${method} a ${url}`);
  
        fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
          .then(res => {
            console.log('📬 Respuesta recibida con status:', res.status);
            return res.json();
          })
          .then(resp => {
            console.log('🟢 Proveedor guardado:', resp);
            const proveedorId = resp.insertId || id;
  
            // ⚠️ Si esto no se ve en consola, no se ejecuta correctamente
            console.log('📌 Ejecutando actualizarListaProveedores con ID:', proveedorId);
            actualizarListaProveedores(proveedorId);
  
            modal.hide();
          })
          .catch(err => {
            console.error('❌ Error al guardar proveedor:', err);
            Swal.fire('Error', 'No se pudo guardar el proveedor.', 'error');
          });
      });
    });
  }
  
  if (btnEliminarDirecto) {
    btnEliminarDirecto.addEventListener('click', () => {
      if (!proveedorSeleccionado) return;

      Swal.fire({
        title: '¿Eliminar proveedor?',
        text: 'Esta acción eliminará también el descuento asociado.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (!result.isConfirmed) return;

        fetch(`/administracion/api/proveedores/${proveedorSeleccionado.id}`, {
          method: 'DELETE'
        })
          .then(res => res.json())
          .then(resp => {
            console.log('🗑️ Proveedor eliminado:', resp);
            actualizarListaProveedores();
            contenedor.innerHTML = '<p class="text-muted">Seleccioná un proveedor para ver sus datos.</p>';
          })
          .catch(err => {
            console.error('❌ Error al eliminar proveedor:', err);
            Swal.fire('Error', 'No se pudo eliminar el proveedor.', 'error');
          });
      });
    });
  }

});
