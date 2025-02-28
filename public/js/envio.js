document.addEventListener("DOMContentLoaded", function () {
    console.log("📌 Script cargado correctamente.");

    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
    const btnContinuarPago = document.getElementById("continuar-pago");
    const spinner = document.getElementById("spinner");

    let mapa, marcador;

    // Ubicación predeterminada (Córdoba Capital)
    const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 };

    // Área válida para la entrega
    const areaCbaCapital = {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [-64.174512, -31.372190],
                [-64.141308, -31.426028],
                [-64.204045, -31.465101],
                [-64.244475, -31.396353],
                [-64.220403, -31.364278],
                [-64.174512, -31.372190]
            ]]
        }
    };

    function inicializarMapa() {
        if (!mapa) {
            console.log("🗺️ Inicializando mapa...");
            mapa = L.map("mapa").setView(ubicacionLocal, 14);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapa);

            L.geoJSON(areaCbaCapital, {
                style: {
                    color: "green",
                    fillColor: "#32CD32",
                    fillOpacity: 0.3
                }
            }).addTo(mapa);
        }
        setTimeout(() => {
            mapa.invalidateSize();
            console.log("🗺️ Mapa actualizado correctamente.");
        }, 500);
    }

    function actualizarMarcador(lat, lon, direccion) {
        if (!mapa) return;

        if (marcador) {
            marcador.setLatLng([lat, lon]);
        } else {
            marcador = L.marker([lat, lon]).addTo(mapa);
        }

        marcador.bindPopup(`<b>Dirección:</b> ${direccion}`).openPopup();
        mapa.setView([lat, lon], 14);
    }

    function limpiarDireccion(direccion) {
        return direccion.replace(/\b(AV|AV\.|BV|BV\.|CALLE|C\.|AVENIDA|BOULEVARD|PJE|PASAJE|DIAG|DIAGONAL|CAMINO|CIRCUNVALACION|AUTOPISTA|ROTONDA|RUTA)\s+/gi, '').trim();
    }

    // Evento al cambiar el tipo de envío (mostrar/ocultar dirección y mapa)
    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", function () {
            console.log(`📌 Tipo de envío seleccionado: ${this.value}`);

            // Inicializar el mapa si aún no está creado
            if (!mapa) {
                inicializarMapa();
            }

            // Mostrar el mapa
            mapaContainer.classList.remove("hidden");

            if (this.value === "delivery") {
                datosEnvio.classList.remove("hidden");
                inputDireccion.value = ""; // Limpiar campo de dirección
                console.log("📦 Modo Delivery activado: ingresando dirección.");
            } else {
                datosEnvio.classList.add("hidden");
                actualizarMarcador(ubicacionLocal.lat, ubicacionLocal.lng, "Retiro en local");
                console.log("🏬 Modo Retiro en local activado.");
            }
        });
    });

    btnBuscarDireccion.addEventListener("click", function () {
        let direccion = inputDireccion.value.trim();
        if (direccion === "") {
            mostrarAlerta("Ingrese una dirección", "Por favor, ingrese una dirección válida.");
            return;
        }

        direccion = limpiarDireccion(direccion);
        console.log("🔍 Dirección buscada después de limpiar:", direccion);

        spinner.classList.remove("hidden"); // Mostrar spinner

        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ', Córdoba, Argentina')}&addressdetails=1`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (!Array.isArray(data) || data.length === 0) {
                    throw new Error("⚠️ No se encontraron resultados.");
                }

                let resultado = data.find(entry =>
                    entry.address.state === "Córdoba" &&
                    (entry.address.city === "Córdoba" || entry.address.town === "Córdoba") &&
                    (entry.address.county === "Capital" || entry.address.municipality === "Córdoba")
                );

                if (!resultado) {
                    mostrarAlerta("No se encontró la dirección en Córdoba Capital", "Intente con otra dirección.");
                } else {
                    manejarResultado(resultado);
                }
            })
            .catch(error => manejarError(error))
            .finally(() => {
                spinner.classList.add("hidden"); // Ocultar spinner después de la búsqueda
            });
    });

    function manejarResultado(resultado) {
        const lat = parseFloat(resultado.lat);
        const lon = parseFloat(resultado.lon);
        console.log("📌 Dirección validada:", resultado.display_name);
        actualizarMarcador(lat, lon, resultado.display_name);
    }

    function manejarError(error) {
        console.error("❌ Error en la búsqueda de dirección:", error);
        mostrarAlerta("Error en la búsqueda", error.message || "Hubo un problema. Intente nuevamente.");
    }

    function mostrarAlerta(titulo, mensaje) {
        Swal.fire({
            icon: 'error',
            title: titulo,
            text: mensaje,
            confirmButtonText: 'Aceptar'
        });
    }

    mapaContainer.classList.add("hidden");
    datosEnvio.classList.add("hidden");
    spinner.classList.add("hidden");

    console.log("✅ Inicialización del script completada.");
});
