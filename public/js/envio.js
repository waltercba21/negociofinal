document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
    let mapa;
    let marcador;

    const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 }; // Igualdad 88, Córdoba Capital

    function inicializarMapa() {
        if (!mapa) {
            mapa = L.map("mapa").setView(ubicacionLocal, 14);

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapa);

            mapa.on("click", function (e) {
                if (document.querySelector("input[name='tipo-envio']:checked")?.value === "delivery") {
                    actualizarMarcador(e.latlng.lat, e.latlng.lng);
                    obtenerDireccionDesdeCoords(e.latlng.lat, e.latlng.lng);
                }
            });
        }
    }

    function actualizarMarcador(lat, lng) {
        if (!mapa) return;

        if (marcador) {
            marcador.setLatLng([lat, lng]); // Mueve el marcador en vez de duplicarlo
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
                        actualizarMarcador(lat, lon);
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
