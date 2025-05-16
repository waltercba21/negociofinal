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

    console.log('📤 Enviando datos de factura con archivo:', Object.fromEntries(formData.entries()));

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
    console.log('📥 Respuesta del backend (factura):', respuesta);

    if (!respuesta.insertId) {
      console.error('⚠️ No se devolvió insertId');
      throw new Error('No se pudo crear la factura');
    }

    // Enviar los productos
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
      console.error('❌ Error al guardar productos:', errorText);
      throw new Error('Error al guardar productos');
    }

    const productosResp = await productosRes.json();
    console.log('✅ Productos guardados:', productosResp);

    Swal.fire('Éxito', 'Factura y productos guardados correctamente.', 'success');

    // Limpiar formulario (opcional)
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
const inputFechaFactura = document.getElementById('facturaFecha');
const inputFechaPago = document.getElementById('facturaFechaPago');

inputFechaFactura.addEventListener('change', () => {
  const valorFecha = inputFechaFactura.value;
  if (!valorFecha) return;

  const fecha = new Date(valorFecha);
  fecha.setDate(fecha.getDate() + 30);

  const fecha30dias = fecha.toISOString().split('T')[0];
  inputFechaPago.value = fecha30dias;
  });

  document.getElementById('facturaNumero').addEventListener('blur', async () => {
  const tipo = 'factura';
  const proveedor = document.getElementById('facturaProveedor').value;
  const fecha = document.getElementById('facturaFecha').value;
  const numero = document.getElementById('facturaNumero').value;


  if (!proveedor || !fecha || !numero) return;

  try {
    const res = await fetch(`/administracion/verificar-duplicado?tipo=${tipo}&proveedor=${proveedor}&fecha=${fecha}&numero=${numero}`);
    const data = await res.json();

    if (data.existe) {
      Swal.fire({
        icon: 'warning',
        title: 'Documento duplicado',
        text: `Ya existe una ${tipo} con esos datos.`,
        confirmButtonText: 'Revisar',
      });
    }
  } catch (err) {
    console.error('Error al verificar duplicado:', err);
  }
});
const inputTotal = document.getElementById('facturaImporteTotal');
const inputIVA = document.getElementById('facturaIVA');
const inputBruto = document.getElementById('facturaImporteBruto');

// Cada vez que cambie el total o el IVA, recalcula el bruto
function recalcularBrutoDesdeTotal() {
  const total = parseFloat(inputTotal.value);
  const iva = parseFloat(inputIVA.value);

  if (isNaN(total) || isNaN(iva)) return;

  const bruto = total / (1 + (iva / 100));
  inputBruto.value = bruto.toFixed(2);
}

// Recalcular cuando cambia el IVA o el total
inputTotal.addEventListener('input', recalcularBrutoDesdeTotal);
inputIVA.addEventListener('change', recalcularBrutoDesdeTotal);

const btnGuardarCambios = document.getElementById('btnGuardarCambiosDocumento');

btnGuardarCambios.addEventListener('click', async () => {
  const formulario = document.querySelector('#formDetalleDocumento');
  const tipo = btnGuardarCambios.dataset.tipo;
  const id = btnGuardarCambios.dataset.id;

  if (tipo !== 'factura') return; // Solo aplica para facturas por ahora

  const datos = {
    numero_factura: formulario.numero.value,
    fecha: formulario.fecha.value,
    fecha_pago: formulario.fecha_pago.value,
    importe_bruto: formulario.importe_bruto.value,
    iva: formulario.iva.value,
    importe_factura: formulario.importe_factura.value,
    condicion: formulario.condicion.value,
    administrador: formulario.administrador.value,
    comprobante_pago: null // o cargarlo si lo agregás como archivo editable
  };

  try {
    const res = await fetch(`/administracion/api/factura/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });

    if (!res.ok) throw new Error('No se pudo actualizar la factura');

    Swal.fire('Guardado', 'Factura actualizada correctamente', 'success');
  } catch (err) {
    console.error('❌ Error al actualizar factura:', err);
    Swal.fire('Error', err.message || 'Error al guardar', 'error');
  }
});

});

 