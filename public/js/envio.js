document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
    let mapa;
    let marcador;

    const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 };

    // Ocultar inicialmente los elementos
    datosEnvio.classList.add("hidden");
    mapaContainer.classList.add("hidden");
    datosEnvio.style.display = "none";
    mapaContainer.style.display = "none";

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

    // Manejar la visibilidad de los campos de envío según la opción seleccionada
    function manejarCambioEnvio() {
        const seleccionado = document.querySelector("input[name='tipo-envio']:checked");
        if (seleccionado && seleccionado.value === "delivery") {
            datosEnvio.classList.remove("hidden");
            mapaContainer.classList.remove("hidden");
            datosEnvio.style.display = "flex";
            mapaContainer.style.display = "block";
            inicializarMapa();
        } else {
            datosEnvio.classList.add("hidden");
            mapaContainer.classList.add("hidden");
            datosEnvio.style.display = "none";
            mapaContainer.style.display = "none";
        }
    }

    // Agregar eventos a los radio buttons
    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", manejarCambioEnvio);
    });

    // Llamar a la función al cargar la página para reflejar el estado inicial
    manejarCambioEnvio();

    btnBuscarDireccion.addEventListener("click", function () {
        const direccion = inputDireccion.value.trim();
        if (direccion !== "") {
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
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Campo vacío',
                text: 'Ingrese una dirección para buscar.',
                confirmButtonText: 'Aceptar'
            });
        }
    });
});
