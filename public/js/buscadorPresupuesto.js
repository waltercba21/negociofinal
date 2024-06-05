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

      // Usa el evento 'change' en lugar de 'input'
      celdaCantidadFactura.firstChild.addEventListener('change', (e) => {
        const cantidad = e.target.value;
        // Convierte el precio del producto a un número antes de realizar la multiplicación
        celdaSubtotalFactura.textContent = cantidad * Number(producto.precio_venta);
        calcularTotal();
      });
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
  document.getElementById('total-amount').value = total;
}

/*----------------GENERAR PDF PARA IMPRIMIR ----------------------*/
document.addEventListener('DOMContentLoaded', (event) => {
  document.getElementById('print-button').addEventListener('click', function(event) {
    event.preventDefault();

    // Recopilar los datos del formulario
    const customerName = document.getElementById('customer-name').value;
    let invoiceDate = document.getElementById('invoice-date').value;
    const invoiceNumber = document.getElementById('invoice-number').value;
    const invoiceData = document.getElementById('tabla-factura').outerHTML;
    const totalAmount = document.getElementById('total-amount').value;

    // Cambiar el formato de la fecha
    invoiceDate = invoiceDate.split('-').reverse().join('-');

    // Crear una nueva estructura HTML para el PDF
    const pdfContent = `
      <div style="margin: 20px;">
        <h2>Presupuesto</h2>
        <div>Nombre del cliente: ${customerName}</div>
        <div>Fecha: ${invoiceDate}</div>
        <div>Presupuesto N°: ${invoiceNumber}</div>
        <div>${invoiceData}</div>
        <div style="text-align: right;">Total: ${totalAmount}</div>
      </div>
    `;

    // Crear un nuevo elemento div y agregar la estructura HTML a él
    const pdfElement = document.createElement('div');
    pdfElement.innerHTML = pdfContent;
    pdfElement.style.position = 'absolute'; // Posicionar el div absolutamente
    pdfElement.style.left = '-9999px'; // Mover el div fuera de la pantalla
    document.body.appendChild(pdfElement); // Agrega el div al DOM

    // Pasar el nuevo elemento div a html2canvas y jsPDF
    html2canvas(pdfElement).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      pdf.addImage(imgData, 'PNG', 0, 0);
      pdf.save("presupuesto.pdf");

      // Elimina el div del DOM después de crear el PDF
      document.body.removeChild(pdfElement);
    });
  });
});