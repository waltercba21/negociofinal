document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");

    let mapa;
    let marcador;

    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", function () {
            if (this.value === "delivery") {
                mapaContainer.classList.remove("hidden");

                if (!mapa) {
                    inicializarMapa();
                }
            } else {
                mapaContainer.classList.add("hidden");
            }
        });
    });

    function inicializarMapa() {
        mapa = L.map("mapa").setView([-34.603722, -58.381592], 12); // Buenos Aires

        // Cargar los tiles de OpenStreetMap
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapa);

        // Agregar marcador al hacer clic en el mapa
        mapa.on("click", function (e) {
            if (marcador) {
                mapa.removeLayer(marcador);
            }
            marcador = L.marker(e.latlng).addTo(mapa);
            
            // Guardar coordenadas y dirección
            document.getElementById("direccion").value = `Lat: ${e.latlng.lat}, Lng: ${e.latlng.lng}`;
            document.getElementById("barrio").value = "Ubicación seleccionada";
        });
    }
});
