document.addEventListener('DOMContentLoaded', () => {
  const modal = new bootstrap.Modal(document.getElementById('modalProductosPresupuesto'));
  const btnAbrirModal = document.getElementById('btnAgregarProductosPresupuesto');
  const buscador = document.getElementById('buscadorProductoPresupuesto');
  const resultados = document.getElementById('resultadosBusquedaPresupuesto');
  const tabla = document.getElementById('tablaProductosPresupuesto').querySelector('tbody');
  const btnConfirmar = document.getElementById('btnConfirmarProductosPresupuesto');
  const btnGuardarPresupuesto = document.getElementById('btnGuardarPresupuesto');

  let productosSeleccionados = [];

  // Ocultar resultados al salir
  buscador.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      resultados.innerHTML = '';
      resultados.style.display = 'none';
    }
  });

  document.addEventListener('click', (e) => {
    if (!buscador.contains(e.target) && !resultados.contains(e.target)) {
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

  btnConfirmar.addEventListener('click', () => {
    if (!productosSeleccionados.length) {
      return Swal.fire('Atención', 'Debes agregar al menos un producto.', 'warning');
    }

    modal.hide();
    Swal.fire('Confirmado', 'Productos listos para guardar.', 'success');
  });

  btnGuardarPresupuesto.addEventListener('click', async () => {
    const proveedor = document.getElementById('presupuestoProveedor').value;
    const fecha = document.getElementById('presupuestoFecha').value;
    const numero = document.getElementById('presupuestoNumero').value;
    const importe = document.getElementById('presupuestoImporte').value;
    const condicion = document.getElementById('presupuestoCondicion').value;
    const fecha_pago = document.getElementById('presupuestoFechaPago').value;
    const administrador = document.getElementById('presupuestoAdministrador').value;


    if (!proveedor || !fecha || !numero || !importe || !condicion || !fecha_pago || !administrador) {
  let mensaje = 'Los siguientes campos son obligatorios:\n';
  if (!proveedor) mensaje += '- Proveedor\n';
  if (!fecha) mensaje += '- Fecha del presupuesto\n';
  if (!numero) mensaje += '- Número\n';
  if (!importe) mensaje += '- Importe\n';
  if (!fecha_pago) mensaje += '- Fecha de vencimiento\n';
  if (!condicion) mensaje += '- Condición de pago\n';
  if (!administrador) mensaje += '- Administrador\n';

  return Swal.fire('Faltan datos', mensaje, 'warning');
}
    if (!productosSeleccionados.length) {
  const confirmacion = await Swal.fire({
    title: 'Presupuesto sin productos',
    text: 'Estás por guardar un presupuesto sin productos asociados. ¿Deseás continuar?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, guardar de todos modos',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmacion.isConfirmed) return;
}


    try {
      const res = await fetch('/administracion/api/presupuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_proveedor: proveedor,
          fecha,
          numero_presupuesto: numero,
          importe,
          condicion,
          fecha_pago,
          administrador
        })
      });

      const respuesta = await res.json();
      if (!respuesta.insertId) throw new Error('No se pudo crear el presupuesto');

      const productosRes = await fetch('/administracion/api/presupuestos/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presupuestoId: respuesta.insertId,
          items: productosSeleccionados
        })
      });

      const productosResp = await productosRes.json();
      console.log('✅ Productos guardados:', productosResp);

      Swal.fire('Éxito', 'Presupuesto y productos guardados correctamente.', 'success');

      // Limpiar formulario
      document.getElementById('presupuestoProveedor').value = '';
      document.getElementById('presupuestoFecha').value = '';
      document.getElementById('presupuestoNumero').value = '';
      document.getElementById('presupuestoImporte').value = '';
      document.getElementById('presupuestoFechaPago').value = '';
      document.getElementById('presupuestoCondicion').value = 'pendiente';
      productosSeleccionados = [];
      tabla.innerHTML = '';

    } catch (err) {
      console.error('❌ Error general al guardar presupuesto o productos:', err);
      Swal.fire('Error', err.message || 'Ocurrió un error al guardar.', 'error');
    }
  });

  // Cálculo automático de fecha de pago
  const inputFechaPresupuesto = document.getElementById('presupuestoFecha');
  const inputFechaPago = document.getElementById('presupuestoFechaPago');

  inputFechaPresupuesto.addEventListener('change', () => {
    const valorFecha = inputFechaPresupuesto.value;
    if (!valorFecha) return;

    const fecha = new Date(valorFecha);
    fecha.setDate(fecha.getDate() + 30);
    inputFechaPago.value = fecha.toISOString().split('T')[0];
  });
  document.getElementById('presupuestoNumero').addEventListener('blur', async () => {
  const tipo = 'presupuesto';
  const proveedor = document.getElementById('presupuestoProveedor').value;
  const fecha = document.getElementById('presupuestoFecha').value;
  const numero = document.getElementById('presupuestoNumero').value;


  if (!proveedor || !fecha || !numero) return;

  try {
  const res = await fetch(`/administracion/verificar-duplicado?tipo=${tipo}&proveedor=${proveedor}&fecha=${fecha}&numero=${encodeURIComponent(numero)}`);

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
});

