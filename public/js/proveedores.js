document.addEventListener('DOMContentLoaded', () => {
  console.log('🟢 Script cargado');

  window.actualizarListaProveedores = async function () {
    const select = document.getElementById('selectProveedor');
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
      console.log('📡 Status:', res.status);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const proveedores = await res.json();
      console.log('📦 Datos:', proveedores);

      proveedores.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.nombre;
        select.appendChild(option);
      });

    } catch (err) {
      console.error('❌ Error al cargar proveedores:', err);
    }
  };
});
