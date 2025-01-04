document.getElementById('invoice-form').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        return false;
    }
});

document.getElementById('invoice-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Recopilar los datos de la tabla de productos
    const invoiceItems = [];
    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    for (let i = 0; i < filasFactura.length; i++) {
        const codigo = filasFactura[i].cells[1].textContent.trim();
        const descripcion = filasFactura[i].cells[2].textContent.trim();
        const precioInput = filasFactura[i].cells[3].querySelector('input').value;
        let precio_unitario = parseFloat(precioInput.replace(/\$|\./g, '').replace(',', '.').trim());
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

    // Recopilar los datos del formulario
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

    // Enviar los datos al servidor
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
    // Alerta inicial
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
    const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];

    // Verificar si el producto ya existe en la tabla
    if (productoYaExisteEnTabla(tablaFactura, codigoProducto)) {
        Swal.fire({
            title: 'Producto Duplicado',
            text: 'Este producto ya ha sido añadido a la lista.',
            icon: 'warning',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    // Si no existe, proceder a agregar la fila
    const filaFactura = tablaFactura.insertRow();
    const cellImagen = filaFactura.insertCell(0);
    const cellCodigo = filaFactura.insertCell(1);
    const cellNombre = filaFactura.insertCell(2);
    const cellPrecio = filaFactura.insertCell(3);
    const cellCantidad = filaFactura.insertCell(4);
    const cellStock = filaFactura.insertCell(5);
    const cellSubtotal = filaFactura.insertCell(6);
    const cellEliminar = filaFactura.insertCell(7);

    if (imagenProducto) {
        const imagen = document.createElement('img');
        imagen.src = imagenProducto;
        imagen.classList.add('miniatura-tabla');
        cellImagen.appendChild(imagen);
    }

    cellCodigo.textContent = codigoProducto;
    cellNombre.textContent = nombreProducto;

    const inputPrecio = document.createElement('input');
    inputPrecio.type = 'text';
    inputPrecio.value = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    inputPrecio.className = 'precio-editable';
    inputPrecio.oninput = () => updateSubtotal(filaFactura, false);
    cellPrecio.appendChild(inputPrecio);

    const inputCantidad = document.createElement('input');
    inputCantidad.type = 'number';
    inputCantidad.min = 1;
    inputCantidad.value = 1;
    inputCantidad.oninput = () => updateSubtotal(filaFactura);
    cellCantidad.appendChild(inputCantidad);

    cellStock.textContent = stockActual;
    cellSubtotal.textContent = inputPrecio.value;

    const botonEliminar = document.createElement('button');
    botonEliminar.textContent = '✖';
    botonEliminar.className = 'boton-eliminar';
    botonEliminar.onclick = () => {
        tablaFactura.deleteRow(filaFactura.rowIndex - 1);
        calcularTotal();
    };
    cellEliminar.appendChild(botonEliminar);

    calcularTotal();
}

function productoYaExisteEnTabla(tablaFactura, codigoProducto) {
    return Array.from(tablaFactura.rows).some(row => row.cells[1].textContent.trim().toUpperCase() === codigoProducto.trim().toUpperCase());
}

function updateSubtotal(row, verificarStock = true) {
    const precio = parseFloat(row.cells[3].querySelector('input').value.replace(/[^0-9,-]/g, '').replace(',', '.'));
    const cantidad = parseInt(row.cells[4].querySelector('input').value);
    const stockActual = parseInt(row.cells[5].textContent.replace(/\D/g, ''));
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
        let subtotal = parseFloat(filasFactura[i].cells[6].textContent.replace(/[^0-9,-]/g, '').replace(',', '.'));
        subtotal = !isNaN(subtotal) ? subtotal : 0;
        total += subtotal;
    }

    document.getElementById('total-amount').value = total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}