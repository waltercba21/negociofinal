document.getElementById('entradaBusqueda').addEventListener('input', async (e) => {
  const busqueda = e.target.value;
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  resultadosBusqueda.innerHTML = '';
  if (!busqueda.trim()) {
    return;
  }
  let url = '/productos/api/buscarConCodigoPrecio?q=' + busqueda;
  const respuesta = await fetch(url);
  const productos = await respuesta.json();
  productos.forEach((producto) => {
    const resultado = document.createElement('div');
    resultado.textContent = producto.nombre; 
    resultado.classList.add('resultado-busqueda');
    resultado.addEventListener('click', () => {
      const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
      const filaFactura = tablaFactura.insertRow();
      const celdaCodigoFactura = filaFactura.insertCell(0);
      const celdaDescripcionFactura = filaFactura.insertCell(1);
      const celdaPrecioFactura = filaFactura.insertCell(2);
      const celdaCantidadFactura = filaFactura.insertCell(3);
      const celdaSubtotalFactura = filaFactura.insertCell(4); 
      celdaCodigoFactura.textContent = producto.codigo;
      celdaDescripcionFactura.textContent = producto.nombre; 
      celdaPrecioFactura.textContent = producto.precio_venta;
      celdaCantidadFactura.innerHTML = '<input type="number" min="1" value="1">';
      celdaSubtotalFactura.textContent = producto.precio_venta;
      resultadosBusqueda.innerHTML = ''; 
      calcularTotal();
      celdaCantidadFactura.firstChild.addEventListener('change', (e) => {
        const cantidad = e.target.value;
        celdaSubtotalFactura.textContent = cantidad * Number(producto.precio_venta);
        calcularTotal();
      });
      // Agregar las clases a las celdas
      celdaCodigoFactura.classList.add('codigo');
      celdaDescripcionFactura.classList.add('descripcion');
      celdaPrecioFactura.classList.add('precio');
      celdaCantidadFactura.classList.add('cantidad');
      celdaSubtotalFactura.classList.add('subtotal');
    });
    resultadosBusqueda.appendChild(resultado);
  });
});

function calcularTotal() {
  const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  let total = 0;
  for (let i = 0; i < filasFactura.length; i++) {
    const celdaSubtotal = filasFactura[i].cells[4];
    total += Number(celdaSubtotal.textContent);
  }
  document.getElementById('total-amount').value = total.toFixed(2); // Asegurarse de mostrar el total con dos decimales
}
document.getElementById('invoice-form').addEventListener('submit', async function(e) {
  e.preventDefault(); // Prevenir el envío por defecto del formulario
  
  const invoiceItems = [];
  const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  
  for (let i = 0; i < filasFactura.length; i++) {
      const codigo = filasFactura[i].cells[0].textContent.trim();
      const descripcion = filasFactura[i].cells[1].textContent.trim();
      const precio_unitario = parseFloat(filasFactura[i].cells[2].textContent.trim());
      const cantidad = parseInt(filasFactura[i].cells[3].querySelector('input').value.trim());
      const subtotal = parseFloat(filasFactura[i].cells[4].textContent.trim());
      
      invoiceItems.push({ producto_id: codigo, descripcion, precio_unitario, cantidad, subtotal });
  }
  
  document.getElementById('invoiceItems').value = JSON.stringify(invoiceItems);
  
  // Enviar los datos del formulario mediante fetch
  try {
      const response = await fetch('/productos/procesarFormulario', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              nombreCliente: document.getElementById('nombre-cliente').value.trim(),
              fechaPresupuesto: document.getElementById('fecha-presupuesto').value.trim(),
              totalPresupuesto: document.getElementById('total-amount').value.trim(),
              invoiceItems: JSON.stringify(invoiceItems)
          })
      });

      const data = await response.json();
      if (response.ok) {
          alert(data.message); // Mostrar mensaje de éxito
          // Limpiar todos los campos del formulario después de guardar
          document.getElementById('nombre-cliente').value = '';
          document.getElementById('fecha-presupuesto').value = '';
          document.getElementById('total-amount').value = '';
          document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].innerHTML = ''; // Limpiar filas de la tabla
      } else {
          throw new Error(data.error || 'Error al procesar el formulario');
      }
  } catch (error) {
      console.error('Error al enviar formulario:', error);
      // Manejar el error, mostrar mensaje al usuario, etc.
  }
});

// Dentro de la sección <script> del HTML

// Reemplaza la parte donde muestras el alert(data.message) con SweetAlert2
Swal.fire({
  icon: 'success',
  title: 'Presupuesto Guardado Correctamente',
  text: data.message
}).then((result) => {
  // Aquí puedes agregar lógica adicional después de que el usuario cierre la alerta
  // Por ejemplo, limpiar los campos del formulario, etc.
});
