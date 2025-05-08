document.addEventListener('DOMContentLoaded', () => {
    const modal = new bootstrap.Modal(document.getElementById('modalProductosFactura'));
    const btnAbrirModal = document.getElementById('btnAgregarProductosFactura');
    const buscador = document.getElementById('buscadorProducto');
    const resultados = document.getElementById('resultadosBusqueda');
    const tabla = document.getElementById('tablaProductosFactura').querySelector('tbody');
    const btnConfirmar = document.getElementById('btnConfirmarProductosFactura');
    const btnGuardarFactura = document.getElementById('btnGuardarFactura');
  
    let productosSeleccionados = [];
  
    btnAbrirModal.addEventListener('click', () => {
      modal.show();
      buscador.value = '';
      resultados.innerHTML = '';
      tabla.innerHTML = '';
      renderizarTabla();
    });
  
    buscador.addEventListener('input', async () => {
      const query = buscador.value.trim();
      resultados.innerHTML = '';
  
      if (query.length < 2) return;
  
      try {
        const res = await fetch(`/productos/api/buscar?q=${encodeURIComponent(query)}`);
        const productos = await res.json();
  
        productos.forEach(producto => {
          const resultado = document.createElement('div');
          resultado.classList.add('resultado-busqueda');
  
          const contenedor = document.createElement('div');
          contenedor.classList.add('resultado-contenedor');
  
          if (producto.imagenes && producto.imagenes.length > 0) {
            const imagen = document.createElement('img');
            imagen.src = '/uploads/productos/' + producto.imagenes[0].imagen;
            imagen.classList.add('miniatura');
            contenedor.appendChild(imagen);
          }
  
          const nombreProducto = document.createElement('span');
          nombreProducto.textContent = producto.nombre;
          contenedor.appendChild(nombreProducto);
  
          resultado.appendChild(contenedor);
  
          resultado.addEventListener('click', () => agregarProducto(producto));
  
          resultados.appendChild(resultado);
          resultados.style.display = 'block';
        });
      } catch (err) {
        console.error('❌ Error al buscar productos:', err);
      }
    });
  
    function agregarProducto(prod) {
        if (productosSeleccionados.some(p => p.id === prod.id)) return;
      
        productosSeleccionados.push({
          id: prod.id,
          nombre: prod.nombre,
          proveedores: prod.proveedores || [],
          imagenes: prod.imagenes || [],
          cantidad: 1
        });
      
        renderizarTabla();
        resultados.innerHTML = '';
        buscador.value = '';
      }
      
  
    function renderizarTabla() {
      tabla.innerHTML = '';
      productosSeleccionados.forEach(prod => {
        const fila = document.createElement('tr');
        fila.dataset.id = prod.id;
  
        const codigoProveedor = (prod.proveedores && prod.proveedores[0]?.codigo) || '-';
const imagenSrc = (prod.imagenes?.[0]?.imagen)
  ? '/uploads/productos/' + prod.imagenes[0].imagen
  : '/uploads/noimg.jpg';

  
        fila.innerHTML = `
          <td>${codigoProveedor}</td>
          <td>${prod.nombre}</td>
          <td><img src="${imagenSrc}" class="miniatura-tabla"></td>
          <td>
            <input type="number" class="form-control form-control-sm cantidad-input" value="${prod.cantidad}" min="1">
          </td>
          <td>
            <button class="btn btn-sm btn-danger boton-eliminar-factura">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        `;
  
        fila.querySelector('.cantidad-input').addEventListener('input', (e) => {
          const cantidad = parseInt(e.target.value);
          const item = productosSeleccionados.find(p => p.id === prod.id);
          item.cantidad = isNaN(cantidad) ? 1 : cantidad;
        });
  
        fila.querySelector('.boton-eliminar-factura').addEventListener('click', () => {
          productosSeleccionados = productosSeleccionados.filter(p => p.id !== prod.id);
          renderizarTabla();
        });
  
        tabla.appendChild(fila);
      });
    }
  
    // Confirmar productos (guardar temporalmente)
    btnConfirmar.addEventListener('click', () => {
      if (!productosSeleccionados.length) {
        return Swal.fire('Atención', 'Debes agregar al menos un producto.', 'warning');
      }
  
      modal.hide();
      Swal.fire('Confirmado', 'Productos listos para guardar con la factura.', 'success');
    });
  
    // Guardar la factura y luego los productos
    btnGuardarFactura.addEventListener('click', async () => {
      const proveedor = document.getElementById('facturaProveedor').value;
      const fecha = document.getElementById('facturaFecha').value;
      const numero = document.getElementById('facturaNumero').value;
      const bruto = document.getElementById('facturaImporteBruto').value;
      const iva = document.getElementById('facturaIVA').value;
      const total = document.getElementById('facturaImporteTotal').value;
  
      if (!proveedor || !fecha || !numero || !bruto || !iva || !total) {
        return Swal.fire('Faltan datos', 'Completá todos los campos de la factura.', 'warning');
      }
  
      if (!productosSeleccionados.length) {
        return Swal.fire('Faltan productos', 'Debe confirmar al menos un producto.', 'warning');
      }
  
      try {
        // 1. Guardar la factura
        const res = await fetch('/administracion/api/facturas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_proveedor: proveedor,
            fecha,
            numero_factura: numero,
            importe_bruto: bruto,
            iva,
            importe_factura: total,
            condicion: 'pendiente'
          })
        });
  
        const respuesta = await res.json();
  
        if (!respuesta.insertId) throw new Error('No se pudo crear factura');
  
        // 2. Enviar productos
        await fetch('/administracion/api/factura/productos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facturaId: respuesta.insertId,
            items: productosSeleccionados
          })
        });
  
        Swal.fire('Éxito', 'Factura y productos guardados correctamente.', 'success');
      } catch (err) {
        console.error('❌ Error al guardar factura o productos:', err);
        Swal.fire('Error', 'Ocurrió un error al guardar.', 'error');
      }
    });
  });
  