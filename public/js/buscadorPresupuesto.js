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
      celdaCantidadFactura.firstChild.addEventListener('change', (e) => {
        const cantidad = e.target.value;
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
$(document).ready(function() {
  console.log("Documento listo");
  $('#print-button').click(function(e) {
      console.log("Botón clickeado");
      e.preventDefault();
      let datos = {
          nombreCliente: $('#customer-name').val(),
          fecha: $('#invoice-date').val(),
          numeroPresupuesto: $('#invoice-number').val(),
          productos: []
      };
      console.log("Datos iniciales: ", datos);
      $('#tabla-factura tbody tr').each(function() {
          let producto = {
              codigo: $(this).find('.codigo').text(),
              descripcion: $(this).find('.descripcion').text(),
              precio: $(this).find('.precio').text(),
              cantidad: $(this).find('.cantidad').text(),
              subtotal: $(this).find('.subtotal').text()
          };
          console.log("Producto: ", producto);
          datos.productos.push(producto);
      });
      console.log("Datos finales: ", datos);
      $.post('/productos/generarPresupuestoPDF', datos, function(url) {
          console.log("Respuesta del servidor: ", url);
          window.location.href = url;
      }).fail(function(jqXHR, textStatus, error) {
          console.error("Error en la petición: " + textStatus, error);
      });
  });
});