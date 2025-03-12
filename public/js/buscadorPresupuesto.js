document.getElementById('invoice-form').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        return false;
    }
});

document.getElementById('invoice-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Validar que al menos un método de pago esté seleccionado
    const metodosPagoSeleccionados = document.querySelectorAll('input[name="metodosPago"]:checked');
    if (metodosPagoSeleccionados.length === 0) {
        Swal.fire({
            title: 'Error',
            text: 'Debe seleccionar al menos un método de pago antes de continuar.',
            icon: 'warning',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    const invoiceItems = [];
    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    
    for (let i = 0; i < filasFactura.length; i++) {
        const codigo = filasFactura[i].cells[1].textContent.trim();
        const descripcion = filasFactura[i].cells[2].textContent.trim();
        const precioInput = filasFactura[i].cells[3].querySelector('input').value;
        let precio_unitario = parseFloat(precioInput.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim());
        let cantidad = parseInt(filasFactura[i].cells[4].querySelector('input').value);
        precio_unitario = !isNaN(precio_unitario) ? precio_unitario : 0;
        cantidad = !isNaN(cantidad) ? cantidad : 1;
        let subtotal = precio_unitario * cantidad;

        // 🔥🔥🔥 Solo agregar productos que tienen un código y una descripción válida
        if (codigo !== '' && descripcion !== '' && cantidad > 0 && precio_unitario > 0) {
            invoiceItems.push({
                producto_id: codigo,
                descripcion,
                precio_unitario,
                cantidad,
                subtotal
            });
        }
    }

    // 🔥🔥🔥 Validar que al menos un producto válido fue agregado
    if (invoiceItems.length === 0) {
        Swal.fire({
            title: 'Error',
            text: 'Debe agregar al menos un producto válido a la factura antes de enviarla.',
            icon: 'error',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    const totalFacturaElement = document.getElementById('total-amount');
    let totalFactura = '0';
    if (totalFacturaElement) {
        totalFactura = totalFacturaElement.value.replace(/\./g, '').replace(',', '.').replace('$', '').trim();
    } else {
        console.error('No se encontró el elemento total-amount.');
    }

    const fechaFacturaElement = document.getElementById('fecha-presupuesto');
    const fechaFactura = fechaFacturaElement ? fechaFacturaElement.value.trim() : undefined;

    const metodosPago = Array.from(metodosPagoSeleccionados).map(input => input.value);

    try {
        const response = await fetch('/productos/procesarFormulario', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nombreCliente: document.getElementById('nombre-cliente').value.trim(),
                fechaPresupuesto: fechaFactura,
                totalPresupuesto: totalFactura,
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
                Swal.fire({
                    title: 'Nueva Factura',
                    text: 'Está por realizar una nueva factura. Complete los datos.',
                    icon: 'info',
                    confirmButtonText: 'Entendido'
                }).then(() => {
                    window.location.reload();
                });
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


document.addEventListener('DOMContentLoaded', () => {
    Swal.fire({
        title: 'Está en la sección de Facturas',
        text: 'Recuerde que está realizando una factura, no un presupuesto.',
        icon: 'info',
        confirmButtonText: 'Entendido'
    });

    const entradaBusqueda = document.getElementById('entradaBusqueda');
    const resultadosBusqueda = document.getElementById('resultadosBusqueda');
    let timeoutId;

    entradaBusqueda.addEventListener('keyup', async (e) => {
        const busqueda = e.target.value;
        resultadosBusqueda.innerHTML = '';

        if (!busqueda.trim()) {
            resultadosBusqueda.style.display = 'none';
            return;
        }

        const url = '/productos/api/buscar?q=' + busqueda;

        const respuesta = await fetch(url);
        const productos = await respuesta.json();

        productos.forEach((producto) => {
            const resultado = document.createElement('div');
            resultado.classList.add('resultado-busqueda');
            resultado.dataset.codigo = producto.codigo;
            resultado.dataset.nombre = producto.nombre;
            resultado.dataset.precio_venta = producto.precio_venta;
            resultado.dataset.stock_actual = producto.stock_actual;

            if (producto.imagenes && producto.imagenes.length > 0) {
                resultado.dataset.imagen = '/uploads/productos/' + producto.imagenes[0].imagen;
            }

            const contenedor = document.createElement('div');
            contenedor.classList.add('resultado-contenedor');

            if (producto.imagenes && producto.imagenes.length > 0) {
                const imagen = document.createElement('img');
                imagen.src = '/uploads/productos/' + producto.imagenes[0].imagen;
                imagen.classList.add('miniatura');
                contenedor.appendChild(imagen);
            }

            const nombreProducto = document.createElement('span');
            nombreProducto.textContent = producto.nombre;
            contenedor.appendChild(nombreProducto);

            resultado.appendChild(contenedor);

            resultado.addEventListener('mouseenter', function () {
                const resultados = document.querySelectorAll('.resultado-busqueda');
                resultados.forEach(r => r.classList.remove('hover-activo'));
                this.classList.add('hover-activo');
            });

            resultado.addEventListener('mouseleave', function () {
                this.classList.remove('hover-activo');
            });

            // Asociar el evento click directamente a cada resultado
            resultado.addEventListener('click', function () {
                console.log("Producto seleccionado:", this.dataset);
                const codigoProducto = this.dataset.codigo;
                const nombreProducto = this.dataset.nombre;
                const precioVenta = this.dataset.precio_venta;
                const stockActual = this.dataset.stock_actual;
                const imagenProducto = this.dataset.imagen;
                console.log(`Intentando agregar producto: ${codigoProducto}, ${nombreProducto}`);
                agregarProductoATabla(codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto);
            });

            resultadosBusqueda.appendChild(resultado);
            resultadosBusqueda.style.display = 'block';
        });
    });

    resultadosBusqueda.addEventListener('mouseleave', () => {
        timeoutId = setTimeout(() => {
            resultadosBusqueda.style.display = 'none';
        }, 300);
    });

    resultadosBusqueda.addEventListener('mouseenter', () => {
        clearTimeout(timeoutId);
        resultadosBusqueda.style.display = 'block';
    });
});

function agregarProductoATabla(codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto) {
    const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
    const filas = tablaFactura.rows;

    let filaDisponible = null;

    // Buscar la primera fila vacía disponible
    for (let i = 0; i < filas.length; i++) {
        if (!filas[i].cells[1].textContent.trim()) {
            filaDisponible = filas[i];
            break;
        }
    }

    if (!filaDisponible) {
        Swal.fire("Límite alcanzado", "Solo se pueden agregar hasta 10 productos.", "warning");
        return;
    }

    console.log("Fila disponible encontrada:", filaDisponible);

    // Agregar datos a la fila encontrada
    const cellImagen = filaDisponible.cells[0];
    const imgElement = cellImagen.querySelector("img");
    if (imagenProducto && imgElement) {
        imgElement.src = imagenProducto;
        imgElement.style.display = "block";
    }

    filaDisponible.cells[1].textContent = codigoProducto;
    filaDisponible.cells[2].textContent = nombreProducto;

    const inputPrecio = filaDisponible.cells[3].querySelector("input");
    if (inputPrecio) {
        inputPrecio.value = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
        inputPrecio.disabled = false;
    }

    const inputCantidad = filaDisponible.cells[4].querySelector("input");
    if (inputCantidad) {
        inputCantidad.value = 1;
        inputCantidad.disabled = false;
        inputCantidad.addEventListener('input', function () {
            updateSubtotal(filaDisponible);
        });
    }

    filaDisponible.cells[5].textContent = stockActual;
    filaDisponible.cells[6].textContent = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

    // 🔥 Llamar a calcularTotal() inmediatamente para mostrar el precio final
    calcularTotal();

    // Activar el botón de eliminar
    const botonEliminar = filaDisponible.cells[7].querySelector("button");
    if (botonEliminar) {
        botonEliminar.style.display = "block";
        botonEliminar.classList.add("boton-eliminar-factura");
        botonEliminar.innerHTML = '<i class="fas fa-trash"></i>';
        botonEliminar.addEventListener("click", function () {
            filaDisponible.cells[1].textContent = "";
            filaDisponible.cells[2].textContent = "";
            if (inputPrecio) inputPrecio.value = "";
            if (inputCantidad) inputCantidad.value = "";
            filaDisponible.cells[5].textContent = "";
            filaDisponible.cells[6].textContent = "";
            imgElement.style.display = "none";
            botonEliminar.style.display = "none";
            calcularTotal();
        });
    }

    console.log("Producto agregado correctamente a la tabla.");
}



function updateSubtotal(row, verificarStock = true) {
    const inputPrecio = row.cells[3].querySelector('input');
    const inputCantidad = row.cells[4].querySelector('input');
    const stockActualCell = row.cells[5];

    if (!inputPrecio || !inputCantidad || !stockActualCell) {
        console.error("Error: No se encontraron los elementos necesarios en la fila.");
        return;
    }

    let precio = parseFloat(inputPrecio.value.replace(/\$|\./g, '').replace(',', '.'));
    let cantidad = parseInt(inputCantidad.value);
    let stockActual = parseInt(stockActualCell.textContent.replace(/\$|\./g, '').replace(',', '.'));

    precio = !isNaN(precio) ? precio : 0;
    cantidad = !isNaN(cantidad) ? cantidad : 1;
    stockActual = !isNaN(stockActual) ? stockActual : 0;

    const subtotal = precio * cantidad;
    row.cells[6].textContent = subtotal.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

    // 🔥 Validar stock SOLO cuando se modifica la cantidad, NO cuando se cambia el precio
    if (verificarStock && document.activeElement === inputCantidad) {
        if (cantidad > stockActual) {
            Swal.fire({
                title: 'ALERTA',
                text: 'NO HAY STOCK DISPONIBLE. Solo hay ' + stockActual + ' unidades en stock.',
                icon: 'error',
                confirmButtonText: 'Entendido'
            });
            inputCantidad.value = stockActual > 0 ? stockActual : 1; // Si hay stock disponible, usa el máximo, si no, 1
            cantidad = parseInt(inputCantidad.value); // Actualizamos la cantidad
        }

        const stockRestante = stockActual - cantidad;
        const stockMinimo = 5;

        if (stockRestante <= stockMinimo && stockRestante >= 0) {
            Swal.fire({
                title: 'ALERTA',
                text: 'LLEGANDO AL LIMITE DE STOCK. Quedan ' + stockRestante + ' unidades disponibles.',
                icon: 'warning',
                confirmButtonText: 'Entendido'
            });
        }
    }

    calcularTotal(); // Recalcular total después de actualizar el subtotal
}

function calcularTotal() {
    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    let total = 0;

    for (let i = 0; i < filasFactura.length; i++) {
        let subtotal = parseFloat(filasFactura[i].cells[6].textContent.replace(/\$|\./g, '').replace(',', '.'));
        subtotal = !isNaN(subtotal) ? subtotal : 0;
        total += subtotal;
    }

    const creditoCheckbox = document.querySelector('input[name="metodosPago"][value="CREDITO"]');
    const interesAmountInput = document.getElementById('interes-amount');
    const totalAmountInput = document.getElementById('total-amount');

    let interes = 0;

    if (creditoCheckbox && creditoCheckbox.checked) {
        interes = total * 0.15; // Interés del 15%
        total += interes; // 🔥 Se aplica el interés directamente al total
    }

    interesAmountInput.value = interes.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    totalAmountInput.value = total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}


// 🔥 Asociar eventos a los inputs de cantidad y precio para actualizar dinámicamente
document.querySelectorAll('#tabla-factura tbody tr').forEach(row => {
    const inputCantidad = row.cells[4].querySelector('input');
    const inputPrecio = row.cells[3].querySelector('input');

    if (inputCantidad) {
        inputCantidad.addEventListener('input', function () {
            updateSubtotal(row);
        });
    }

    if (inputPrecio) {
        inputPrecio.addEventListener('input', function () {
            updateSubtotal(row, false); // 🔥 Evita la validación de stock cuando se cambia el precio
        });
    }
});

// 🔥 Actualizar el total cuando se cambian los métodos de pago
document.querySelectorAll('input[name="metodosPago"]').forEach(checkbox => {
    checkbox.addEventListener('change', calcularTotal);
});
