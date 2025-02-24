document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
    let mapa;
    let marcador;

    const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 };

    // FORZAR la ocultación inicial
    datosEnvio.classList.add("hidden");
    mapaContainer.classList.add("hidden");

    function inicializarMapa() {
        if (!mapa) {
            mapa = L.map("mapa").setView(ubicacionLocal, 14);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapa);
        }
    }

    function actualizarMarcador(lat, lng) {
        if (!mapa) return;
    
        if (marcador) {
            marcador.setLatLng([lat, lng]);
        } else {
            marcador = L.marker([lat, lng], { draggable: true }).addTo(mapa);
        }
    
        mapa.setView([lat, lng], 14);
    }

    // Función para manejar cambios en el tipo de envío
    function manejarCambioEnvio() {
        const seleccionado = document.querySelector("input[name='tipo-envio']:checked");
        if (seleccionado && seleccionado.value === "delivery") {
            datosEnvio.classList.remove("hidden");
            mapaContainer.classList.remove("hidden");
            inicializarMapa();
        } else {
            datosEnvio.classList.add("hidden");
            mapaContainer.classList.add("hidden");
        }
    }

    // Agregar eventos a los radio buttons
    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", manejarCambioEnvio);
    });

    // Llamar a la función al cargar la página para reflejar el estado inicial
    manejarCambioEnvio();

    btnBuscarDireccion.addEventListener("click", function () {
        const direccion = inputDireccion.value;
        if (direccion.trim() !== "") {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`)
                .then(response => response.json())
                .then(data => {
                    if (data.length > 0) {
                        const lat = parseFloat(data[0].lat);
                        const lon = parseFloat(data[0].lon);
                        actualizarMarcador(lat, lon);
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'No se encontró la dirección',
                            text: 'Intente con otra dirección.',
                            confirmButtonText: 'Aceptar'
                        });
                    }
                })
                .catch(error => {
                    console.error("Error al buscar la dirección:", error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error de conexión',
                        text: 'Hubo un error en la búsqueda de la dirección.',
                        confirmButtonText: 'Aceptar'
                    });
                });
        }
    });
});
