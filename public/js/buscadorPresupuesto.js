document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('entradaBusqueda');
    
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const busqueda = e.target.value;
            const resultadosBusqueda = document.getElementById('resultadosBusqueda');
            resultadosBusqueda.innerHTML = '';

            if (!busqueda.trim()) {
                return;
            }

            const url = '/productos/api/buscar?q=' + busqueda;
            try {
                const respuesta = await fetch(url);
                const productos = await respuesta.json();
                productos.forEach((producto) => {
                    const resultado = document.createElement('div');
                    resultado.textContent = producto.nombre;
                    resultado.classList.add('resultado-busqueda');
                    resultado.addEventListener('click', () => {
                        resultadosBusqueda.innerHTML = '';
                        const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
                        const filaFactura = tablaFactura.insertRow();
                        filaFactura.insertCell(0).textContent = producto.codigo;
                        filaFactura.insertCell(1).textContent = producto.nombre;

                        const cellPrecio = filaFactura.insertCell(2);
                        const inputPrecio = document.createElement('input');
                        inputPrecio.type = 'text';
                        inputPrecio.value = parseFloat(producto.precio_venta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
                        inputPrecio.className = 'precio-editable';
                        cellPrecio.appendChild(inputPrecio);

                        const cellCantidad = filaFactura.insertCell(3);
                        const inputCantidad = document.createElement('input');
                        inputCantidad.type = 'number';
                        inputCantidad.min = 1;
                        inputCantidad.value = 1;
                        cellCantidad.appendChild(inputCantidad);

                        const cellSubtotal = filaFactura.insertCell(4);
                        cellSubtotal.textContent = parseFloat(producto.precio_venta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

                        const cellEliminar = filaFactura.insertCell(5);
                        const botonEliminar = document.createElement('button');
                        botonEliminar.textContent = '✖';
                        botonEliminar.className = 'boton-eliminar';
                        botonEliminar.addEventListener('click', function() {
                            tablaFactura.deleteRow(filaFactura.rowIndex - 1);
                            calcularTotal();
                        });
                        cellEliminar.appendChild(botonEliminar);

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
            } catch (error) {
                console.error('Error al buscar productos:', error);
            }
        });
    } else {
        console.error('No se encontró el elemento con ID "entradaBusqueda".');
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
    productos.forEach((producto) => {
        const resultado = document.createElement('div');
        resultado.textContent = producto.nombre;
        resultado.classList.add('resultado-busqueda');
        resultado.addEventListener('click', () => {
            resultadosBusqueda.innerHTML = '';  
            const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
            const filaFactura = tablaFactura.insertRow();
            filaFactura.insertCell(0).textContent = producto.codigo;
            filaFactura.insertCell(1).textContent = producto.nombre;

            const cellPrecio = filaFactura.insertCell(2);
            const inputPrecio = document.createElement('input');
            inputPrecio.type = 'text';
            inputPrecio.value = parseFloat(producto.precio_venta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
            inputPrecio.className = 'precio-editable';
            cellPrecio.appendChild(inputPrecio);

            const cellCantidad = filaFactura.insertCell(3);
            const inputCantidad = document.createElement('input');
            inputCantidad.type = 'number';
            inputCantidad.min = 1;
            inputCantidad.value = 1;
            cellCantidad.appendChild(inputCantidad);

            const cellStock = filaFactura.insertCell(4);
            cellStock.textContent = producto.stock_actual;

            const cellSubtotal = filaFactura.insertCell(5);
            cellSubtotal.textContent = parseFloat(producto.precio_venta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

            const cellEliminar = filaFactura.insertCell(6);
            const botonEliminar = document.createElement('button');
            botonEliminar.textContent = '✖';
            botonEliminar.className = 'boton-eliminar';
            botonEliminar.addEventListener('click', function() {
                tablaFactura.deleteRow(filaFactura.rowIndex - 1);
                calcularTotal();
            });
            cellEliminar.appendChild(botonEliminar);
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
    const precio = parseFloat(row.cells[2].querySelector('input').value.replace(/\$|\./g, '').replace(',', '.'));
    const cantidad = parseInt(row.cells[3].querySelector('input').value);
    const stockActual = parseInt(row.cells[4].textContent.replace(/\$|\./g, '').replace(',', '.'));
    const subtotal = !isNaN(precio) && !isNaN(cantidad) ? precio * cantidad : 0;
    const stockMinimo = 5;

    if (cantidad > stockActual) {
        Swal.fire({
            title: 'ALERTA',
            text: 'NO HAY STOCK DISPONIBLE',
            icon: 'error',
            confirmButtonText: 'Entendido'
        });
        row.cells[3].querySelector('input').value = 1;
        return;
    }

    const stockRestante = stockActual - cantidad;

    if (stockRestante <= stockMinimo) {
        Swal.fire({
            title: 'ALERTA',
            text: 'LLEGANDO AL LIMITE DE STOCK',
            icon: 'warning',
            confirmButtonText: 'Entendido'
        });
    }

    row.cells[5].textContent = subtotal.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    calcularTotal();
}

function calcularTotal() {
    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    let total = 0;

    for (let i = 0; i < filasFactura.length; i++) {
        let subtotal = parseFloat(filasFactura[i].cells[5].textContent.replace(/\$|\./g, '').replace(',', '.'));
        subtotal = !isNaN(subtotal) ? subtotal : 0;
        total += subtotal;
    }

    document.getElementById('total-amount').value = total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }); // Usar 'value' en lugar de 'textContent'
}
