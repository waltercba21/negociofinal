document.addEventListener('DOMContentLoaded', () => {
  console.log('🟢 Se cargó el archivo proveedores.js');

  const modal = new bootstrap.Modal(document.getElementById('modalProveedor'));
  const form = document.getElementById('formProveedor');
  const select = document.getElementById('selectProveedor');
  const contenedor = document.getElementById('detalleProveedor');
  const btnNuevoProveedor = document.getElementById('btnNuevoProveedor');
  const btnEditarProveedor = document.getElementById('btnEditarProveedor');
  const btnEliminar = document.getElementById('btnEliminarProveedor');
  const btnEliminarDirecto = document.getElementById('btnEliminarProveedorDirecto');

  let proveedorSeleccionado = null;

  function actualizarListaProveedores(selectedId = null) {
    console.group('🔁 ACTUALIZAR LISTA DE PROVEEDORES');

    // Mostrar qué opciones hay antes de limpiar
    console.log('🧼 Opciones antes de limpiar:');
    [...select.options].forEach(opt => {
      console.log(`• ${opt.value} → ${opt.textContent}`);
    });

    // Limpiar el select excepto la opción por defecto
    select.querySelectorAll('option:not([value=""])').forEach(opt => opt.remove());

    fetch('/administracion/api/proveedores')
      .then(res => {
        console.log('📶 Fetch ejecutado, status:', res.status);
        if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
        return res.json();
      })
      .then(proveedores => {
        console.log('📦 Proveedores recibidos:', proveedores);

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

        console.log('✅ Opciones luego de actualizar:');
        [...select.options].forEach(opt => {
          console.log(`• ${opt.value} → ${opt.textContent}`);
        });

        if (selectedId) {
          select.value = String(selectedId);
          select.dispatchEvent(new Event('change'));
        }

        console.groupEnd();
      })
      .catch(err => {
        console.error('❌ Error al cargar proveedores:', err);
      });
  }

  // ✅ Ejecutar al cargar la página
  actualizarListaProveedores();

  // Resto de tu código para eventos (change, editar, eliminar...) lo podés mantener abajo como ya estaba
});
