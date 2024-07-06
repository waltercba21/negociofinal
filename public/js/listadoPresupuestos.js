document.addEventListener('DOMContentLoaded', function() {
    const btnBuscar = document.getElementById('buscar');
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
            console.log('Datos recibidos del backend:', data);  // Añadir este log
            const tableBody = document.querySelector('#presupuestos-table tbody');
            tableBody.innerHTML = ''; 
            let totalPresupuestos = 0;
            data.forEach(presupuesto => {
                // Reemplazar puntos decimales por comas si es necesario
                const totalNumerico = parseFloat(presupuesto.total.replace('.', '').replace(',', '.'));
                totalPresupuestos += totalNumerico;
                const row = document.createElement('tr');
                row.setAttribute('data-id', presupuesto.id);
                row.innerHTML = `
                    <td class="id">${presupuesto.id}</td>
                    <td class="fecha">${presupuesto.fecha}</td>
                    <td class="cliente">${presupuesto.nombre_cliente}</td>
                    <td class="total">${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalNumerico)}</td>
                    <td>
                        <button class="btn-ver" data-id="${presupuesto.id}">Ver Detalle</button>
                        <button class="btn-editar" data-id="${presupuesto.id}">Editar</button>
                        <button class="btn-eliminar" data-id="${presupuesto.id}">Eliminar</button>
                        <button class="btn-guardar" data-id="${presupuesto.id}" style="display:none;">Guardar</button>
                        <button class="btn-cancelar" data-id="${presupuesto.id}" style="display:none;">Cancelar</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            addEventListeners();
            document.getElementById('total-presupuestos').textContent = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalPresupuestos);
        })
        .catch(error => console.error('Error al cargar los presupuestos:', error));
}

function addEventListeners() {
    document.querySelectorAll('.btn-ver').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            window.location.href = `/productos/presupuesto/${id}`;
        });
    });
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
    const items = Array.from(document.querySelectorAll(`tr[data-id="${id}"] .item-row`)).map(itemRow => ({
        id: itemRow.dataset.id,
        producto_id: itemRow.querySelector('.producto_id input').value,
        cantidad: itemRow.querySelector('.cantidad input').value,
        precio_unitario: itemRow.querySelector('.precio_unitario input').value,
        subtotal: itemRow.querySelector('.subtotal input').value
    }));

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
        alert('Error al actualizar el presupuesto: ' + error.message);
    });
} 
function eliminarPresupuesto(id) {
    if (confirm('¿Está seguro de que desea eliminar este presupuesto?')) {
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
            alert('Error al eliminar el presupuesto: ' + error.message);
        });
    }
}
document.getElementById('btnImprimir').addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let y = 10; // Posición inicial en el eje y para los elementos en el PDF.
    const table = document.getElementById('presupuestos-table');
    doc.text('Listado de Presupuestos', 14, y);
    y += 10;

    // Agregar los títulos de las columnas
    doc.setFontSize(10);
    doc.text('ID', 14, y);
    doc.text('Fecha', 50, y);
    doc.text('Cliente', 80, y);
    doc.text('Total', 140, y);
    y += 5;

    // Agregar los datos de cada fila
    document.querySelectorAll('#presupuestos-table tbody tr').forEach(function(row) {
        const id = row.querySelector('.id').textContent;
        const fecha = row.querySelector('.fecha').textContent;
        const cliente = row.querySelector('.cliente').textContent;
        const total = row.querySelector('.total').textContent;
        y += 7;
        doc.text(id, 14, y);
        doc.text(fecha, 50, y);
        doc.text(cliente, 80, y);
        doc.text(total, 140, y);
    });

    // Guardar el documento PDF
    doc.save('listado_presupuestos.pdf');
});
