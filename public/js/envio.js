document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
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
                    
                    obtenerDireccionDesdeCoords(e.latlng.lat, e.latlng.lng);
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
                datosEnvio.classList.remove("hidden");
                if (marcadorLocal) {
                    mapa.removeLayer(marcadorLocal);
                }
            } else {
                datosEnvio.classList.add("hidden");
                mostrarUbicacionLocal();
            }
        });
    });

    // Geocodificar dirección ingresada manualmente
    btnBuscarDireccion.addEventListener("click", function () {
        const direccion = inputDireccion.value;
        if (direccion.trim() !== "") {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`)
                .then(response => response.json())
                .then(data => {
                    if (data.length > 0) {
                        const lat = data[0].lat;
                        const lon = data[0].lon;

                        if (marcador) {
                            mapa.removeLayer(marcador);
                        }
                        marcador = L.marker([lat, lon]).addTo(mapa);
                        mapa.setView([lat, lon], 14);
                    } else {
                        alert("No se encontró la dirección. Intente con otra.");
                    }
                })
                .catch(error => console.error("Error al buscar la dirección:", error));
        }
    });

    // Obtener dirección desde coordenadas al hacer clic en el mapa
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

    mapaContainer.classList.add("hidden");
    datosEnvio.classList.add("hidden");
    tipoEnvioRadios.forEach(radio => radio.checked = false);
});
