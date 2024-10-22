document.getElementById('invoice-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const invoiceItems = [];
    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;

    console.log('Número de filas en la tabla:', filasFactura.length);

    for (let i = 0; i < filasFactura.length; i++) {
        const codigo = filasFactura[i].cells[0].textContent.trim();
        const descripcion = filasFactura[i].cells[1].textContent.trim();
        const precioInput = filasFactura[i].cells[2].querySelector('input').value;

        console.log(`Producto ${i + 1} - Código: ${codigo}, Descripción: ${descripcion}, Precio input: ${precioInput}`);

        let precio_unitario = parseFloat(precioInput.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim());
        let cantidad = parseInt(filasFactura[i].cells[3].querySelector('input').value);
        precio_unitario = !isNaN(precio_unitario) ? precio_unitario : 0; 
        cantidad = !isNaN(cantidad) ? cantidad : 1; 
        let subtotal = precio_unitario * cantidad; 

        console.log(`Producto ${i + 1} - Precio Unitario: ${precio_unitario}, Cantidad: ${cantidad}, Subtotal: ${subtotal}`);

        invoiceItems.push({ 
            producto_id: codigo, 
            descripcion, 
            precio_unitario, 
            cantidad, 
            subtotal 
        }); 
    }

    // Verificar y obtener el valor de 'total-amount'
    const totalFacturaElement = document.getElementById('total-amount');
    console.log('Elemento total-amount:', totalFacturaElement);

    if (totalFacturaElement) {
        console.log('Valor de total-amount antes de aplicar replace:', totalFacturaElement.value);
    } else {
        console.error('No se encontró el elemento total-amount.');
    }

    let totalFactura = totalFacturaElement && totalFacturaElement.value 
        ? totalFacturaElement.value.replace(/\./g, '').replace(',', '.').trim()
        : '0';

    console.log('Valor de totalFactura después de replace:', totalFactura);

    // Verificar y obtener el valor de 'fecha-presupuesto'
    const fechaFacturaElement = document.getElementById('fecha-presupuesto');
    const fechaFactura = fechaFacturaElement ? fechaFacturaElement.value.trim() : undefined;

    if (fechaFacturaElement) {
        console.log('Valor de fecha-presupuesto:', fechaFactura);
    } else {
        console.error('No se encontró el elemento fecha-presupuesto.');
    }

    const metodosPago = [];
    document.querySelectorAll('input[name="metodosPago"]:checked').forEach(function(checkbox) {
        metodosPago.push(checkbox.value);
    });

    console.log('Métodos de pago seleccionados:', metodosPago);

    try {
        const response = await fetch('/productos/procesarFormularioFacturas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nombreCliente: document.getElementById('nombre-cliente').value.trim(),
                fechaFactura, // Corregido para enviar el valor de fechaFactura
                totalFactura,
                invoiceItems,
                metodosPago: metodosPago.join(', ')
            })
        });

        const data = await response.json();
        if (response.ok) {
            Swal.fire({
                title: '¡Éxito!',
                text: data.message,
                icon: 'success',
                confirmButtonText: 'Entendido'
            }).then(() => {
                window.location.reload(); 
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
            inputCantidad.addEventListener('input', function() {
                updateSubtotal(filaFactura);
            });
            inputPrecio.addEventListener('input', function() {
                updateSubtotal(filaFactura, false);
            });
            calcularTotal();
        });
        resultadosBusqueda.appendChild(resultado);
    });
});
function updateSubtotal(row, verificarStock = true) {
    const precio = parseFloat(row.cells[2].querySelector('input').value.replace(/\$|\./g, '').replace(',', '.')) || 0;
    const cantidad = parseInt(row.cells[3].querySelector('input').value) || 0;
    const stockActual = parseInt(row.cells[4].textContent.replace(/\$|\./g, '').replace(',', '.')) || 0;
    const subtotal = precio * cantidad;
    const stockMinimo = 5;
    if (verificarStock) {
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
    document.getElementById('total-amount').value = total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }); 
    console.log('Total calculado:', total);
}  