document.getElementById('invoice-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const invoiceItems = [];
    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    
    for (let i = 0; i < filasFactura.length; i++) {
        const codigo = filasFactura[i].cells[0].textContent.trim();
        const descripcion = filasFactura[i].cells[1].textContent.trim();
        let precio_unitario = parseFloat(filasFactura[i].cells[2].querySelector('input').value.replace(/\./g, '').replace(',', '.'));
        let cantidad = parseInt(filasFactura[i].cells[3].querySelector('input').value);
        let subtotal = parseFloat(filasFactura[i].cells[4].textContent.replace(/\./g, '').replace(',', '.'));

        precio_unitario = !isNaN(precio_unitario) ? precio_unitario : 0;
        cantidad = !isNaN(cantidad) ? cantidad : 1;
        subtotal = !isNaN(subtotal) ? subtotal : 0;

        invoiceItems.push({ producto_id: codigo, descripcion, precio_unitario, cantidad, subtotal });
    }
    
    try {
        const response = await fetch('/productos/procesarFormulario', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nombreCliente: document.getElementById('nombre-cliente').value.trim(),
                fechaPresupuesto: document.getElementById('fecha-presupuesto').value.trim(),
                totalPresupuesto: document.getElementById('total-amount').value.replace(/\./g, '').replace(',', '.').trim(),
                invoiceItems
            })
        });

        const data = await response.json();
        console.log("Response from server:", data); 

        if (response.ok) {
            alert(data.message);
            window.location.reload();
        } else {
            throw new Error(data.error || 'Error al procesar el formulario');
        }
    } catch (error) {
        console.error('Error al enviar formulario:', error);
        alert('Error al enviar formulario: ' + error.message);
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

            // Eventos para actualizar el subtotal y recalcular el total cuando cambian la cantidad o el precio
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
    const subtotal = precio * cantidad;
    row.cells[5].textContent = subtotal.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    calcularTotal();
}

function calcularTotal() {
    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    let total = 0;
    for (let i = 0; i < filasFactura.length; i++) {
        const value = parseFloat(filasFactura[i].cells[5].textContent.replace(/\$|\./g, '').replace(',', '.'));
        total += value;
    }
    document.getElementById('total-amount').value = total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}
