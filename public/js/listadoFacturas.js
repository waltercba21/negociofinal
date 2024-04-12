document.getElementById('filterForm').addEventListener('submit', function(event) {
    event.preventDefault();

    var proveedor = document.getElementById('proveedor').value;
    var fechaFactura = document.getElementById('fechaFactura').value;
    var fechaPago = document.getElementById('fechaPago').value;
    var condicion = document.getElementById('condicion').value;

    fetch('/administracion/api/facturas', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            proveedor: proveedor,
            fechaFactura: fechaFactura,
            fechaPago: fechaPago,
            condicion: condicion
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
        
            var fechaFacturaFormateada = '';
            if (factura.fecha) {
                var fechaFactura = parseDate(factura.fecha);
                if (fechaFactura) {
                    fechaFacturaFormateada = `${fechaFactura.getDate().toString().padStart(2, '0')}/${(fechaFactura.getMonth()+1).toString().padStart(2, '0')}/${fechaFactura.getFullYear()}`;
                }
            }
        
            var fechaPagoFormateada = '';
            if (factura.fecha_pago) {
                var fechaPago = parseDate(factura.fecha_pago);
                if (fechaPago) {
                    fechaPagoFormateada = `${fechaPago.getDate().toString().padStart(2, '0')}/${(fechaPago.getMonth()+1).toString().padStart(2, '0')}/${fechaPago.getFullYear()}`;
                }
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
            `;
        
            tbody.appendChild(tr);
        }); 
    })
    .catch(error => console.error('Error:', error));
});

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

function parseDate(dateString) {
    // Intenta parsear la fecha con el formato 'YYYY-MM-DD'
    var parts = dateString.split('-');
    if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    // Si eso falla, intenta parsear la fecha con el formato 'MM/DD/YYYY'
    parts = dateString.split('/');
    if (parts.length === 3) {
        return new Date(parts[2], parts[0] - 1, parts[1]);
    }

    // Si eso también falla, devuelve null
    return null;
}