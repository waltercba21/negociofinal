document.getElementById('invoice-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const invoiceItems = [];
    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;

    // Verificar la cantidad de filas en la tabla
    console.log("Cantidad de filas en la factura:", filasFactura.length);

    for (let i = 0; i < filasFactura.length; i++) {
        const codigo = filasFactura[i].cells[0].textContent.trim();
        const descripcion = filasFactura[i].cells[1].textContent.trim();
        
        // Obtener el valor del input de precio unitario
        const precioInput = filasFactura[i].cells[2].querySelector('input').value;
        console.log(`Fila ${i + 1}: Valor de Precio Unitario antes de procesar:`, precioInput);
        
        // Eliminar el símbolo de dólar y convertir a float
        let precio_unitario = parseFloat(precioInput.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim());
        console.log(`Fila ${i + 1}: Precio Unitario procesado:`, precio_unitario);

        let cantidad = parseInt(filasFactura[i].cells[3].querySelector('input').value);
        
        // Asegúrate de que los valores son válidos
        console.log(`Fila ${i + 1}: Código: ${codigo}, Descripción: ${descripcion}, Precio Unitario: ${precio_unitario}, Cantidad: ${cantidad}`);

        // Manejo de valores no válidos
        precio_unitario = !isNaN(precio_unitario) ? precio_unitario : 0; 
        cantidad = !isNaN(cantidad) ? cantidad : 1; 
        
        let subtotal = precio_unitario * cantidad; 

        console.log(`Subtotal calculado para fila ${i + 1}:`, subtotal);

        invoiceItems.push({ 
            producto_id: codigo, 
            descripcion, 
            precio_unitario, 
            cantidad, 
            subtotal 
        }); 
    }

    // Log de los items antes de enviar
    console.log("Items de la factura antes de enviar:", invoiceItems);
    
    // Total presupuesto a enviar
    const totalPresupuesto = document.getElementById('total-amount').value.replace(/\./g, '').replace(',', '.').trim();
    console.log("Total presupuesto antes de enviar:", totalPresupuesto);
    
    try {
        const response = await fetch('/productos/procesarFormularioFacturas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nombreCliente: document.getElementById('nombre-cliente').value.trim(),
                fechaPresupuesto: document.getElementById('fecha-presupuesto').value.trim(),
                totalPresupuesto,
                invoiceItems  
            })
        });

        const data = await response.json();
        console.log("Response from server:", data); 

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

    // Calcula subtotal
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
            row.cells[3].querySelector('input').value = 1; // Resetea a 1
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

    // Actualiza el subtotal
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
}
