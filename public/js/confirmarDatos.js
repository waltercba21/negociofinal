// confirmarDatos.js

document.addEventListener("DOMContentLoaded", function () {
    fetch("/api/confirmar-datos")
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                mostrarProductos(data.productos);
                mostrarEnvio(data.envio);
            } else {
                console.error("Error al obtener datos de confirmación");
            }
        })
        .catch(error => console.error("Error en la petición:", error));
});

function mostrarProductos(productos) {
    const carritoProductos = document.getElementById("carrito-productos");
    let total = 0;
    
    if (productos.length > 0) {
        let html = `<table class="carrito-tabla">
                        <thead>
                            <tr class="carrito-header">
                                <th>Imagen</th>
                                <th>Producto</th>
                                <th>Cantidad</th>
                                <th>Precio</th>
                                <th>Sub-Total</th>
                            </tr>
                        </thead>
                        <tbody>`;

        productos.forEach(producto => {
            const subtotal = producto.cantidad * producto.precio_venta;
            total += subtotal;
            html += `<tr>
                        <td>
                            <img src="/uploads/productos/${producto.imagen || 'default.jpg'}" 
                                 alt="${producto.nombre}" class="imagen-miniatura">
                        </td>
                        <td>${producto.nombre}</td>
                        <td>${producto.cantidad}</td>
                        <td>$${producto.precio_venta.toFixed(2)}</td>
                        <td>$${subtotal.toFixed(2)}</td>
                    </tr>`;
        });

        html += `<tr class="carrito-total">
                    <td colspan="3"></td>
                    <td><strong>Total</strong></td>
                    <td>$${total.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>`;
        
        carritoProductos.innerHTML = html;
    } else {
        carritoProductos.innerHTML = "<p class='carrito-vacio'>No tienes productos en tu carrito.</p>";
    }
}

function mostrarEnvio(envio) {
    const envioDetalle = document.getElementById("envio-detalle");
    if (envio) {
        envioDetalle.innerHTML = `<p><strong>Tipo de Envío:</strong> ${envio.tipo_envio === 'local' ? 'Retiro en local' : 'Delivery'}</p>
                                  <p><strong>Dirección:</strong> ${envio.direccion || 'No aplica'}</p>`;
    } else {
        envioDetalle.innerHTML = "<p>No se ha seleccionado un método de envío.</p>";
    }
}
