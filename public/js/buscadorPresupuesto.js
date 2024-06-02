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
      celdaPrecio.textContent = producto.precio;
    });
  });