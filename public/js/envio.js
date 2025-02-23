document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");

    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", function () {
            if (this.value === "delivery") {
                mapaContainer.classList.remove("hidden");
                inicializarMapa();
            } else {
                mapaContainer.classList.add("hidden");
            }
        });
    });
});

function inicializarMapa() {
    if (!window.google || !window.google.maps) {
        console.error("Google Maps no se ha cargado correctamente.");
        return;
    }

    var mapa = new google.maps.Map(document.getElementById("mapa"), {
        center: { lat: -34.603722, lng: -58.381592 }, // Coordenadas de Buenos Aires
        zoom: 12
    });

    // Opcional: Intentar obtener la ubicación del usuario
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userPos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                mapa.setCenter(userPos);
                new google.maps.Marker({
                    position: userPos,
                    map: mapa,
                    title: "Tu ubicación",
                });
            },
            () => console.warn("No se pudo obtener la ubicación.")
        );
    }
}
