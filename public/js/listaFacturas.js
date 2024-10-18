document.addEventListener('DOMContentLoaded', function() {
    const btnBuscar = document.getElementById('buscar');
    const btnImprimirTotal = document.getElementById('btnImprimirTotal');
    const tableBody = document.querySelector('#facturas-table tbody');

    if (btnBuscar) {
        btnBuscar.addEventListener('click', function() {
            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;
            console.log('Buscando facturas desde:', fechaInicio, 'hasta:', fechaFin); // Log de fechas
            cargarFacturas(fechaInicio, fechaFin);
        });
    } else {
        console.error('El botón con ID "buscar" no se encontró en el DOM.');
    }

    if (btnImprimirTotal) {
        btnImprimirTotal.addEventListener('click', function() {
            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;
            console.log('Imprimiendo total de facturas desde:', fechaInicio, 'hasta:', fechaFin); // Log de fechas
            imprimirTotalFacturas(fechaInicio, fechaFin);
        });
    } else {
        console.error('El botón con ID "btnImprimirTotal" no se encontró en el DOM.');
    }

    if (tableBody) {
        tableBody.innerHTML = ''; // Asegura que la tabla esté lista
    } else {
        console.error('El tbody de la tabla de facturas no se encontró.');
    }
});

function cargarFacturas(fechaInicio, fechaFin) {
    console.log('Cargando facturas...'); // Log de inicio de carga
    fetch(`/productos/api/facturas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.json();
        })
        .then(data => {
            console.log('Datos de facturas recibidos:', data); // Log de datos recibidos
            const tableBody = document.querySelector('#facturas-table tbody');
            tableBody.innerHTML = ''; // Limpia el tbody antes de agregar nuevas filas
            let totalFacturas = 0;

            data.forEach(factura => {
                const totalNumerico = parseFloat(factura.total.replace('.', '').replace(',', '.'));
                totalFacturas += totalNumerico;

                const fechaFormateada = factura.fecha; 
                const totalFormateado = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalNumerico);

                const row = document.createElement('tr');
                row.setAttribute('data-id', factura.id);
                row.innerHTML = `
                    <td class="id">${factura.id}</td>
                    <td class="fecha">${fechaFormateada}</td>
                    <td class="cliente">${factura.nombre_cliente}</td>
                    <td class="total">${totalFormateado}</td>
                    <td>
                        <button class="btn-ver ver-detalle" data-id="${factura.id}">Ver Detalle</button>
                        <button class="btn-editar" data-id="${factura.id}">Editar</button>
                        <button class="btn-eliminar" data-id="${factura.id}">Eliminar</button>
                        <button class="btn-guardar" data-id="${factura.id}" style="display:none;">Guardar</button>
                        <button class="btn-cancelar" data-id="${factura.id}" style="display:none;">Cancelar</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });

            document.getElementById('total-presupuestos').textContent = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalFacturas);
            console.log('Total de facturas:', totalFacturas); // Log del total calculado

            // Asignar los eventos a los botones una vez que las facturas se han cargado
            addEventListenersFacturas();
        })
        .catch(error => {
            console.error('Error al cargar las facturas:', error);
        });
}

function addEventListenersFacturas() {
    console.log('Asignando eventos a botones de facturas'); // Log de asignación de eventos
    document.querySelectorAll('.ver-detalle').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            console.log('Ver detalle de factura ID:', id);  // Log del ID de la factura
            
            // Llama a la función para cargar los detalles de la factura
            cargarDetallesFactura(id); // Cambia aquí
        });
    });
    
    document.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            console.log('Habilitando edición de factura ID:', id); // Log del ID de la factura
            habilitarEdicionFactura(id);
        });
    });
    
    document.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            console.log('Eliminando factura ID:', id); // Log del ID de la factura
            eliminarFactura(id);
        });
    });
    
    document.querySelectorAll('.btn-guardar').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            console.log('Guardando cambios de factura ID:', id); // Log del ID de la factura
            guardarCambiosFactura(id);
        });
    });
    
    document.querySelectorAll('.btn-cancelar').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            console.log('Cancelando edición de factura ID:', id); // Log del ID de la factura
            cancelarEdicionFactura(id);
        });
    });
}


