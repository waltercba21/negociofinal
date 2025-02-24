document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    let mapa;
    let marcador;
    let marcadorLocal;

    const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 }; // Igualdad 88, Córdoba Capital

    function inicializarMapa() {
        if (!mapa) {
            mapa = L.map("mapa").setView(ubicacionLocal, 14);

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapa);

            mapa.on("click", function (e) {
                if (document.querySelector("input[name='tipo-envio']:checked")?.value === "delivery") {
                    if (marcador) {
                        mapa.removeLayer(marcador);
                    }
                    marcador = L.marker(e.latlng).addTo(mapa);

                    document.getElementById("direccion").value = `Lat: ${e.latlng.lat}, Lng: ${e.latlng.lng}`;
                    document.getElementById("barrio").value = "Ubicación seleccionada";
                }
            });
        }
    }

    function mostrarUbicacionLocal() {
        if (!mapa) return;

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

    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", function () {
            mapaContainer.classList.remove("hidden");

            inicializarMapa();

            if (this.value === "delivery") {
                if (marcadorLocal) {
                    mapa.removeLayer(marcadorLocal);
                }
            } else {
                mostrarUbicacionLocal();
            }
        });
    });

    // Al inicio, el mapa debe estar oculto y ningún input seleccionado
    mapaContainer.classList.add("hidden");
    tipoEnvioRadios.forEach(radio => radio.checked = false);
});
