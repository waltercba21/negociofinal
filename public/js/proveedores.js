document.addEventListener('DOMContentLoaded', () => {
    const modal = new bootstrap.Modal(document.getElementById('modalProveedor'));
    const form = document.getElementById('formProveedor');
    const btnAgregar = document.getElementById('btnAgregarProveedor');
    const btnEliminar = document.getElementById('btnEliminarProveedor');
    const select = document.getElementById('selectProveedor');
    const contenedor = document.getElementById('detalleProveedor');
  
    // ✅ Mostrar datos del proveedor seleccionado
    if (select) {
      select.addEventListener('change', () => {
        const id = select.value;
  
        if (!id) {
          contenedor.innerHTML = '<p class="text-muted">Seleccioná un proveedor para ver sus datos.</p>';
          return;
        }
  
        fetch(`/api/proveedores/${id}`)
          .then(res => res.json())
          .then(proveedor => {
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
            `;
          })
          .catch(err => {
            console.error(err);
            contenedor.innerHTML = '<p class="text-danger">Error al cargar los datos del proveedor.</p>';
          });
      });
    }
  
    // ➕ Guardar proveedor
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const id = document.getElementById('proveedorId').value;
        const data = Object.fromEntries(new FormData(form).entries());
  
        fetch(id ? `/api/proveedores/${id}` : '/api/proveedores', {
          method: id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(resp => {
          alert(resp.message);
          location.reload();
        })
        .catch(err => {
          console.error('Error al guardar:', err);
          alert('Error al guardar proveedor.');
        });
      });
    }
  
    // 🗑️ Eliminar proveedor
    if (btnEliminar) {
      btnEliminar.addEventListener('click', () => {
        const id = document.getElementById('proveedorId').value;
        if (confirm('¿Estás seguro que querés eliminar este proveedor?')) {
          fetch(`/api/proveedores/${id}`, {
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
  