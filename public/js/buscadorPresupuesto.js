document.getElementById('invoice-form').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        return false;
    }
});

document.getElementById('invoice-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const nombreCliente = document.getElementById('nombre-cliente').value.trim();
    const fechaPresupuesto = document.getElementById('fecha-presupuesto').value.trim();
    const totalPresupuesto = document.getElementById('total-amount').value.replace(/\./g, '').replace(',', '.').trim();

    if (!nombreCliente || !fechaPresupuesto || !totalPresupuesto) {
        Swal.fire({
            title: 'Error',
            text: 'Por favor complete todos los datos requeridos antes de guardar el presupuesto.',
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
        let precio_unitario = parseFloat(filasFactura[i].cells[3].querySelector('input').value.replace(/\./g, '').replace(',', '.'));
        let cantidad = parseInt(filasFactura[i].cells[4].querySelector('input').value);
        let subtotal = parseFloat(filasFactura[i].cells[6].textContent.replace(/\$|\./g, '').replace(',', '.'));

        precio_unitario = !isNaN(precio_unitario) ? precio_unitario : 0;
        cantidad = !isNaN(cantidad) ? cantidad : 1;
        subtotal = !isNaN(subtotal) ? subtotal : 0;

        invoiceItems.push({
            producto_id: codigo,
            descripcion,
            precio_unitario,
            cantidad,
            subtotal
        });
    }

    try {
        const response = await fetch('/productos/procesarFormulario', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nombreCliente,
                fechaPresupuesto,
                totalPresupuesto,
                invoiceItems
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
                // Mostrar la alerta después de guardar el presupuesto
                Swal.fire({
                    title: 'Nuevo Presupuesto',
                    text: 'Está por realizar un nuevo presupuesto. Complete los datos.',
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
        title: 'Está en la sección de Presupuestos',
        text: 'Recuerde que está realizando un presupuesto, no una factura.',
        icon: 'info',
        confirmButtonText: 'Entendido'
    });

    const entradaBusqueda = document.getElementById('entradaBusqueda');
    const resultadosBusqueda = document.getElementById('resultadosBusqueda');
    let timeoutId;

    entradaBusqueda.addEventListener('input', async (e) => {
        const busqueda = e.target.value;
        resultadosBusqueda.innerHTML = '';

        if (!busqueda.trim()) {
            resultadosBusqueda.style.display = 'none';
            return;
        }

        const url = '/productos/api/buscar?q=' + busqueda;
        const respuesta = await fetch(url);
        const productos = await respuesta.json();
        const limite = 5;
        const productosLimitados = productos.slice(0, limite);

        productosLimitados.forEach((producto) => {
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

            resultado.addEventListener('mouseenter', function() {
                const resultados = document.querySelectorAll('.resultado-busqueda');
                resultados.forEach(r => r.classList.remove('hover-activo'));
                this.classList.add('hover-activo');
            });

            resultado.addEventListener('mouseleave', function() {
                this.classList.remove('hover-activo');
            });

            resultadosBusqueda.appendChild(resultado);
            resultadosBusqueda.style.display = 'block';
        });

        // Configurar los listeners para cada resultado de búsqueda
        configurarListenersParaResultados(productosLimitados);
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

function configurarListenersParaResultados(productos) {
    const resultadosBusqueda = document.getElementById('resultadosBusqueda');
    resultadosBusqueda.querySelectorAll('.resultado-busqueda').forEach(resultado => {
        resultado.removeEventListener('click', agregarProductoDesdeResultado);
        resultado.addEventListener('click', agregarProductoDesdeResultado);
    });
}

function agregarProductoDesdeResultado(evento) {
    const resultado = evento.currentTarget;
    const codigoProducto = resultado.dataset.codigo;
    const nombreProducto = resultado.dataset.nombre;
    const precioVenta = resultado.dataset.precio_venta;
    const stockActual = resultado.dataset.stock_actual;
    const imagenProducto = resultado.dataset.imagen;

    console.log("Producto clickeado:", codigoProducto, nombreProducto);
    agregarProductoATabla(codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto);
}

function agregarProductoATabla(codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto) {
    console.log("Agregando producto a tabla:", codigoProducto, nombreProducto);
    const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];

    // Verificar si el producto ya existe en la tabla
    const productoExistente = Array.from(tablaFactura.rows).find(row => row.cells[1].textContent.trim().toUpperCase() === codigoProducto.trim().toUpperCase());
    if (productoExistente) {
        console.log("Producto ya existe en la tabla:", codigoProducto);
        Swal.fire({
            title: 'Producto Duplicado',
            text: 'Este producto ya ha sido añadido a la lista.',
            icon: 'warning',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    // Agregar la fila con la imagen
    const filaFactura = tablaFactura.insertRow();

    // Celda para la imagen
    const cellImagen = filaFactura.insertCell(0);
    if (imagenProducto) {
        const imagen = document.createElement('img');
        imagen.src = imagenProducto;
        imagen.classList.add('miniatura-tabla');
        cellImagen.appendChild(imagen);
    }

    // Celdas para los demás datos del producto
    filaFactura.insertCell(1).textContent = codigoProducto;
    filaFactura.insertCell(2).textContent = nombreProducto;

    const cellPrecio = filaFactura.insertCell(3);
    const inputPrecio = document.createElement('input');
    inputPrecio.type = 'text';
    inputPrecio.value = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    inputPrecio.className = 'precio-editable';
    cellPrecio.appendChild(inputPrecio);

    const cellCantidad = filaFactura.insertCell(4);
    const inputCantidad = document.createElement('input');
    inputCantidad.type = 'number';
    inputCantidad.min = 1;
    inputCantidad.value = 1;
    cellCantidad.appendChild(inputCantidad);

    const cellStock = filaFactura.insertCell(5);
    cellStock.textContent = stockActual;

    const cellSubtotal = filaFactura.insertCell(6);
    cellSubtotal.textContent = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

    const cellEliminar = filaFactura.insertCell(7);
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

}