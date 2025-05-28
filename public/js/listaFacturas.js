document.addEventListener('DOMContentLoaded', function() {
    const btnBuscar = document.getElementById('buscar');
    const btnImprimirTotal = document.getElementById('btnImprimirTotal');
    const tableBody = document.querySelector('#facturas-table tbody');

    if (btnBuscar) {
        btnBuscar.addEventListener('click', function() {
            const fechaInicio = document.getElementById('fechaInicio').value;
            const fechaFin = document.getElementById('fechaFin').value;
            console.log('Buscando facturas desde:', fechaInicio, 'hasta:', fechaFin); 
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
        tableBody.innerHTML = ''; 
    } else {
        console.error('El tbody de la tabla de facturas no se encontró.');
    }
});

function cargarFacturas(fechaInicio, fechaFin) {
    console.log('Cargando facturas...'); 
    fetch(`/productos/api/facturas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.json();
        })
        .then(data => {
            console.log('Datos de facturas recibidos:', data); 
            const tableBody = document.querySelector('#facturas-table tbody');
            tableBody.innerHTML = '';
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
    <td class="fecha">${factura.fecha}</td>
    <td class="hora">${factura.hora || '-'}</td>
    <td class="cliente">${factura.nombre_cliente}</td>
    <td class="total">${totalFormateado}</td>
    <td class="metodos-pago">${factura.metodos_pago || 'N/A'}</td>
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
            document.getElementById('total-presupuestos').textContent = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalFacturas);
            addEventListenersFacturas();
        })
        .catch(error => {
            console.error('Error al cargar las facturas:', error);
        });
}


function addEventListenersFacturas() {
    document.querySelectorAll('.btn-ver').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.getAttribute('data-id');
            window.location.href = `/productos/facturaVista/${id}`;
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
function formatearFecha(fechaISO) {
    const [anio, mes, dia] = fechaISO.split('-');
    return `${dia}-${mes}-${anio}`;
}

function imprimirTotalFacturas(fechaInicio, fechaFin) {
    fetch(`/productos/api/facturas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor al obtener las facturas');
            }
            return response.json();
        })
        .then(data => {
            let totalFacturas = 0;
            let cantidadFacturas = data.length;

            data.forEach(factura => {
                const totalNumerico = parseFloat(factura.total.replace('.', '').replace(',', '.'));
                totalFacturas += totalNumerico;
            });

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFontSize(16);
            doc.text('Resumen de Facturas', 14, 20);

            doc.setFontSize(12);
            doc.text(`Rango de fechas: ${formatearFecha(fechaInicio)} a ${formatearFecha(fechaFin)}`, 14, 35);
            doc.text(`Cantidad total de facturas: ${cantidadFacturas}`, 14, 45);

            const totalFormateado = new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS'
            }).format(totalFacturas);

            doc.text(`Total vendido: ${totalFormateado}`, 14, 55);

            doc.save(`resumen_facturas_${fechaInicio}_a_${fechaFin}.pdf`);
        })
        .catch(error => {
            console.error('Error al imprimir total de facturas:', error);
            Swal.fire({
                title: 'Error',
                text: 'No se pudo generar el PDF de total de facturas.',
                icon: 'error',
                confirmButtonText: 'Entendido'
            });
        });
}



document.getElementById('btnImprimir').addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 10; 
    doc.setFontSize(10);

    const posXFecha = 20;       
    const posXCliente = 70;     
    const posXTotal = 120;      
    const posXMetodoPago = 160; 

    // Títulos de las columnas
    doc.text('Fecha', posXFecha, y);
    doc.text('Cliente', posXCliente, y);
    doc.text('Total', posXTotal, y);
    doc.text('Método de Pago', posXMetodoPago, y); // Nueva columna para el método de pago
    y += 5;

    let totalGeneral = 0;

    // Iterar sobre las filas de la tabla de facturas
    document.querySelectorAll('#facturas-table tbody tr').forEach(function(row) {
        const fecha = row.querySelector('.fecha') ? row.querySelector('.fecha').textContent.trim() : 'N/A';
        const cliente = row.querySelector('.cliente') ? row.querySelector('.cliente').textContent.trim() : 'N/A';
        const total = row.querySelector('.total') ? row.querySelector('.total').textContent.trim() : '0.00';
        const metodosPago = row.querySelector('.metodos-pago') ? row.querySelector('.metodos-pago').textContent.trim() : 'N/A'; // Obtener el método de pago

        console.log(`Fecha: ${fecha}, Cliente: ${cliente}, Total: ${total}, Método de Pago: ${metodosPago}`); // Para depuración

        y += 7;
        doc.text(fecha, posXFecha, y); 
        doc.text(cliente, posXCliente, y);
        doc.text(total, posXTotal, y);
        doc.text(metodosPago, posXMetodoPago, y);

        // Sumar al total general
        totalGeneral += parseFloat(total.replace(/[^0-9,-]+/g, "").replace(',', '.'));
    });

    y += 10; 
    const totalText = 'Total General: ' + new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(totalGeneral);
    const textWidth = doc.getTextWidth(totalText);
    const pageWidth = doc.internal.pageSize.getWidth();
    const textX = (pageWidth / 2) + (pageWidth / 4) - (textWidth / 2); 
    doc.text(totalText, textX, y);

    // Guardar el PDF
    doc.save('detalle_ventas.pdf');
});
