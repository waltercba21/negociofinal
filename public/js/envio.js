document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
    let mapa;
    let marcador;

    const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 }; // Igualdad 88, Córdoba Capital

    // Definir los límites de Córdoba Capital (Ejemplo: Polígono aproximado)
    const areaCbaCapital = [
        [-31.372190, -64.174512], // Noreste
        [-31.426028, -64.141308], // Sureste
        [-31.465101, -64.204045], // Sur
        [-31.396353, -64.244475], // Suroeste
        [-31.364278427615925, -64.2204030946718], // Noroeste
        [-31.372190, -64.174512] // Cierra el polígono
    ];
    

    let poligonoZona = null;

    function inicializarMapa() {
        if (!mapa) {
            mapa = L.map("mapa").setView(ubicacionLocal, 14);

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapa);

            // Dibujar zona permitida en el mapa
            poligonoZona = L.polygon(areaCbaCapital, {
                color: "red",
                fillColor: "#f03",
                fillOpacity: 0.3
            }).addTo(mapa);

            mapa.on("click", function (e) {
                if (document.querySelector("input[name='tipo-envio']:checked")?.value === "delivery") {
                    if (esUbicacionValida(e.latlng.lat, e.latlng.lng)) {
                        actualizarMarcador(e.latlng.lat, e.latlng.lng);
                        obtenerDireccionDesdeCoords(e.latlng.lat, e.latlng.lng);
                    } else {
                        alert("⛔ La dirección está fuera del área habilitada para delivery.");
                    }
                }
            });
        }
    }

    function actualizarMarcador(lat, lng) {
        if (!mapa) return;

        if (marcador) {
            marcador.setLatLng([lat, lng]);
        } else {
            marcador = L.marker([lat, lng]).addTo(mapa);
        }
        mapa.setView([lat, lng], 14);
    }

    function obtenerDireccionDesdeCoords(lat, lon) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
            .then(response => response.json())
            .then(data => {
                if (data.display_name) {
                    inputDireccion.value = data.display_name;
                } else {
                    inputDireccion.value = "Ubicación seleccionada";
                }
            })
            .catch(error => console.error("Error al obtener la dirección:", error));
    }

    function esUbicacionValida(lat, lng) {
        return leafletPip.pointInLayer([lng, lat], poligonoZona).length > 0;
    }

    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", function () {
            mapaContainer.classList.remove("hidden");
            inicializarMapa();

            if (this.value === "delivery") {
                datosEnvio.classList.remove("hidden");
            } else {
                datosEnvio.classList.add("hidden");
                actualizarMarcador(ubicacionLocal.lat, ubicacionLocal.lng);
            }
        });
    });

    btnBuscarDireccion.addEventListener("click", function () {
        const direccion = inputDireccion.value;
        if (direccion.trim() !== "") {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`)
                .then(response => response.json())
                .then(data => {
                    if (data.length > 0) {
                        const lat = parseFloat(data[0].lat);
                        const lon = parseFloat(data[0].lon);

                        if (esUbicacionValida(lat, lon)) {
                            actualizarMarcador(lat, lon);
                        } else {
                            alert("⛔ La dirección ingresada está fuera del área habilitada.");
                        }
                    } else {
                        alert("No se encontró la dirección. Intente con otra.");
                    }
                })
                .catch(error => console.error("Error al buscar la dirección:", error));
        }
    });

    mapaContainer.classList.add("hidden");
    datosEnvio.classList.add("hidden");
});
