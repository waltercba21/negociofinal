document.getElementById('invoice-form').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        return false;
    }
});

document.getElementById('invoice-form').addEventListener('submit', async function(e) {
    e.preventDefault();
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
        invoiceItems.push({
            producto_id: codigo,
            descripcion,
            precio_unitario,
            cantidad,
            subtotal
        });
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

    const metodosPago = [];
    document.querySelectorAll('input[name="metodosPago"]:checked').forEach(function(checkbox) {
        metodosPago.push(checkbox.value);
    });

    try {
        const response = await fetch('/productos/procesarFormularioFacturas', {
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

        const url = '/productos/api/buscar?q=' + busqueda + '&limite=5';

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
                const codigoProducto = this.dataset.codigo;
                const nombreProducto = this.dataset.nombre;
                const precioVenta = this.dataset.precio_venta;
                const stockActual = this.dataset.stock_actual;
                const imagenProducto = this.dataset.imagen;
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

    // Buscar la primera fila vacía disponible
    let filaDisponible = null;
    for (let i = 0; i < filas.length; i++) {
        if (!filas[i].cells[1].textContent.trim()) {
            filaDisponible = filas[i];
            break;
        }
    }

    // Si no hay filas vacías, no se agrega más
    if (!filaDisponible) {
        Swal.fire("Límite alcanzado", "Solo se pueden agregar hasta 10 productos.", "warning");
        return;
    }

    // Agregar datos a la fila encontrada
    const cellImagen = filaDisponible.cells[0];
    const imgElement = cellImagen.querySelector("img");
    if (imagenProducto && imgElement) {
        imgElement.src = imagenProducto;
        imgElement.style.display = "block";
    }

    filaDisponible.cells[1].textContent = codigoProducto;
    filaDisponible.cells[2].textContent = nombreProducto;
    filaDisponible.cells[3].querySelector("input").value = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    filaDisponible.cells[4].querySelector("input").value = 1;
    filaDisponible.cells[5].textContent = stockActual;
    filaDisponible.cells[6].textContent = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

    // Activar el botón de eliminar
    const botonEliminar = filaDisponible.cells[7].querySelector("button");
    botonEliminar.style.display = "block";
    botonEliminar.addEventListener("click", function () {
        filaDisponible.cells[1].textContent = "";
        filaDisponible.cells[2].textContent = "";
        filaDisponible.cells[3].querySelector("input").value = "";
        filaDisponible.cells[4].querySelector("input").value = "";
        filaDisponible.cells[5].textContent = "";
        filaDisponible.cells[6].textContent = "";
        imgElement.style.display = "none";
        botonEliminar.style.display = "none";
    });
}


function updateSubtotal(row, verificarStock = true) {
    const precio = parseFloat(row.cells[3].querySelector('input').value.replace(/\$|\./g, '').replace(',', '.'));
    const cantidad = parseInt(row.cells[4].querySelector('input').value);
    const stockActual = parseInt(row.cells[5].textContent.replace(/\$|\./g, '').replace(',', '.'));
    const subtotal = !isNaN(precio) && !isNaN(cantidad) ? precio * cantidad : 0;
    const stockMinimo = 5;

    if (verificarStock) {
        if (cantidad > stockActual) {
            Swal.fire({
                title: 'ALERTA',
                text: 'NO HAY STOCK DISPONIBLE',
                icon: 'error',
                confirmButtonText: 'Entendido'
            });
            row.cells[4].querySelector('input').value = 1;
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

    row.cells[6].textContent = subtotal.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    calcularTotal();
}

function calcularTotal() {
    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    let total = 0;
    for (let i = 0; i < filasFactura.length; i++) {
        let subtotal = parseFloat(filasFactura[i].cells[6].textContent.replace(/\$|\./g, '').replace(',', '.'));
        subtotal = !isNaN(subtotal) ? subtotal : 0;
        total += subtotal;
    }

    document.getElementById('total-amount').value = total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

    const creditoCheckbox = document.querySelector('input[name="metodosPago"][value="CREDITO"]');
    const interesAmountInput = document.getElementById('interes-amount');
    const totalFinalAmountInput = document.getElementById('total-final-amount');
    let interes = 0;
    let totalConInteres = total;

    if (creditoCheckbox && creditoCheckbox.checked) {
        interes = total * 0.20;
        totalConInteres += interes;
        interesAmountInput.value = interes.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    } else {
        interesAmountInput.value = '';
    }

    totalFinalAmountInput.value = totalConInteres.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

document.querySelectorAll('input[name="metodosPago"]').forEach(checkbox => {
    checkbox.addEventListener('change', calcularTotal);
});