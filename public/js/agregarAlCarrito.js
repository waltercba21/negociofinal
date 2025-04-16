document.getElementById("contenedor-productos").addEventListener("click", (e) => {
    if (e.target.classList.contains("agregar-carrito")) {
        console.log("➡️ Botón 'Agregar al carrito' clickeado");

        // Obtener información del producto
        const tarjetaProducto = e.target.closest(".card");
        const cantidadInput = tarjetaProducto.querySelector(".cantidad-input");
        const cantidad = parseInt(cantidadInput?.value) || 1;
        const nombreProducto = e.target.dataset.nombre;
        const idProducto = e.target.dataset.id;
        const precioProducto = e.target.dataset.precio;

        // Depuración: Verificar los datos recolectados
        console.log("📊 Datos del producto:", {
            idProducto,
            cantidad,
            nombreProducto,
            precioProducto
        });

       // Validar que los datos esenciales estén presentes
if (!idProducto || !precioProducto || isNaN(cantidad) || cantidad <= 0) {
    console.error("❌ Error: Datos incompletos o inválidos");

    Swal.fire({
        title: "Cantidad inválida",
        text: "Debes ingresar una cantidad mayor a 0 para continuar.",
        icon: "error",
        confirmButtonText: "OK",
    });

    return; // ❌ Detener el proceso si la cantidad es incorrecta
}

// Validar que la cantidad no supere el stock (si está disponible en el dataset)
const stockDisponible = parseInt(e.target.dataset.stock);
if (!isNaN(stockDisponible) && cantidad > stockDisponible) {
    Swal.fire({
        icon: 'warning',
        title: 'Cantidades no disponibles',
        text: 'Si deseas más unidades comunicate con nosotros 3513820440',
    });

    const inputCantidad = tarjetaProducto.querySelector(".cantidad-input");
    if (inputCantidad) inputCantidad.value = stockDisponible;
    return;
}


        fetch('/carrito/agregar', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_producto: idProducto, cantidad: cantidad, precio: precioProducto })
        })
        .then(response => {
            console.log("📩 Respuesta del servidor recibida:", response);
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("✅ Producto agregado con éxito:", data);
            mostrarNotificacion(`${cantidad} ${nombreProducto} agregado(s) al carrito`);
            
            // Llamamos a la función para actualizar el globo
            obtenerCantidadCarrito();
        })
        .catch(error => {
            console.error("❌ Error al agregar el producto al carrito:", error);
            Swal.fire({
                title: "Error",
                text: "Hubo un problema al agregar el producto al carrito.",
                icon: "error",
                confirmButtonText: "OK",
            });
        });
        
    }
});

// Función para mostrar la notificación con SweetAlert
function mostrarNotificacion(mensaje) {
    Swal.fire({
        title: "¡Producto agregado!",
        text: mensaje,
        icon: "success",
        confirmButtonText: "OK",
    });
}

// Función para obtener la cantidad total del carrito y actualizar el globo de notificación
function obtenerCantidadCarrito() {
    console.log("📡 Solicitando cantidad total del carrito...");
    
    fetch('/carrito/cantidad')  // Llamamos a la ruta correcta del backend
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log("🛒 Cantidad total obtenida:", data);
            if (data && data.cantidadTotal !== undefined) {
                actualizarGloboNotificacion(data.cantidadTotal);
            } else {
                console.error("⚠️ Error: Respuesta inesperada del servidor", data);
            }
        })
        .catch(error => {
            console.error("❌ Error al obtener la cantidad del carrito:", error);
        });
}


// Función para actualizar el globo de notificación con la cantidad de productos
function actualizarGloboNotificacion(cantidad) {
    console.log(`🔵 Actualizando globo de notificación con cantidad: ${cantidad}`);
    const globo = document.getElementById('carrito-notificacion');

    if (globo) {
        if (cantidad > 0) {
            globo.textContent = cantidad;

            // 🔥 En lugar de display: inline-block, usa flex para que el contenido siempre se centre
            globo.style.display = 'flex'; 
            globo.style.justifyContent = 'center';
            globo.style.alignItems = 'center';
            globo.style.minWidth = "20px"; // Asegura que el globo tenga tamaño suficiente
            globo.style.minHeight = "20px";
            globo.style.padding = "2px"; // Evita que los números grandes se salgan
            globo.style.fontSize = "12px"; // Ajusta el tamaño del texto
            globo.style.textAlign = "center";

            // 🔄 Forzar reflow/repaint para asegurarse de que se aplican los estilos
            globo.offsetHeight;
        } else {
            globo.style.display = 'none'; // Ocultar si el carrito está vacío
        }
    } else {
        console.error("⚠️ No se encontró el elemento de notificación del carrito.");
    }
}

