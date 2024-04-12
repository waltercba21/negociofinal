document.getElementById('filterForm').addEventListener('submit', function(event) {
    event.preventDefault();

    var proveedor = document.getElementById('proveedor').value;
    var fechaFactura = document.getElementById('fechaFactura').value;
    var fechaPago = document.getElementById('fechaPago').value;
    var condicion = document.getElementById('condicion').value;

    var fechaFacturaFormateada = fechaFactura ? fechaFactura.split('/').reverse().join('-') : null;
    var fechaPagoFormateada = fechaPago ? fechaPago.split('/').reverse().join('-') : null;
    
    fetch('/administracion/api/facturas', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            proveedor: proveedor,
            fechaFactura: fechaFacturaFormateada,
            fechaPago: fechaPagoFormateada,
            condicion: condicion
        })
    })
    .then(response => response.json())
    .then(data => {
           // Selecciona el cuerpo de la tabla
    var tbody = document.querySelector('tbody');

    // Limpia el cuerpo de la tabla
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }

    // Agrega las nuevas filas a la tabla
    data.forEach(function(factura) {
        var tr = document.createElement('tr');
    
        var fechaFactura = new Date(factura.fecha);
        var fechaFacturaFormateada = fechaFactura ? `${fechaFactura.getDate().toString().padStart(2, '0')}/${(fechaFactura.getMonth()+1).toString().padStart(2, '0')}/${fechaFactura.getFullYear()}` : '';
    
        var fechaPago = new Date(factura.fecha_pago);
        var fechaPagoFormateada = fechaPago ? `${fechaPago.getDate().toString().padStart(2, '0')}/${(fechaPago.getMonth()+1).toString().padStart(2, '0')}/${fechaPago.getFullYear()}` : '';
    
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