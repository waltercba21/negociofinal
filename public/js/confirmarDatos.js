function obtenerCarritoID(callback) {
    fetch("/carrito/activo")
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.success && data.carrito_id) {
                console.log("🛒 Carrito ID obtenido:", data.carrito_id);
                callback(data.carrito_id);
            } else {
                console.warn("⚠️ No se encontró un carrito activo.");
                callback(null);
            }
        })
        .catch(error => {
            console.error("❌ Error al obtener el carrito:", error);
            callback(null);
        });
}
