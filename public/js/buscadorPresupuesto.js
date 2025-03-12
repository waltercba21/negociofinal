document.getElementById('presupuesto-form').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        return false;
    }
});

document.getElementById('presupuesto-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const presupuestoItems = [];
    const filasPresupuesto = document.getElementById('tabla-presupuesto').getElementsByTagName('tbody')[0].rows;
    
    for (let i = 0; i < filasPresupuesto.length; i++) {
        const codigo = filasPresupuesto[i].cells[1].textContent.trim();
        const descripcion = filasPresupuesto[i].cells[2].textContent.trim();
        const precioInput = filasPresupuesto[i].cells[3].querySelector('input').value;
        let precio_unitario = parseFloat(precioInput.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim());
        let cantidad = parseInt(filasPresupuesto[i].cells[4].querySelector('input').value);
        precio_unitario = !isNaN(precio_unitario) ? precio_unitario : 0;
        cantidad = !isNaN(cantidad) ? cantidad : 1;
        let subtotal = precio_unitario * cantidad;

        if (codigo !== '' && descripcion !== '' && cantidad > 0 && precio_unitario > 0) {
            presupuestoItems.push({
                producto_id: codigo,
                descripcion,
                precio_unitario,
                cantidad,
                subtotal
            });
        }
    }

    if (presupuestoItems.length === 0) {
        Swal.fire({
            title: 'Error',
            text: 'Debe agregar al menos un producto válido al presupuesto antes de enviarlo.',
            icon: 'error',
            confirmButtonText: 'Entendido'
        });
        return;
    }

    const totalPresupuestoElement = document.getElementById('total-amount');
    let totalPresupuesto = totalPresupuestoElement.value.replace(/\./g, '').replace(',', '.').replace('$', '').trim();

    try {
        const response = await fetch('/productos/procesarFormulario', {   
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombreCliente: document.getElementById('nombre-cliente').value.trim(),
                fechaPresupuesto: document.getElementById('fecha-presupuesto').value.trim(),
                totalPresupuesto,
                presupuestoItems
            })
        });

        const data = await response.json();
        if (response.ok) {
            Swal.fire({
                title: '¡Éxito!',
                text: data.message,
                icon: 'success',
                confirmButtonText: 'Entendido'
            }).then(() => {
                window.location.reload();
            });
        } else {
            throw new Error(data.error || 'Error al procesar el formulario');
        }
    } catch (error) {
        console.error('Error al enviar el formulario:', error);
        Swal.fire({
            title: 'Error',
            text: 'Error al enviar formulario: ' + error.message,
            icon: 'error',
            confirmButtonText: 'Entendido'
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    Swal.fire({
        title: 'Está en la sección de Presupuestos',
        text: 'Recuerde que está realizando un presupuesto, no una factura.',
        icon: 'info',
        confirmButtonText: 'Entendido'
    });

    const entradaBusqueda = document.getElementById('entradaBusqueda');
    const resultadosBusqueda = document.getElementById('resultadosBusqueda');
    let timeoutId;

    entradaBusqueda.addEventListener('keyup', async (e) => {
        const busqueda = e.target.value;
        resultadosBusqueda.innerHTML = '';

        if (!busqueda.trim()) {
            resultadosBusqueda.style.display = 'none';
            return;
        }

        const url = '/productos/api/buscar?q=' + busqueda;
        const respuesta = await fetch(url);
        const productos = await respuesta.json();

        productos.forEach((producto) => {
            const resultado = document.createElement('div');
            resultado.classList.add('resultado-busqueda');
            resultado.dataset.codigo = producto.codigo;
            resultado.dataset.nombre = producto.nombre;
            resultado.dataset.precio_venta = producto.precio_venta;
            resultado.dataset.stock_actual = producto.stock_actual;

            if (producto.imagenes && producto.imagenes.length > 0) {
                resultado.dataset.imagen = '/uploads/productos/' + producto.imagenes[0].imagen;
            }

            const contenedor = document.createElement('div');
            contenedor.classList.add('resultado-contenedor');

            if (producto.imagenes && producto.imagenes.length > 0) {
                const imagen = document.createElement('img');
                imagen.src = '/uploads/productos/' + producto.imagenes[0].imagen;
                imagen.classList.add('miniatura');
                contenedor.appendChild(imagen);
            }

            const nombreProducto = document.createElement('span');
            nombreProducto.textContent = producto.nombre;
            contenedor.appendChild(nombreProducto);

            resultado.appendChild(contenedor);
            resultado.addEventListener('click', function () {
                agregarProductoATablaPresupuesto(this.dataset.codigo, this.dataset.nombre, this.dataset.precio_venta, this.dataset.stock_actual, this.dataset.imagen);
            });

            resultadosBusqueda.appendChild(resultado);
            resultadosBusqueda.style.display = 'block';
        });
    });
});
