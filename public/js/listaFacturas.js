document.addEventListener('DOMContentLoaded', function() {
    const btnBuscar = document.getElementById('buscar');
    const btnImprimirTotal = document.getElementById('btnImprimirTotal');
    const tableBody = document.querySelector('#facturas-table tbody');

    if (btnBuscar) {
        btnBuscar.addEventListener('click', function() {
            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;
            cargarFacturas(fechaInicio, fechaFin);
        });
    } else {
        console.error('El botón con ID "buscar" no se encontró en el DOM.');
    }

    if (btnImprimirTotal) {
        btnImprimirTotal.addEventListener('click', function() {
            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;
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
    fetch(`/productos/api/facturas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
        .then(response => response.json())
        .then(data => {
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

            // Asignar los eventos a los botones una vez que las facturas se han cargado
            addEventListenersFacturas();
        })
        .catch(error => console.error('Error al cargar las facturas:', error));
}

function addEventListenersFacturas() {
    document.querySelectorAll('.btn-ver').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            window.location.href = `/productos/factura/${id}`;
        });
    });
    document.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            habilitarEdicionFactura(id);
        });
    });
    document.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            eliminarFactura(id);
        });
    });
    document.querySelectorAll('.btn-guardar').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            guardarCambiosFactura(id);
        });
    });
    document.querySelectorAll('.btn-cancelar').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
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
        });
    }
}

$.ajax({
    url: `/factura/${facturaId}`,  // Llamada a tu ruta de la factura
    method: 'GET',
    success: function(response) {
        console.log(response);  // Verifica la respuesta

        if (response.factura && response.items.length > 0) {
            // Llenar los detalles de la factura
            $('#nombreCliente').text(response.factura.nombre_cliente);
            $('#fechaFactura').text(response.factura.fecha.split('T')[0]);  // Ajustar el formato de la fecha
            $('#totalFactura').text('$' + response.factura.total);

            // Limpiar la tabla de productos antes de llenarla
            $('#productosFactura').empty();

            // Agregar cada producto a la tabla
            response.items.forEach(function(item) {
                $('#productosFactura').append(`
                    <tr>
                        <td>${item.nombre_producto}</td>
                        <td>${item.cantidad}</td>
                        <td>$${item.precio_unitario}</td>
                        <td>$${item.subtotal}</td>
                    </tr>
                `);
            });

            // Mostrar el modal
            $('#detalleFacturaModal').modal('show');
        } else {
            alert('Factura no encontrada');
        }
    },
    error: function(error) {
        console.error('Error al obtener los detalles de la factura:', error);
        alert('Error al obtener los detalles de la factura');
    }
});
