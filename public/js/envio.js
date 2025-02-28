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

    // Ubicación predeterminada
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

    function actualizarMarcador(lat, lng, direccion) {
        if (!mapa) return;

        if (marcador) {
            marcador.setLatLng([lat, lng]);
        } else {
            marcador = L.marker([lat, lng]).addTo(mapa);
        }

        marcador.bindPopup(`<b>Dirección:</b> ${direccion}`).openPopup();
        mapa.setView([lat, lng], 14);
    }

    function limpiarDireccion(direccion) {
        return direccion.replace(/\b(AV|AV\.|BV|BV\.|CALLE|C\.|AVENIDA|BOULEVARD|PJE|PASAJE|DIAG|DIAGONAL|CAMINO|CIRCUNVALACION|AUTOPISTA|ROTONDA|RUTA)\s+/gi, '').trim();
    }

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
                    manejarResultado(resultado, direccion);
                }
            })
            .catch(error => manejarError(error))
            .finally(() => {
                spinner.classList.add("hidden"); // Ocultar spinner después de la búsqueda
            });
    });

    function manejarResultado(resultado, direccion) {
        const lat = parseFloat(resultado.lat);
        const lon = parseFloat(resultado.lon);
        console.log("📌 Dirección validada:", resultado.display_name);
        actualizarMarcador(lat, lon, resultado.display_name);
    }

    function manejarError(error) {
        console.error("❌ Error en la búsqueda de dirección:", error);
        mostrarAlerta("Error en la búsqueda", error.message || "Hubo un problema. Intente nuevamente.");
    }

    btnContinuarPago.addEventListener("click", function (event) {
        event.preventDefault();

        const tipoEnvio = document.querySelector("input[name='tipo-envio']:checked")?.value;
        if (!tipoEnvio) {
            mostrarAlerta("Seleccione un tipo de envío", "Debe elegir una opción de envío antes de continuar.");
            return;
        }

        const direccion = inputDireccion.value.trim();
        if (tipoEnvio === "delivery" && direccion === "") {
            mostrarAlerta("Ingrese una dirección", "Por favor, ingrese una dirección válida.");
            return;
        }

        const datosEnvio = {
            tipo_envio: tipoEnvio,
            direccion: tipoEnvio === "delivery" ? direccion : "Retiro en local"
        };

        fetch("/carrito/envio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datosEnvio)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = "/carrito/confirmarDatos";
            }
        })
        .catch(error => {
            mostrarAlerta("Error", "No se pudo conectar con el servidor.");
        });
    });

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
