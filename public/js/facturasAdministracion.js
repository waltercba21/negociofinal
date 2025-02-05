// Mostrar formulario de facturas
document.getElementById('mostrarFormulario').addEventListener('click', function () {
    document.getElementById('formularioFacturas').style.display = 'block';
    document.getElementById('fondoOscuro').style.display = 'flex';
});

// Cerrar formulario de facturas
document.getElementById('cerrarFormulario').addEventListener('click', function () {
    document.getElementById('formularioFacturas').style.display = 'none';
    document.getElementById('fondoOscuro').style.display = 'none';
});

// Funcionalidad de agregar productos a la tabla
document.getElementById('entradaBusqueda').addEventListener('input', async (e) => {
    const busqueda = e.target.value;
    const resultadosBusqueda = document.getElementById('resultadosBusqueda');
    resultadosBusqueda.innerHTML = '';

    if (!busqueda.trim()) return;

    const url = '/productos/api/buscar?q=' + busqueda;
    const respuesta = await fetch(url);
    const productos = await respuesta.json();

    productos.forEach((producto) => {
        const resultado = document.createElement('div');
        resultado.textContent = producto.nombre;
        resultado.classList.add('resultado-busqueda');

        resultado.addEventListener('click', () => {
            resultadosBusqueda.innerHTML = '';
            const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0]; // Acceder al tbody
            const filaFactura = tablaFactura.insertRow();
            filaFactura.dataset.productoId = producto.id;
            filaFactura.insertCell(0).textContent = producto.codigo;
            filaFactura.insertCell(1).textContent = producto.nombre;

            // Columna de cantidad con input
            const cellCantidad = filaFactura.insertCell(2);
            const inputCantidad = document.createElement('input');
            inputCantidad.type = 'number';
            inputCantidad.min = 1;
            inputCantidad.value = 1;
            cellCantidad.appendChild(inputCantidad);

            // Columna de eliminar con botón
            const cellEliminar = filaFactura.insertCell(3);
            const botonEliminar = document.createElement('button');
            botonEliminar.textContent = '✖';
            botonEliminar.className = 'boton-eliminar';
            botonEliminar.addEventListener('click', function () {
                const rowToDelete = filaFactura;
                const indexToRemove = Array.from(tablaFactura.rows).indexOf(rowToDelete); // Obtener índice *antes* de eliminar
                rowToDelete.remove(); // Eliminar la fila *después* de obtener el índice.
                if (indexToRemove > -1) {
                    invoiceItems.splice(indexToRemove, 1); // Usar el índice para eliminar del array
                }
                console.log('invoiceItems despues de borrar', invoiceItems);
            });
            cellEliminar.appendChild(botonEliminar);
        });

        resultadosBusqueda.appendChild(resultado);
    });
});

document.getElementById('formularioFacturas').addEventListener('submit', async function (e) {
    e.preventDefault();

    const invoiceItems = []; // ¡CORRECCIÓN: Inicializa el array como []!

    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows; // Acceder al tbody y a las filas

    for (let i = 0; i < filasFactura.length; i++) {
        const productoId = filasFactura[i].dataset.productoId;
        const descripcion = filasFactura[i].cells[1].textContent.trim();  // Acceder al texto de la celda 1
        const cantidad = parseInt(filasFactura[i].cells[2].querySelector('input').value); // Acceder al valor del input

        if (productoId && descripcion && !isNaN(cantidad) && productoId !== undefined && cantidad !== undefined) {
            invoiceItems.push({
                id: productoId,
                descripcion: descripcion,
                cantidad: cantidad
            });
        } else {
            console.error("Datos de producto inválidos:", productoId, cantidad, descripcion); // Incluir descripción en el error
            // Puedes mostrar un mensaje de error al usuario también
        }
    }

    console.log("invoiceItems antes de enviar:", invoiceItems);

    const formData = new FormData(this);
    formData.append('invoiceItems', JSON.stringify(invoiceItems));

    try {
        const response = await fetch('/administracion/facturas', {
            method: 'POST',
            body: formData
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
            const errorData = await response.json(); // Obtener mensaje de error del servidor
            throw new Error(errorData.message || data.message || 'Error en el servidor');
        }
    } catch (error) {
        console.error("Error en la petición:", error);
        Swal.fire({
            title: 'Error',
            text: error.message || 'Hubo un problema al procesar la solicitud',
            icon: 'error',
            confirmButtonText: 'Reintentar'
        });
    }
});