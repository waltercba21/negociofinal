let productosOriginales = [];
let productosSeleccionados = [];
let timer;

window.onload = async () => {
    const respuesta = await fetch('/productos/api/buscar');
    productosOriginales = await respuesta.json();
};

document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
        const busqueda = e.target.value;
        let productos = [];
        if (!busqueda.trim()) {
            productos = productosOriginales.slice(0, 12);
        } else {
            let url = '/productos/api/buscar?q=' + busqueda;
            const respuesta = await fetch(url);
            productos = await respuesta.json();
        }
        mostrarProductos(productos);
    }, 300);
});

function mostrarProductos(productos) {
    const contenedorProductos = document.getElementById('contenedor-productos');
    contenedorProductos.innerHTML = '';
    productos.forEach(producto => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${producto.codigo}</td>
            <td>${producto.nombre}</td>
            <td>$${producto.costo_neto}</td>
            <td>
                <button class="decrementar">-</button>
                <span>1</span>
                <button class="incrementar">+</button>
            </td>
            <td>$<span class="precio-total">${producto.costo_neto}</span></td>
        `;
        const cantidadSpan = tr.querySelector('span');
        const precioTotalSpan = tr.querySelector('.precio-total');
        let cantidad = 1;

        tr.querySelector('.incrementar').addEventListener('click', () => {
            cantidad++;
            cantidadSpan.textContent = cantidad;
            precioTotalSpan.textContent = (producto.costo_neto * cantidad).toFixed(2);
            actualizarTotalPedido();
        });

        tr.querySelector('.decrementar').addEventListener('click', () => {
            if (cantidad > 1) {
                cantidad--;
                cantidadSpan.textContent = cantidad;
                precioTotalSpan.textContent = (producto.costo_neto * cantidad).toFixed(2);
                actualizarTotalPedido();
            }
        });

        contenedorProductos.appendChild(tr);
        productosSeleccionados.push({
            ...producto,
            cantidad,
            precioTotal: producto.costo_neto * cantidad
        });
    });
}

function actualizarTotalPedido() {
    let total = productosSeleccionados.reduce((sum, prod) => {
        return sum + (prod.costo_neto * prod.cantidad);
    }, 0);
    document.getElementById('total-pedido').textContent = total.toFixed(2);
}
