document.addEventListener('DOMContentLoaded', function() {
    const btnBuscar = document.getElementById('buscar');
    console.log('btnBuscar:', btnBuscar); // Verifica si el elemento está presente
    if (btnBuscar) {
        btnBuscar.addEventListener('click', function() {
            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;
            cargarPresupuestos(fechaInicio, fechaFin);
        });
    } else {
        console.error('El elemento con ID "buscar" no se encontró en el DOM.');
    }
});

function cargarPresupuestos(fechaInicio, fechaFin) {
    fetch(`/productos/api/presupuestos?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector('#presupuestos-table tbody');
            tableBody.innerHTML = '';  // Limpia la tabla antes de agregar nuevos datos
            let totalPresupuestos = 0;

            data.forEach(presupuesto => {
                totalPresupuestos += parseFloat(presupuesto.total.replace(/\./g, '').replace(',', '.'));
                const row = `
                    <tr data-id="${presupuesto.id}">
                        <td class="id">${presupuesto.id}</td>
                        <td class="fecha">${presupuesto.fecha}</td>
                        <td class="cliente">${presupuesto.nombre_cliente}</td>
                        <td class="total">${presupuesto.total}</td>
                        <td>
                            <button class="btn-editar" data-id="${presupuesto.id}">Editar</button>
                            <button class="btn-eliminar" data-id="${presupuesto.id}">Eliminar</button>
                            <button class="btn-guardar" data-id="${presupuesto.id}" style="display:none;">Guardar</button>
                            <button class="btn-cancelar" data-id="${presupuesto.id}" style="display:none;">Cancelar</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });

            // Actualiza el total de presupuestos
            document.getElementById('total-presupuestos').textContent = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0 }).format(totalPresupuestos);

            // Agrega eventos a los botones de edición y eliminación
            document.querySelectorAll('.btn-editar').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    habilitarEdicion(id);
                });
            });

            document.querySelectorAll('.btn-eliminar').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    eliminarPresupuesto(id);
                });
            });

            document.querySelectorAll('.btn-guardar').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    guardarCambios(id);
                });
            });

            document.querySelectorAll('.btn-cancelar').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.getAttribute('data-id');
                    cancelarEdicion(id);
                });
            });
        })
        .catch(error => console.error('Error al cargar los presupuestos:', error));
}

function habilitarEdicion(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    row.querySelector('.fecha').innerHTML = `<input type="date" value="${row.querySelector('.fecha').textContent.split('/').reverse().join('-')}">`;
    row.querySelector('.cliente').innerHTML = `<input type="text" value="${row.querySelector('.cliente').textContent}">`;
    row.querySelector('.total').innerHTML = `<input type="text" value="${row.querySelector('.total').textContent.replace(/\./g, '').replace(',', '.')}">`;

    row.querySelector('.btn-editar').style.display = 'none';
    row.querySelector('.btn-eliminar').style.display = 'none';
    row.querySelector('.btn-guardar').style.display = 'inline';
    row.querySelector('.btn-cancelar').style.display = 'inline';
}

function cancelarEdicion(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const fecha = row.querySelector('.fecha input').value.split('-').reverse().join('/');
    const cliente = row.querySelector('.cliente input').value;
    const total = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0 }).format(row.querySelector('.total input').value.replace('.', '').replace(',', '.'));

    row.querySelector('.fecha').textContent = fecha;
    row.querySelector('.cliente').textContent = cliente;
    row.querySelector('.total').textContent = total;

    row.querySelector('.btn-editar').style.display = 'inline';
    row.querySelector('.btn-eliminar').style.display = 'inline';
    row.querySelector('.btn-guardar').style.display = 'none';
    row.querySelector('.btn-cancelar').style.display = 'none';
}

function guardarCambios(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const fecha = row.querySelector('.fecha input').value;
    const nombre_cliente = row.querySelector('.cliente input').value;
    const total = parseFloat(row.querySelector('.total input').value.replace(/\./g, '').replace(',', '.'));

    // Aquí debes añadir la lógica para obtener los items editados
    const items = Array.from(document.querySelectorAll(`tr[data-id="${id}"] .item-row`)).map(itemRow => ({
        id: itemRow.dataset.id,
        producto_id: itemRow.querySelector('.producto_id input').value,
        cantidad: itemRow.querySelector('.cantidad input').value,
        precio_unitario: itemRow.querySelector('.precio_unitario input').value,
        subtotal: itemRow.querySelector('.subtotal input').value
    }));

    // Log de datos que se enviarán para edición
    console.log('Datos enviados para edición:', { fecha, nombre_cliente, total, items });

    fetch(`/productos/api/presupuestos/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fecha, nombre_cliente, total, items })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Respuesta del servidor no es OK');
        }
        return response.json();
    })
    .then(data => {
        alert('Presupuesto actualizado exitosamente');
        cargarPresupuestos(document.getElementById('fechaInicio').value, document.getElementById('fechaFin').value);
    })
    .catch(error => {
        console.error('Error al actualizar el presupuesto:', error);
        alert('Error al actualizar el presupuesto: ' + error.message);
    });
}

function eliminarPresupuesto(id) {
    if (confirm('¿Está seguro de que desea eliminar este presupuesto?')) {
        // Log de ID que se enviará para eliminar
        console.log('ID enviado para eliminar:', id);

        fetch(`/productos/api/presupuestos/${id}`, {
            method: 'DELETE',
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Respuesta del servidor no es OK');
            }
            return response.json();
        })
        .then(data => {
            alert('Presupuesto eliminado exitosamente');
            cargarPresupuestos(document.getElementById('fechaInicio').value, document.getElementById('fechaFin').value);
        })
        .catch(error => {
            console.error('Error al eliminar el presupuesto:', error);
            alert('Error al eliminar el presupuesto: ' + error.message);
        });
    }
}
