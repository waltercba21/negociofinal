document.addEventListener('DOMContentLoaded', () => {
    const modal = new bootstrap.Modal(document.getElementById('modalProductosFactura'));
    const btnAbrirModal = document.getElementById('btnAgregarProductosFactura');
    const buscador = document.getElementById('buscadorProducto');
    const resultados = document.getElementById('resultadosBusqueda');
    const tabla = document.getElementById('tablaProductosFactura').querySelector('tbody');
    const btnGuardar = document.getElementById('btnGuardarProductosFactura');
  
    let productosSeleccionados = [];
  
    // Abrir el modal
    btnAbrirModal.addEventListener('click', () => {
      modal.show();
      buscador.value = '';
      resultados.innerHTML = '';
      tabla.innerHTML = '';
      productosSeleccionados = [];
    });
  
    // Buscar productos mientras escribe
    buscador.addEventListener('input', async () => {
      const query = buscador.value.trim();
      resultados.innerHTML = '';
  
      if (query.length < 2) return;
  
      try {
        const res = await fetch(`/productos/api/buscar?q=${encodeURIComponent(query)}`)
        if (!res.ok) throw new Error('Error al buscar productos');
        const productos = await res.json();
  
        productos.forEach(prod => {
          const item = document.createElement('div');
          item.className = 'resultado-busqueda';
          item.innerHTML = `
            <img src="/uploads/${prod.imagen || 'noimg.jpg'}" class="miniatura">
            <div class="resultado-contenedor">
              <strong>${prod.nombre}</strong> - ${prod.codigo_proveedor || '-'}
            </div>
          `;
          item.addEventListener('click', () => agregarProducto(prod));
          resultados.appendChild(item);
        });
      } catch (err) {
        console.error('❌ Error al buscar productos:', err);
      }
    });
  
    // Agregar producto a la tabla
    function agregarProducto(prod) {
      if (productosSeleccionados.some(p => p.id === prod.id)) return;
  
      productosSeleccionados.push({ id: prod.id, cantidad: 1 });
  
      const fila = document.createElement('tr');
      fila.dataset.id = prod.id;
      fila.innerHTML = `
        <td>${prod.codigo_proveedor || '-'}</td>
        <td>${prod.nombre}</td>
        <td><img src="/uploads/${prod.imagen || 'noimg.jpg'}" class="miniatura-tabla"></td>
        <td>
          <input type="number" class="form-control form-control-sm cantidad-input" value="1" min="1">
        </td>
        <td>
          <button class="btn btn-sm btn-danger boton-eliminar-factura">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
  
      // eliminar fila
      fila.querySelector('.boton-eliminar-factura').addEventListener('click', () => {
        productosSeleccionados = productosSeleccionados.filter(p => p.id !== prod.id);
        fila.remove();
      });
  
      // cambiar cantidad
      fila.querySelector('.cantidad-input').addEventListener('input', e => {
        const cantidad = parseInt(e.target.value);
        const prodSel = productosSeleccionados.find(p => p.id === prod.id);
        if (prodSel) prodSel.cantidad = isNaN(cantidad) ? 1 : cantidad;
      });
  
      tabla.appendChild(fila);
      resultados.innerHTML = '';
      buscador.value = '';
    }
  
    // Guardar productos (solo muestra la consola por ahora)
    btnGuardar.addEventListener('click', () => {
      if (!productosSeleccionados.length) {
        return Swal.fire('Atención', 'Debes seleccionar al menos un producto.', 'warning');
      }
  
      console.log("🧾 Productos a guardar:", productosSeleccionados);
  
      Swal.fire('Guardado', 'Productos listos para enviar.', 'success');
      modal.hide();
  
      // 🚧 Luego enviar productosSeleccionados al backend como parte del form de factura
    });
  });
  