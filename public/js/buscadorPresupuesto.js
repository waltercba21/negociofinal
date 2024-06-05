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
      celdaCodigoFactura.textContent = producto.codigo;
      celdaDescripcionFactura.textContent = producto.nombre; 
      celdaPrecioFactura.textContent = producto.precio_venta;
      celdaCantidadFactura.innerHTML = '<input type="number" min="1" value="1">';
      resultadosBusqueda.innerHTML = ''; 
    });
    resultadosBusqueda.appendChild(resultado);
  });
});

/*-------------CALCULAR PRECIO SUBTOTAL------------------*/
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
    celdaCantidadFactura.firstChild.addEventListener('input', (e) => {
      const cantidad = e.target.value;
      celdaSubtotalFactura.textContent = cantidad * producto.precio_venta;
    });
  });
  resultadosBusqueda.appendChild(resultado);
});