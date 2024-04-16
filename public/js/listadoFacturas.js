document.getElementById('filterForm').addEventListener('submit', function(event) {
    event.preventDefault();

    var proveedor = document.getElementById('proveedor').value;
    var fechaFactura = new Date(document.getElementById('fechaFactura').value);
    var fechaPago = new Date(document.getElementById('fechaPago').value);
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
        
            var fechaFacturaFormateada = new Date(factura.fecha).toLocaleDateString();
            var fechaPago = new Date(factura.fecha_pago);
            var fechaPagoFormateada = fechaPago.toLocaleDateString();
        
            // Comprobar si faltan 7 días para la fecha de pago
            var hoy = new Date();
            var diferenciaDias = Math.ceil((fechaPago - hoy) / (1000 * 60 * 60 * 24));
            if (diferenciaDias === 7) {
                alert('Faltan 7 días para la fecha de pago de la factura ' + factura.id);
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