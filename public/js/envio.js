document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    let mapa;
    let marcador;
    let marcadorLocal;

    const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 }; // Igualdad 88, Córdoba Capital

    function inicializarMapa() {
        // Crear mapa centrado en la ubicación del local
        mapa = L.map("mapa").setView(ubicacionLocal, 14);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapa);

        // Mostrar ubicación del local al cargar la página
        mostrarUbicacionLocal();

        // Evento para agregar marcador solo si se selecciona "Envío Delivery"
        mapa.on("click", function (e) {
            if (document.querySelector("input[name='tipo-envio']:checked").value === "delivery") {
                if (marcador) {
                    mapa.removeLayer(marcador);
                }
                marcador = L.marker(e.latlng).addTo(mapa);

                // Guardar coordenadas en los inputs
                document.getElementById("direccion").value = `Lat: ${e.latlng.lat}, Lng: ${e.latlng.lng}`;
                document.getElementById("barrio").value = "Ubicación seleccionada";
            }
        });
    }

    function mostrarUbicacionLocal() {
        // Si ya existe un marcador, lo eliminamos
        if (marcador) {
            mapa.removeLayer(marcador);
        }
        if (marcadorLocal) {
            mapa.removeLayer(marcadorLocal);
        }

        // Agregar marcador en la ubicación del local
        marcadorLocal = L.marker(ubicacionLocal).addTo(mapa)
            .bindPopup("📍 Igualdad 88, Córdoba Capital, Argentina").openPopup();

        mapa.setView(ubicacionLocal, 14);
    }

    // Mostrar el mapa cuando se seleccione un tipo de envío
    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", function () {
            mapaContainer.classList.remove("hidden");

            if (!mapa) {
                inicializarMapa();
            }

            if (this.value === "delivery") {
                if (marcadorLocal) {
                    mapa.removeLayer(marcadorLocal);
                }
            } else {
                mostrarUbicacionLocal();
            }
        });
    });

    // Inicializar mapa al cargar la página (para mostrar la ubicación del local de inmediato)
    inicializarMapa();
});
