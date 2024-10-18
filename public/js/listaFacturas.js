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
            addEventListenersFacturas();
        })
        .catch(error => {
            console.error('Error al cargar las facturas:', error);
        });
}

function addEventListenersFacturas() {
    document.querySelectorAll('.ver-detalle').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            cargarDetallesFactura(id); 
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
function cargarDetallesFactura(id) {
    fetch(`/productos/factura/${id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.json();
        })
        .then(data => {
            const fechaOriginal = new Date(data.factura.fecha); 
            const dia = fechaOriginal.getDate().toString().padStart(2, '0'); 
            const mes = (fechaOriginal.getMonth() + 1).toString().padStart(2, '0'); 
            const año = fechaOriginal.getFullYear().toString().slice(-2); 
            const fechaFormateada = `${dia}/${mes}/${año}`;
            document.getElementById('nombreCliente').textContent = data.factura.nombre_cliente;
            document.getElementById('fechaFactura').textContent = fechaFormateada;
            document.getElementById('totalFactura').textContent = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(data.factura.total);
        
            const productosFactura = document.getElementById('productosFactura');
            productosFactura.innerHTML = '';
            
            if (Array.isArray(data.items) && data.items.length > 0) {
                data.items.forEach(producto => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${producto.nombre_producto}</td>
                        <td>${producto.cantidad}</td>
                        <td>${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(producto.precio_unitario)}</td>
                        <td>${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(producto.subtotal)}</td>
                    `;
                    productosFactura.appendChild(row);
                });
            } else {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="4">No hay productos en esta factura.</td>`;
                productosFactura.appendChild(row);
            }
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
document.getElementById('btnImprimir').addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 10; 
    doc.setFontSize(10);
    
    // Títulos de las columnas
    doc.text('Fecha', 30, y);
    doc.text('Cliente', 90, y);
    doc.text('Total', 150, y);
    doc.text('Método de Pago', 180, y); // Nueva columna para el método de pago
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
        doc.text(fecha, 30, y); 
        doc.text(cliente, 90, y);
        doc.text(total, 150, y);
        doc.text(metodosPago, 180, y); // Agregar el método de pago al PDF
        
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
