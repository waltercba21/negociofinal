document.getElementById('invoice-form').addEventListener('submit', async function(e) {
  e.preventDefault(); 
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
          alert(data.message); 
          document.getElementById('nombre-cliente').value = '';
          document.getElementById('fecha-presupuesto').value = '';
          document.getElementById('total-amount').value = '';
          document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].innerHTML = '';
          const successMessage = document.createElement('div');
          successMessage.classList.add('success-message');
          successMessage.textContent = 'Presupuesto guardado correctamente';
          document.body.appendChild(successMessage);
          setTimeout(() => {
              successMessage.style.display = 'none';
          }, 3000);
          window.location.reload();
      } else {
          throw new Error(data.error || 'Error al procesar el formulario');
      }
  } catch (error) {
      console.error('Error al enviar formulario:', error);
  }
});
document.getElementById('entradaBusqueda').addEventListener('input', async (e) => {
  const busqueda = e.target.value;
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  resultadosBusqueda.innerHTML = '';
  if (!busqueda.trim()) {
      return;
  }
  const url = '/productos/api/buscar?q=' + busqueda;
  const respuesta = await fetch(url);
  const productos = await respuesta.json();
  const formatter = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
  });
  productos.forEach((producto) => {
      const resultado = document.createElement('div');
      resultado.textContent = producto.nombre;
      resultado.classList.add('resultado-busqueda');
      resultado.addEventListener('click', () => {
          const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
          const filaFactura = tablaFactura.insertRow();

          filaFactura.insertCell(0).textContent = producto.codigo;
          filaFactura.insertCell(1).textContent = producto.nombre;
          const precioFormateado = producto.precio_venta.replace('.', '').replace(',', '.');
          filaFactura.insertCell(2).textContent = formatter.format(parseFloat(precioFormateado));

          const celdaCantidad = filaFactura.insertCell(3);
          const inputCantidad = document.createElement('input');
          inputCantidad.type = 'number';
          inputCantidad.min = 1;
          inputCantidad.value = 1;
          celdaCantidad.appendChild(inputCantidad);

          filaFactura.insertCell(4).textContent = formatter.format(parseFloat(precioFormateado));

          calcularTotal();

          inputCantidad.addEventListener('change', () => {
              const cantidad = parseInt(inputCantidad.value.trim());
              filaFactura.cells[4].textContent = formatter.format(cantidad * parseFloat(precioFormateado));
              calcularTotal();
          });

          resultadosBusqueda.innerHTML = '';
      });

      resultadosBusqueda.appendChild(resultado);
  });
});
function calcularTotal() {
  const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  let total = 0;

  for (let i = 0; i < filasFactura.length; i++) {
      // Extraer el contenido de texto de la celda del subtotal, eliminando el símbolo del dólar y los puntos
      let subtotalStr = filasFactura[i].cells[4].textContent.replace('$', '').replace(/\./g, '');
      // Convertir la cadena limpia a un número flotante (dividir por 100 si es necesario para manejar los centavos)
      let subtotalNum = parseFloat(subtotalStr);
      total += subtotalNum;
  }
  
  // Formatear el total para que se muestre como moneda nuevamente, antes de asignarlo al campo de total
  const formatter = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
  });

  document.getElementById('total-amount').value = formatter.format(total);
}



