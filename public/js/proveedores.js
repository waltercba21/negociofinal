document.addEventListener('DOMContentLoaded', () => {
  const selectProveedor = document.getElementById('selectProveedor');

  if (!selectProveedor) {
    console.warn("⚠️ No se encontró el select con id 'selectProveedor'");
    return;
  }

  // Función para obtener y cargar los proveedores
  async function cargarProveedores() {
    console.log("🔄 Solicitando proveedores desde /administracion/api/proveedores...");

    try {
      const response = await fetch('/administracion/api/proveedores');
      if (!response.ok) {
        throw new Error(`❌ Error HTTP ${response.status}`);
      }

      const proveedores = await response.json();
      console.log("✅ Proveedores recibidos:", proveedores);

      // Limpiar opciones actuales (excepto la primera)
      selectProveedor.querySelectorAll('option:not(:first-child)').forEach(opt => opt.remove());

      const idsAgregados = new Set();

      proveedores.forEach(prov => {
        if (!prov.id || idsAgregados.has(prov.id)) {
          console.warn(`⚠️ Proveedor duplicado o sin ID:`, prov);
          return;
        }

        const option = document.createElement('option');
        option.value = prov.id;
        option.textContent = prov.nombre;
        selectProveedor.appendChild(option);
        idsAgregados.add(prov.id);
      });

      console.log(`✅ ${idsAgregados.size} proveedores agregados al select.`);

    } catch (err) {
      console.error("❌ Error al cargar proveedores:", err);
    }
  }

  cargarProveedores(); 
});
