document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    let mapa;
    let marcador;
    let marcadorLocal;

    const ubicacionLocal = { lat: -31.417339, lng: -64.183319 }; // Igualdad 88, Córdoba Capital, Argentina

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

    function inicializarMapa() {
        mapa = L.map("mapa").setView(ubicacionLocal, 14); // Centrar mapa en el local

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapa);

        mostrarUbicacionLocal();

        // Evento para agregar marcador cuando se selecciona delivery
        mapa.on("click", function (e) {
            if (document.querySelector("input[name='tipo-envio']:checked").value === "delivery") {
                if (marcador) {
                    mapa.removeLayer(marcador);
                }
                marcador = L.marker(e.latlng).addTo(mapa);

                // Guardar coordenadas y dirección
                document.getElementById("direccion").value = `Lat: ${e.latlng.lat}, Lng: ${e.latlng.lng}`;
                document.getElementById("barrio").value = "Ubicación seleccionada";
            }
        });
    }

    function mostrarUbicacionLocal() {
        if (marcador) {
            mapa.removeLayer(marcador);
        }

        if (marcadorLocal) {
            mapa.removeLayer(marcadorLocal);
        }

        marcadorLocal = L.marker(ubicacionLocal).addTo(mapa)
            .bindPopup("📍 Igualdad 88, Córdoba Capital, Argentina").openPopup();

        mapa.setView(ubicacionLocal, 14);
    }
});
