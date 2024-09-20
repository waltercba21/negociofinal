document.addEventListener('DOMContentLoaded', function() {
    const btnBuscar = document.getElementById('buscar');
    const btnImprimirTotal = document.getElementById('btnImprimirTotal');

    if (btnBuscar) {
        btnBuscar.addEventListener('click', function() {
            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;
            cargarFacturas(fechaInicio, fechaFin);
        });
    } else {
        console.error('El elemento con ID "buscar" no se encontró en el DOM.');
    }

    if (btnImprimirTotal) {
        btnImprimirTotal.addEventListener('click', function() {
            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;
            imprimirTotalFacturas(fechaInicio, fechaFin);
        });
    } else {
        console.error('El elemento con ID "btnImprimirTotal" no se encontró en el DOM.');
    }
});

function imprimirTotalFacturas(fechaInicio, fechaFin) {
    fetch(`/api/facturas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
        .then(response => response.json())
        .then(data => {
            let totalFacturas = 0;
            data.forEach(factura => {
                const totalNumerico = parseFloat(factura.total.replace('.', '').replace(',', '.'));
                totalFacturas += totalNumerico;
            });

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text('Total de Facturas', 14, 20);
            const totalText = 'Total: ' + new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalFacturas);
            doc.text(totalText, 14, 40);
            doc.save('total_facturas.pdf');
        })
        .catch(error => console.error('Error al cargar las facturas:', error));
}

function cargarFacturas(fechaInicio, fechaFin) {
    fetch(`/api/facturas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
        .then(response => response.json())
        .then(data => {
            console.log('Datos recibidos del backend:', data);
            const tableBody = document.querySelector('#facturas-table tbody');
            tableBody.innerHTML = ''; 
            let totalFacturas = 0;
            data.forEach(factura => {
                const totalNumerico = parseFloat(factura.total.replace('.', '').replace(',', '.'));
                totalFacturas += totalNumerico;
                const row = document.createElement('tr');
                row.setAttribute('data-id', factura.id);
                row.innerHTML = `
                    <td class="id">${factura.id}</td>
                    <td class="fecha">${factura.fecha}</td>
                    <td class="cliente">${factura.nombre_cliente}</td>
                    <td class="total">${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalNumerico)}</td>
                    <td>
                        <button class="btn-ver" data-id="${factura.id}">Ver Detalle</button>
                        <button class="btn-editar" data-id="${factura.id}">Editar</button>
                        <button class="btn-eliminar" data-id="${factura.id}">Eliminar</button>
                        <button class="btn-guardar" data-id="${factura.id}" style="display:none;">Guardar</button>
                        <button class="btn-cancelar" data-id="${factura.id}" style="display:none;">Cancelar</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            addEventListeners();
            document.getElementById('total-facturas').textContent = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalFacturas);
        })
        .catch(error => console.error('Error al cargar las facturas:', error));
}

function addEventListeners() {
    document.querySelectorAll('.btn-ver').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            window.location.href = `/factura/${id}`;
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
            eliminarFactura(id);
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

    fetch(`/api/facturas/${id}`, {
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
        fetch(`/api/facturas/${id}`, {
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

document.getElementById('btnImprimir').addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 10; // posición inicial en y

    // Agregar encabezado
    doc.setFontSize(18);
    doc.text('Lista de Facturas', 10, y);
    y += 10;

    // Agregar tabla de facturas
    const table = document.getElementById('facturas-table');
    const rows = table.getElementsByTagName('tr');

    Array.from(rows).forEach(row => {
        const cells = row.getElementsByTagName('td');
        const cellData = Array.from(cells).map(cell => cell.textContent);
        doc.text(cellData.join(' | '), 10, y);
        y += 10;
    });

    doc.save('facturas.pdf');
});
