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
  console.log("Busqueda:", busqueda);  // Log the search term
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  resultadosBusqueda.innerHTML = '';

  if (!busqueda.trim()) {
      return;
  }
  const url = '/productos/api/buscar?q=' + busqueda;
  const respuesta = await fetch(url);
  const productos = await respuesta.json();
  console.log("Productos encontrados:", productos);  // Log fetched products

  productos.forEach((producto) => {
      const resultado = document.createElement('div');
      resultado.textContent = producto.nombre;
      resultado.classList.add('resultado-busqueda');
      resultado.addEventListener('click', () => {
          const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
          const filaFactura = tablaFactura.insertRow();

          filaFactura.insertCell(0).textContent = producto.codigo;
          filaFactura.insertCell(1).textContent = producto.nombre;
          
          // Añadir input editable para el precio
          const cellPrecio = filaFactura.insertCell(2);
          const inputPrecio = document.createElement('input');
          inputPrecio.type = 'text';
          inputPrecio.value = producto.precio_venta;
          inputPrecio.className = 'precio-editable';
          cellPrecio.appendChild(inputPrecio);

          const cellCantidad = filaFactura.insertCell(3);
          const inputCantidad = document.createElement('input');
          inputCantidad.type = 'number';
          inputCantidad.min = 1;
          inputCantidad.value = 1;
          cellCantidad.appendChild(inputCantidad);

          // Subtotal initially set to the product price
          const cellSubtotal = filaFactura.insertCell(4);
          cellSubtotal.textContent = producto.precio_venta;

          // Event listeners to update subtotal on change
          inputPrecio.addEventListener('input', function() {
              updateSubtotal(filaFactura);
          });
          inputCantidad.addEventListener('input', function() {
              updateSubtotal(filaFactura);
          });

          calcularTotal();
      });

      resultadosBusqueda.appendChild(resultado);
  });
});

function updateSubtotal(row) {
  const precio = parseFloat(row.cells[2].querySelector('input').value);
  const cantidad = parseFloat(row.cells[3].querySelector('input').value);
  const subtotal = precio * cantidad;
  row.cells[4].textContent = subtotal.toFixed(2);
  calcularTotal();
}

function calcularTotal() {
  const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  let total = 0;
  for (let i = 0; i < filasFactura.length; i++) {
      total += parseFloat(filasFactura[i].cells[4].textContent);
  }
  document.getElementById('total-amount').value = total.toFixed(2);
}
