document.addEventListener('DOMContentLoaded', () => {
    const modal = new bootstrap.Modal(document.getElementById('modalProductosFactura'));
    const btnAbrirModal = document.getElementById('btnAgregarProductosFactura');
    const buscador = document.getElementById('buscadorProducto');
    const resultados = document.getElementById('resultadosBusqueda');
    const tabla = document.getElementById('tablaProductosFactura').querySelector('tbody');
    const btnConfirmar = document.getElementById('btnConfirmarProductosFactura');
    const btnGuardarFactura = document.getElementById('btnGuardarFactura');

    let productosSeleccionados = [];

    // Cerrar con Escape
buscador.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    resultados.innerHTML = '';
    resultados.style.display = 'none';
  }
});
document.addEventListener('click', (e) => {
  const dentroDelBuscador = buscador.contains(e.target);
  const dentroDeResultados = resultados.contains(e.target);
  if (!dentroDelBuscador && !dentroDeResultados) {
    resultados.innerHTML = '';
    resultados.style.display = 'none';
  }
});
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

btnGuardarFactura.addEventListener('click', async () => {
  const administrador = document.getElementById('facturaAdministrador').value;
  const proveedor = document.getElementById('facturaProveedor').value;
  const fecha = document.getElementById('facturaFecha').value;
  const numero = document.getElementById('facturaNumero').value;
  const bruto = document.getElementById('facturaImporteBruto').value;
  const iva = document.getElementById('facturaIVA').value;
  const total = document.getElementById('facturaImporteTotal').value;
  const condicion = document.getElementById('facturaCondicion').value;
  const fecha_pago = document.getElementById('facturaFechaPago').value;
  const comprobante = document.getElementById('facturaComprobante').files[0];

  if (!proveedor || !fecha || !numero || !bruto || !iva || !total || !condicion || !fecha_pago || !administrador) {
    let mensaje = 'Los siguientes campos son obligatorios:\n';
    if (!proveedor) mensaje += '- Proveedor\n';
    if (!fecha) mensaje += '- Fecha de factura\n';
    if (!numero) mensaje += '- Número de factura\n';
    if (!bruto) mensaje += '- Importe bruto\n';
    if (!iva) mensaje += '- IVA\n';
    if (!total) mensaje += '- Importe total\n';
    if (!fecha_pago) mensaje += '- Fecha de vencimiento\n';
    if (!condicion) mensaje += '- Condición de pago\n';
    if (!administrador) mensaje += '- Administrador\n';

    return Swal.fire('Faltan datos', mensaje, 'warning');
  }

  // Si no hay productos, advertimos con SweetAlert
  if (!productosSeleccionados.length) {
    const confirmacion = await Swal.fire({
      title: 'Factura sin productos',
      text: 'Estás por guardar una factura sin productos asociados. ¿Deseás continuar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar de todos modos',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;
  }

  try {
    // 🔍 Verificar si ya existe una factura similar
    const verificar = await fetch('/administracion/api/documentos');
    const documentos = await verificar.json();

    const proveedorNombre = document.getElementById('facturaProveedor').selectedOptions[0].textContent.trim();

    const yaExiste = documentos.find(d =>
      d.tipo === 'factura' &&
      d.numero == numero &&
      d.fecha === fecha &&
      d.nombre_proveedor === proveedorNombre
    );

    if (yaExiste) {
      const confirmacion = await Swal.fire({
        title: 'Factura existente',
        text: 'Ya existe una factura con ese número, fecha y proveedor. ¿Deseás editarla o eliminarla?',
        icon: 'warning',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Editar',
        denyButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar'
      });

      if (confirmacion.isConfirmed) {
        return abrirModalEdicion(yaExiste.id);
      } else if (confirmacion.isDenied) {
        return confirmarEliminacionFactura(yaExiste.id);
      } else {
        return;
      }
    }

    // 🧾 Enviar nueva factura
    const formData = new FormData();
    formData.append('id_proveedor', proveedor);
    formData.append('fecha', fecha);
    formData.append('numero_factura', numero);
    formData.append('importe_bruto', bruto);
    formData.append('iva', iva);
    formData.append('importe_factura', total);
    formData.append('fecha_pago', fecha_pago);
    formData.append('condicion', condicion);
    formData.append('administrador', administrador);
    if (comprobante) {
      formData.append('comprobante_pago', comprobante);
    }

    const res = await fetch('/administracion/api/facturas', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Error al guardar factura:', errorText);
      throw new Error('Error al guardar la factura (backend)');
    }

    const respuesta = await res.json();

    if (!respuesta.insertId) {
      throw new Error('No se pudo crear la factura (sin insertId)');
    }

    // 💾 Guardar productos si hay
    if (productosSeleccionados.length > 0) {
      const productosRes = await fetch('/administracion/api/factura/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facturaId: respuesta.insertId,
          items: productosSeleccionados
        })
      });

      if (!productosRes.ok) {
        const errorText = await productosRes.text();
        throw new Error('Error al guardar productos: ' + errorText);
      }

      const productosResp = await productosRes.json();
      console.log('✅ Productos guardados:', productosResp);
    }

    Swal.fire('Éxito', 'Factura y productos guardados correctamente.', 'success');

    // 🔄 Limpiar formulario
    document.getElementById('facturaProveedor').value = '';
    document.getElementById('facturaFecha').value = '';
    document.getElementById('facturaNumero').value = '';
    document.getElementById('facturaImporteBruto').value = '';
    document.getElementById('facturaIVA').value = '';
    document.getElementById('facturaImporteTotal').value = '';
    document.getElementById('facturaFechaPago').value = '';
    document.getElementById('facturaCondicion').value = 'pendiente';
    document.getElementById('facturaComprobante').value = '';
    productosSeleccionados = [];
    tabla.innerHTML = '';

  } catch (err) {
    console.error('❌ Error general al guardar factura o productos:', err);
    Swal.fire('Error', err.message || 'Ocurrió un error al guardar.', 'error');
  }
});

async function abrirModalEdicion(id) {
  try {
    const res = await fetch(`/administracion/api/factura/${id}`);
    const factura = await res.json();

    // Aquí podés abrir un modal y precargar los valores.
    // Por ahora, solo mostramos los datos como prueba:
    Swal.fire({
      title: 'Editar factura',
      html: `
        <strong>Proveedor:</strong> ${factura.nombre_proveedor}<br>
        <strong>Fecha:</strong> ${factura.fecha}<br>
        <strong>Número:</strong> ${factura.numero_factura}<br>
        <strong>Condición:</strong> ${factura.condicion}
      `,
      confirmButtonText: 'Cerrar'
    });

    // Luego implementaremos el modal editable
  } catch (err) {
    console.error('❌ Error al obtener factura:', err);
    Swal.fire('Error', 'No se pudo cargar la factura para editar.', 'error');
  }
}

async function confirmarEliminacionFactura(id) {
  const confirmacion = await Swal.fire({
    title: '¿Eliminar factura?',
    text: 'Esta acción eliminará definitivamente la factura seleccionada.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmacion.isConfirmed) return;

  try {
    const res = await fetch(`/administracion/facturas/eliminar/${id}`, { method: 'POST' });
    if (res.ok) {
      Swal.fire('Eliminada', 'La factura fue eliminada correctamente.', 'success');
    } else {
      throw new Error('Error en la respuesta del servidor');
    }
  } catch (err) {
    console.error('❌ Error al eliminar factura:', err);
    Swal.fire('Error', 'No se pudo eliminar la factura.', 'error');
  }
}
})