function habilitarEdicionFactura(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    row.querySelector('.fecha').innerHTML = `<input type="date" value="${row.querySelector('.fecha').textContent.split('/').reverse().join('-')}">`;
    row.querySelector('.cliente').innerHTML = `<input type="text" value="${row.querySelector('.cliente').textContent}">`;
    row.querySelector('.total').innerHTML = `<input type="text" value="${row.querySelector('.total').textContent.replace(/\./g, '').replace(',', '.')}">`;
    row.querySelector('.btn-editar').style.display = 'none';
    row.querySelector('.btn-eliminar').style.display = 'none';
    row.querySelector('.btn-guardar').style.display = 'inline';
    row.querySelector('.btn-cancelar').style.display = 'inline';
}
function cargarDetallesFactura(id) {
    fetch(`/productos/factura/${id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.json();
        })
        .then(data => {
            console.log('Detalles de factura recibidos:', data); 
            
            // Actualizar los detalles de la factura
            document.getElementById('nombreCliente').textContent = data.nombre_cliente;
            document.getElementById('fechaFactura').textContent = data.fecha;
            document.getElementById('totalFactura').textContent = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(data.total);
            
            const productosFactura = document.getElementById('productosFactura');
            productosFactura.innerHTML = '';  // Limpiar la tabla antes de agregar nuevos datos
            
            // Validar si `data.productos` es un array
            if (Array.isArray(data.productos) && data.productos.length > 0) {
                data.productos.forEach(producto => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${producto.nombre}</td>
                        <td>${producto.cantidad}</td>
                        <td>${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(producto.precio_unitario)}</td>
                        <td>${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(producto.subtotal)}</td>
                    `;
                    productosFactura.appendChild(row);
                });
            } else {
                // Si no hay productos, muestra un mensaje o realiza una acción
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="4">No hay productos en esta factura.</td>`;
                productosFactura.appendChild(row);
            }
            
            // Mostrar el modal
            $('#detalleFacturaModal').modal('show');
        })
        .catch(error => {
            console.error('Error al cargar detalles de la factura:', error);
        });
}


function cancelarEdicionFactura(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const fecha = row.querySelector('.fecha input').value.split('-').reverse().join('/');
    const cliente = row.querySelector('.cliente input').value;
    const total = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0 }).format(row.querySelector('.total input').value.replace(/\./g, '').replace(',', '.'));
    row.querySelector('.fecha').textContent = fecha;
    row.querySelector('.cliente').textContent = cliente;
    row.querySelector('.total').textContent = total;
    row.querySelector('.btn-editar').style.display = 'inline';
    row.querySelector('.btn-eliminar').style.display = 'inline';
    row.querySelector('.btn-guardar').style.display = 'none';
    row.querySelector('.btn-cancelar').style.display = 'none';
}

function guardarCambiosFactura(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const fecha = row.querySelector('.fecha input').value;
    const nombre_cliente = row.querySelector('.cliente input').value;
    const total = parseFloat(row.querySelector('.total input').value.replace(/\./g, '').replace(',', '.'));

    console.log('Guardando cambios:', { id, fecha, nombre_cliente, total }); // Log de datos a guardar

    fetch(`/productos/api/facturas/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fecha, nombre_cliente, total })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Respuesta del servidor no es OK');
        }
        return response.json();
    })
    .then(data => {
        alert('Factura actualizada exitosamente');
        cargarFacturas(document.getElementById('fechaInicio').value, document.getElementById('fechaFin').value);
    })
    .catch(error => {
        alert('Error al actualizar la factura: ' + error.message);
        console.error('Error en guardar cambios:', error); // Log de error
    });
}

function eliminarFactura(id) {
    if (confirm('¿Está seguro de que desea eliminar esta factura?')) {
        fetch(`/productos/api/facturas/${id}`, {
            method: 'DELETE',
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Respuesta del servidor no es OK');
            }
            return response.json();
        })
        .then(data => {
            alert('Factura eliminada exitosamente');
            cargarFacturas(document.getElementById('fechaInicio').value, document.getElementById('fechaFin').value);
        })
        .catch(error => {
            alert('Error al eliminar la factura: ' + error.message);
            console.error('Error en eliminar factura:', error); // Log de error
        });
    }
}

function imprimirTotalFacturas(fechaInicio, fechaFin) {
    fetch(`/productos/api/facturas/total?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor al obtener total');
            }
            return response.json();
        })
        .then(data => {
            console.log('Total de facturas obtenido:', data.total); // Log del total obtenido
            alert(`Total de facturas entre ${fechaInicio} y ${fechaFin}: ${data.total}`);
        })
        .catch(error => {
            console.error('Error al imprimir total de facturas:', error); // Log de error
        });
}

function verDetalleFactura(id) {
    console.log(`Ver detalle de factura ID: ${id}`); // Log del ID de la factura a ver
    fetch(`/productos/api/factura/${id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.json();
        })
        .then(data => {
            console.log('Datos de la factura recibidos:', data); // Log de los datos de la factura
            const factura = data.factura;
            const items = data.items;

            // Llenar el modal con los datos de la factura
            document.getElementById('nombreCliente').textContent = factura.nombre_cliente;
            document.getElementById('fechaFactura').textContent = new Date(factura.fecha).toLocaleDateString('es-CL');
            document.getElementById('totalFactura').textContent = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(factura.total);

            // Llenar la lista de items
            const productosFactura = document.getElementById('productosFactura');
            productosFactura.innerHTML = ''; // Limpiar la tabla antes de llenarla
            items.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.nombre_producto}</td>
                    <td>${item.cantidad}</td>
                    <td>${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.precio_unitario)}</td>
                    <td>${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.subtotal)}</td>
                `;
                productosFactura.appendChild(row);
            });

            // Mostrar el modal
            $('#detalleFacturaModal').modal('show');
        })
        .catch(error => {
            console.error('Error al obtener los detalles de la factura:', error);
            alert('Error al obtener los detalles de la factura.');
        });
}