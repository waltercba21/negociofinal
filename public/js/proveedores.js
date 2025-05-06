document.addEventListener('DOMContentLoaded', () => {
    const modal = new bootstrap.Modal(document.getElementById('modalProveedor'));
    const form = document.getElementById('formProveedor');
    const btnAgregar = document.getElementById('btnAgregarProveedor');
    const btnEliminar = document.getElementById('btnEliminarProveedor');
  
    // Abrir modal para agregar proveedor
    btnAgregar.addEventListener('click', () => {
      form.reset();
      document.getElementById('proveedorId').value = '';
      document.getElementById('modalProveedorLabel').textContent = 'Nuevo Proveedor';
      btnEliminar.style.display = 'none';
      modal.show();
    });
  
    // Abrir modal con datos al hacer clic en tarjeta
    document.querySelectorAll('.proveedor-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        fetch(`/api/proveedores/${id}`)
          .then(res => res.json())
          .then(proveedor => {
            document.getElementById('proveedorId').value = proveedor.id;
            form.nombre.value = proveedor.nombre || '';
            form.contacto.value = proveedor.contacto || '';
            form.telefono.value = proveedor.telefono || '';
            form.mail.value = proveedor.mail || '';
            form.direccion.value = proveedor.direccion || '';
            form.ciudad.value = proveedor.ciudad || '';
            form.provincia.value = proveedor.provincia || '';
            form.cuit.value = proveedor.cuit || '';
            form.banco.value = proveedor.banco || '';
            form.cbu.value = proveedor.cbu || '';
            form.alias.value = proveedor.alias || '';
  
            document.getElementById('modalProveedorLabel').textContent = 'Detalle del Proveedor';
            btnEliminar.style.display = 'inline-block';
            modal.show();
          })
          .catch(err => console.error('Error al obtener proveedor:', err));
      });
    });
  
    // Guardar proveedor (nuevo o editado)
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
  
    // Eliminar proveedor
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
  });
  