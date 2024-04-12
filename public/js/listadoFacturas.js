document.getElementById('filterForm').addEventListener('submit', function(event) {
    event.preventDefault();

    var proveedor = document.getElementById('proveedor').value;
    var fechaFactura = document.getElementById('fechaFactura').value;
    var fechaPago = document.getElementById('fechaPago').value;
    var condicion = document.getElementById('condicion').value;

    fetch('/api/facturas', {
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
        // Aquí puedes actualizar la tabla con los datos recibidos
    })
    .catch(error => console.error('Error:', error));
});