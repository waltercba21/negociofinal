document.addEventListener('DOMContentLoaded', () => {
  const checkAll = document.getElementById('check-all');
  const checkboxes = document.querySelectorAll('.product-check');
  const deleteSelectedBtn = document.getElementById('delete-selected');

  // ✅ Seleccionar todos
  if (checkAll) {
    checkAll.addEventListener('change', () => {
      checkboxes.forEach(cb => cb.checked = checkAll.checked);
    });
  }

  // ✅ Botón para eliminar seleccionados
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', async () => {
      const seleccionados = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      if (seleccionados.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Sin productos seleccionados',
          text: 'Seleccioná al menos un producto para eliminar.'
        });
        return;
      }

      const confirmacion = await Swal.fire({
        title: '¿Estás seguro?',
        text: `Vas a eliminar ${seleccionados.length} producto(s). Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });

      if (confirmacion.isConfirmed) {
        try {
          const response = await fetch('/productos/eliminar-multiples', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ productos: seleccionados })
          });

          const data = await response.json();

          if (data.success) {
            Swal.fire({
              icon: 'success',
              title: 'Productos eliminados',
              text: `${seleccionados.length} producto(s) eliminados correctamente`
            }).then(() => {
              window.location.reload(); // ✅ Recarga la tabla desde el servidor (con EJS)
            });
          } else {
            throw new Error(data.message || 'Ocurrió un error al eliminar los productos.');
          }

        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message
          });
        }
      }
    });
  }
});
