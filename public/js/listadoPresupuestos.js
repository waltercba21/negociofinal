document.addEventListener('DOMContentLoaded', function() {
    const btnBuscar = document.getElementById('buscar');
    const btnImprimirTotal = document.getElementById('btnImprimirTotal');


    if (btnBuscar) {
        btnBuscar.addEventListener('click', function() {
            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;
            cargarPresupuestos(fechaInicio, fechaFin);
        });
    } else {
        console.error('El elemento con ID "buscar" no se encontró en el DOM.');
    }

    if (btnImprimirTotal) {
        btnImprimirTotal.addEventListener('click', function() {
            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;
            imprimirTotalPresupuestos(fechaInicio, fechaFin);
        });
    } else {
        console.error('El elemento con ID "btnImprimirTotal" no se encontró en el DOM.');
    }
});
function formatearFecha(fechaISO) {
    const [anio, mes, dia] = fechaISO.split('-');
    return `${dia}-${mes}-${anio}`;
}

function imprimirTotalPresupuestos(fechaInicio, fechaFin) {
    fetch(`/productos/api/presupuestos?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor al obtener los presupuestos');
            }
            return response.json();
        })
        .then(data => {
            let totalPresupuestos = 0;
            const cantidadPresupuestos = data.length;

            data.forEach(presupuesto => {
                const totalNumerico = parseFloat(presupuesto.total.replace('.', '').replace(',', '.'));
                totalPresupuestos += totalNumerico;
            });

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFontSize(16);
            doc.text('Resumen de Presupuestos', 14, 20);

            doc.setFontSize(12);
            doc.text(`Rango de fechas: ${formatearFecha(fechaInicio)} a ${formatearFecha(fechaFin)}`, 14, 35);

            doc.text(`Cantidad total de presupuestos: ${cantidadPresupuestos}`, 14, 45);

            const totalFormateado = new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS'
            }).format(totalPresupuestos);

            doc.text(`Total presupuestado: ${totalFormateado}`, 14, 55);

            doc.save(`resumen_presupuestos_${fechaInicio}_a_${fechaFin}.pdf`);
        })
        .catch(error => {
            console.error('Error al generar el PDF de presupuestos:', error);
            Swal.fire({
                title: 'Error',
                text: 'No se pudo generar el PDF de total de presupuestos.',
                icon: 'error',
                confirmButtonText: 'Entendido'
            });
        });
}

function cargarPresupuestos(fechaInicio, fechaFin) {
    fetch(`/productos/api/presupuestos?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector('#presupuestos-table tbody');
            tableBody.innerHTML = ''; 
            let totalPresupuestos = 0;
            data.forEach(presupuesto => {
                const totalNumerico = parseFloat(presupuesto.total.replace('.', '').replace(',', '.'));
                totalPresupuestos += totalNumerico;
                const row = document.createElement('tr');
                row.setAttribute('data-id', presupuesto.id);
                row.innerHTML = `
                    <td class="id">${presupuesto.id}</td>
                    <td class="fecha">${presupuesto.fecha}</td>
                    <td class="hora">${presupuesto.hora}</td>
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
document.getElementById('btnImprimir').addEventListener('click', function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 10;
    const salto = 7;
    const margenInferior = 280;

    doc.setFontSize(10);
    doc.text('ID', 14, y);
    doc.text('Fecha', 50, y);
    doc.text('Cliente', 80, y);
    doc.text('Total', 140, y);
    y += 5;

    let totalGeneral = 0;

    document.querySelectorAll('#presupuestos-table tbody tr').forEach(function (row, index) {
        if (y + salto > margenInferior) {
            doc.addPage();
            y = 10;
            doc.setFontSize(10);
            doc.text('ID', 14, y);
            doc.text('Fecha', 50, y);
            doc.text('Cliente', 80, y);
            doc.text('Total', 140, y);
            y += 5;
        }

        const id = row.querySelector('.id').textContent;
        const fecha = row.querySelector('.fecha').textContent;
        const cliente = row.querySelector('.cliente').textContent;
        const total = row.querySelector('.total').textContent;

        y += salto;
        doc.text(id, 14, y);
        doc.text(fecha, 50, y);
        doc.text(cliente, 80, y);
        doc.text(total, 140, y);

        totalGeneral += parseFloat(total.replace(/[^0-9,-]+/g, "").replace(',', '.'));
    });

    y += 10;
    const totalText = 'Total: ' + new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalGeneral);
    const textWidth = doc.getTextWidth(totalText);
    const pageWidth = doc.internal.pageSize.getWidth();
    const textX = (pageWidth - textWidth) / 2;
    doc.text(totalText, textX, y);

    doc.save('listado_presupuestos.pdf');
});




