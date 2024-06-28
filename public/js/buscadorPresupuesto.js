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
