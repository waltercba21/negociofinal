document.addEventListener('DOMContentLoaded', (event) => {
    filtrarFacturas();
});

document.getElementById('filterForm').addEventListener('submit', function(event) {
    event.preventDefault();
    filtrarFacturas();
});
function convertirFechaInput(fechaInput) {
    if (!fechaInput) {
        return '';
    }
    var partes = fechaInput.split('-');
    var fecha = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));
    return fecha.toISOString().split('T')[0];
}
function parseDate(dateString) {
    var date = new Date(dateString + 'T00:00:00Z');
    return `${date.getUTCDate().toString().padStart(2, '0')}/${(date.getUTCMonth()+1).toString().padStart(2, '0')}/${date.getUTCFullYear()}`;
}

function filtrarFacturas() {
    var proveedor = document.getElementById('proveedor').value;
    var proveedor = document.getElementById('proveedor').value;
    var fechaFactura = convertirFechaInput(document.getElementById('fechaFactura').value);
    var fechaPago = convertirFechaInput(document.getElementById('fechaPago').value);
    var condicion = document.getElementById('condicion').value;
    var fechaDesde = convertirFechaInput(document.getElementById('fechaDesde').value);
    var fechaHasta = convertirFechaInput(document.getElementById('fechaHasta').value);
    var alertBox = document.getElementById('alertBox');


    

    while (alertBox.firstChild) {
        alertBox.removeChild(alertBox.firstChild);
    }
    fetch('/administracion/api/facturas', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            proveedor: proveedor,
            fechaFactura: fechaFactura,
            fechaPago: fechaPago,
            condicion: condicion,
            fechaDesde: fechaDesde, 
            fechaHasta: fechaHasta
        })
    })
    .then(response => response.json())
    .then(data => {
        var tbody = document.querySelector('tbody');

        while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
        }

        data.forEach(function(factura) {
            var tr = document.createElement('tr');
        
            var fechaFacturaFormateada = parseDate(factura.fecha);
            var fechaPagoFormateada = parseDate(factura.fecha_pago);
        
            // Comprobar si faltan 7 días o menos para la fecha de pago y la factura está pendiente
            var hoy = new Date();
            hoy.setHours(0,0,0,0); // Asegurarse de que la hora es 00:00:00
            var diferenciaDias = Math.ceil((fechaPago - hoy) / (1000 * 60 * 60 * 24));
            console.log('Diferencia de días: ', diferenciaDias, ' Condición: ', factura.condicion); // Agregado para depuración
            if (diferenciaDias <= 7 && factura.condicion === 'pendiente') {
                var mensaje = 'Faltan ' + diferenciaDias + ' días para la fecha de pago de la factura ' + factura.id;
                var alerta = document.createElement('div');
                alerta.textContent = mensaje;
                alerta.style.color = 'red';
                alerta.style.fontWeight = 'bold';
                alertBox.appendChild(alerta);
            }
            tr.innerHTML = `
                <td>${factura.id}</td>
                <td>${factura.nombre_proveedor}</td>
                <td>${fechaFacturaFormateada}</td>
                <td>${factura.numero_factura}</td>
                <td>${fechaPagoFormateada}</td>
                <td>${factura.importe}</td>
                <td>${factura.condicion}</td>
                <td><img id="myImg" src="/uploads/comprobantes/${factura.comprobante_pago}" alt="Comprobante de pago" onclick="openModal(this)"></td>
                <td>
                <button class="btn-modificar" onclick="location.href='/administracion/facturas/modificar/${factura.id}'">Modificar</button>
                <form action="/administracion/facturas/eliminar/${factura.id}" method="post" style="display: inline;">
                    <button type="submit" class="btn-eliminar">Eliminar</button>
                </form>
            </td>
            `;

            tbody.appendChild(tr);
        }); 
    })
    .catch(error => console.error('Error:', error));
}

function openModal(img) {
    var modal = document.getElementById("myModal");
    var modalImg = document.getElementById("img01");
    modal.style.display = "block";
    modalImg.src = img.src;

    var span = document.getElementsByClassName("close")[0];
    span.onclick = function() { 
        modal.style.display = "none";
    }
}