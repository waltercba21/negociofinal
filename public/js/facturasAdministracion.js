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
            const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
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
                const indexToRemove = Array.from(tablaFactura.rows).indexOf(rowToDelete);
                rowToDelete.remove();
                if (indexToRemove > -1) {
                    invoiceItems.splice(indexToRemove, 1);
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

    const invoiceItems = []; // Inicializar el array aquí

    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;

    for (let i = 0; i < filasFactura.length; i++) {
        const productoId = filasFactura[i].dataset.productoId;
        const descripcion = filasFactura[i].cells[1].textContent.trim();
        const cantidad = parseInt(filasFactura[i].cells[2].querySelector('input').value);

        if (productoId && descripcion && !isNaN(cantidad) && productoId !== undefined && cantidad !== undefined) {
            invoiceItems.push({
                id: productoId,
                descripcion: descripcion,
                cantidad: cantidad
            });
        } else {
            console.error("Datos de producto inválidos:", productoId, cantidad, descripcion);
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

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error en el servidor');
        }

        const data = await response.json();
        Swal.fire({
            title: '¡Éxito!',
            text: data.message,
            icon: 'success',
            confirmButtonText: 'Entendido'
        }).then(() => {
            window.location.reload();
        });


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