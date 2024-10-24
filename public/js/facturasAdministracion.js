document.getElementById('mostrarFormulario').addEventListener('click', function() {
  var formulario = document.getElementById('formularioFacturas');
  var fondoOscuro = document.getElementById('fondoOscuro');
  if (formulario.style.display === 'none') {
      formulario.style.display = 'block';
      fondoOscuro.style.display = 'block';
  } else {
      formulario.style.display = 'none';
      fondoOscuro.style.display = 'none';
  }
});

document.querySelector('.btn-facturas-guardar button[type="reset"]').addEventListener('click', function(e) {
  e.preventDefault();
  document.getElementById('formularioFacturas').style.display = 'none';
  document.getElementById('fondoOscuro').style.display = 'none';
});

// Evento de escucha para el fondo oscuro
document.getElementById('fondoOscuro').addEventListener('click', function() {
  document.getElementById('formularioFacturas').style.display = 'none';
  this.style.display = 'none';
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

  productos.forEach((producto) => {
      const resultado = document.createElement('div');
      resultado.textContent = producto.nombre;
      resultado.classList.add('resultado-busqueda');
      resultado.addEventListener('click', () => {
          resultadosBusqueda.innerHTML = ''; // Limpiar los resultados de búsqueda
          const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
          const filaFactura = tablaFactura.insertRow();
          filaFactura.insertCell(0).textContent = producto.codigo;
          filaFactura.insertCell(1).textContent = producto.nombre;

          const cellPrecio = filaFactura.insertCell(2);
          const inputPrecio = document.createElement('input');
          inputPrecio.type = 'text';
          inputPrecio.value = parseFloat(producto.precio_venta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
          cellPrecio.appendChild(inputPrecio);

          const cellCantidad = filaFactura.insertCell(3);
          const inputCantidad = document.createElement('input');
          inputCantidad.type = 'number';
          inputCantidad.min = 1;
          inputCantidad.value = 1;
          cellCantidad.appendChild(inputCantidad);

          const cellStock = filaFactura.insertCell(4);
          cellStock.textContent = producto.stock_actual;

          const cellEliminar = filaFactura.insertCell(5);
          const botonEliminar = document.createElement('button');
          botonEliminar.textContent = '✖';
          botonEliminar.className = 'boton-eliminar';
          botonEliminar.addEventListener('click', function () {
              tablaFactura.deleteRow(filaFactura.rowIndex - 1);
          });
          cellEliminar.appendChild(botonEliminar);
      });
      resultadosBusqueda.appendChild(resultado);
  });
});

// Manejar el envío del formulario
document.getElementById('invoice-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const invoiceItems = [];
  const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;

  // Recopilar datos de la tabla
  for (let i = 0; i < filasFactura.length; i++) {
      const codigo = filasFactura[i].cells[0].textContent.trim();
      const descripcion = filasFactura[i].cells[1].textContent.trim();
      const precioInput = filasFactura[i].cells[2].querySelector('input').value;
      const cantidad = parseInt(filasFactura[i].cells[3].querySelector('input').value);

      invoiceItems.push({
          id: codigo,
          descripcion,
          precio_unitario: precioInput,
          cantidad
      });
  }

  // Crear el FormData para enviar
  const formData = new FormData();
  formData.append('invoiceItems', JSON.stringify(invoiceItems));
  formData.append('comprobante_pago', document.getElementById('comprobante_pago').files[0]);

  try {
      const response = await fetch('/facturas', {
          method: 'POST',
          body: formData
      });

      const data = await response.json();
      if (response.ok) {
          Swal.fire({
              title: '¡Éxito!',
              text: data.message,
              icon: 'success',
              confirmButtonText: 'Entendido'
          }).then(() => {
              window.location.reload(); // Recargar la página
          });
      } else {
          throw new Error(data.error || 'Error al procesar el formulario');
      }
  } catch (error) {
      console.error('Error al enviar el formulario:', error);
      Swal.fire({
          title: 'Error',
          text: 'Error al enviar formulario: ' + error.message,
          icon: 'error',
          confirmButtonText: 'Entendido'
      });
  }
});
