document.getElementById('entradaBusqueda').addEventListener('input', async (e) => {
  const busqueda = e.target.value;
  const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
  tablaFactura.innerHTML = '';
  if (!busqueda.trim()) {
    return;
  }
  let url = '/productos/api/buscarConCodigoPrecio?q=' + busqueda;
  const respuesta = await fetch(url);
  const productos = await respuesta.json();
  productos.forEach((producto) => {
    const fila = tablaFactura.insertRow();
    const celdaCodigo = fila.insertCell(0);
    const celdaDescripcion = fila.insertCell(1);
    const celdaPrecio = fila.insertCell(2);
    celdaCodigo.textContent = producto.codigo;
    celdaDescripcion.textContent = producto.descripcion;
    celdaPrecio.textContent = producto.precio_venta;

    // Agregar evento de clic a la fila
    fila.addEventListener('click', () => {
      // Aquí puedes agregar el producto a la factura
      // Por ejemplo, puedes agregar una nueva fila a la tabla de la factura
      const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
      const filaFactura = tablaFactura.insertRow();
      const celdaCodigoFactura = filaFactura.insertCell(0);
      const celdaDescripcionFactura = filaFactura.insertCell(1);
      const celdaPrecioFactura = filaFactura.insertCell(2);
      celdaCodigoFactura.textContent = producto.codigo;
      celdaDescripcionFactura.textContent = producto.descripcion;
      celdaPrecioFactura.textContent = producto.precio_venta;
    });
  });
});