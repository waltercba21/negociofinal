document.getElementById('invoice-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const invoiceItems = [];
    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    
    for (let i = 0; i < filasFactura.length; i++) {
        const codigo = filasFactura[i].cells[0].textContent.trim();
        const descripcion = filasFactura[i].cells[1].textContent.trim();
        let precio_unitario = parseFloat(filasFactura[i].cells[2].querySelector('input').value.replace(/\./g, '').replace(',', '.'));
        let cantidad = parseInt(filasFactura[i].cells[3].querySelector('input').value);
        let subtotal = parseFloat(filasFactura[i].cells[4].textContent.replace(/\$|\./g, '').replace(',', '.'));

        // Validaciones para asegurarnos de que los valores son válidos
        precio_unitario = !isNaN(precio_unitario) ? precio_unitario : 0;
        cantidad = !isNaN(cantidad) ? cantidad : 1;
        subtotal = !isNaN(subtotal) ? subtotal : 0;

        // Añadir el objeto al array invoiceItems
        invoiceItems.push({ 
            producto_id: codigo, 
            descripcion, 
            precio_unitario, 
            cantidad, 
            subtotal 
        });
    }

    console.log("Invoice Items to be sent:", invoiceItems); // Confirmar que invoiceItems es un array

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
                invoiceItems  // Enviar el array correctamente
            })
        });

        const data = await response.json();
        console.log("Response from server:", data); // Confirmar respuesta del servidor

        if (response.ok) {
            Swal.fire({
                title: '¡Éxito!',
                text: data.message,
                icon: 'success',
                confirmButtonText: 'Entendido'
            }).then(() => {
                window.location.reload(); // Recarga la página después de cerrar la alerta
            });
        } else {
            throw new Error(data.error || 'Error al procesar el formulario');
        }
    } catch (error) {
        console.error('Error al enviar formulario:', error);
        Swal.fire({
            title: 'Error',
            text: 'Error al enviar formulario: ' + error.message,
            icon: 'error',
            confirmButtonText: 'Entendido'
        });
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
