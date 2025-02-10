// Mostrar formulario de facturas
document.getElementById('mostrarFormulario').addEventListener('click', function () {
    var formulario = document.getElementById('formularioFacturas');
    var fondoOscuro = document.getElementById('fondoOscuro');
    formulario.style.display = 'block';
    fondoOscuro.style.display = 'flex'; // Cambiado a 'flex' para centrar
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

    const url = '/productos/api/buscar?q=' + encodeURIComponent(busqueda);
    const respuesta = await fetch(url);
    const productos = await respuesta.json();

    productos.forEach((producto) => {
        const resultado = document.createElement('div');
        resultado.textContent = producto.nombre;
        resultado.classList.add('resultado-busqueda');
        
        resultado.addEventListener('click', () => {
            resultadosBusqueda.innerHTML = '';

            // Verificar si el producto ya está en la tabla
            const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
            const filas = Array.from(tablaFactura.rows);
            const existe = filas.some(row => row.dataset.productoId === String(producto.id));

            if (existe) {
                Swal.fire({
                    title: 'Error',
                    text: 'Este producto ya ha sido agregado',
                    icon: 'warning',
                    confirmButtonText: 'Entendido'
                });
                return;
            }

            // Crear nueva fila con producto
            const filaFactura = tablaFactura.insertRow();
            filaFactura.dataset.productoId = producto.id; 
            filaFactura.insertCell(0).textContent = producto.codigo;
            filaFactura.insertCell(1).textContent = producto.nombre;

            // Input para cantidad
            const cellCantidad = filaFactura.insertCell(2);
            const inputCantidad = document.createElement('input');
            inputCantidad.type = 'number';
            inputCantidad.min = 1;
            inputCantidad.value = 1;
            inputCantidad.classList.add('input-cantidad'); 
            cellCantidad.appendChild(inputCantidad);

            // Botón eliminar
            const cellEliminar = filaFactura.insertCell(3);
            const botonEliminar = document.createElement('button');
            botonEliminar.textContent = '✖';
            botonEliminar.className = 'boton-eliminar';
            botonEliminar.addEventListener('click', function () {
                filaFactura.remove();
            });
            cellEliminar.appendChild(botonEliminar);
        });

        resultadosBusqueda.appendChild(resultado);
    });
});


document.getElementById('formularioFacturas').addEventListener('submit', async function (e) {
    e.preventDefault();
    
    const invoiceItems = [];
    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    
    for (let i = 0; i < filasFactura.length; i++) {
        const productoId = filasFactura[i].dataset.productoId;
        const descripcion = filasFactura[i].cells[1].textContent.trim();
        const cantidad = parseInt(filasFactura[i].cells[2].querySelector('input').value);
        
        if (productoId && descripcion && !isNaN(cantidad)) {
            invoiceItems.push({
                id: productoId,
                descripcion: descripcion,
                cantidad: cantidad
            });
        }
    }

    console.log("Contenido de invoiceItems antes de enviar:", invoiceItems);

    const formData = new FormData(this);
    formData.delete('invoiceItems'); // Eliminamos cualquier rastro previo
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
            throw new Error(data.message);
        }
    } catch (error) {
        Swal.fire({
            title: 'Error',
            text: error.message || 'Hubo un problema al procesar la solicitud',
            icon: 'error',
            confirmButtonText: 'Reintentar'
        });
    }
});
