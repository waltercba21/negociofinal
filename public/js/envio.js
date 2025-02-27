document.addEventListener("DOMContentLoaded", function () {
    console.log("📌 Script cargado correctamente.");

    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
    const btnContinuarPago = document.getElementById("continuar-pago");
    let mapa, marcador;

    // Función para obtener el carrito ID (Simulación)
    function obtenerCarritoID() {
        // 🔹 Aquí deberías reemplazar con la lógica real para obtener el ID del carrito desde el backend o almacenamiento local
        const carritoID = sessionStorage.getItem("carrito_id") || "12345"; // Simulación de ID
        console.log("🛒 Carrito ID obtenido:", carritoID);
        return carritoID;
    }

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
                [-64.2204030946718, -31.364278427615925],
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
    }

    function actualizarMarcador(lat, lng, direccion, dentroDeZona) {
        if (!mapa) return;

        if (marcador) {
            marcador.setLatLng([lat, lng]);
        } else {
            marcador = L.marker([lat, lng]).addTo(mapa);
        }

        const mensaje = dentroDeZona
            ? `<b>Dirección:</b> ${direccion}`
            : `<b>Dirección:</b> ${direccion}<br><span style='color:red;'>⛔ Fuera del área de entrega</span>`;

        marcador.bindPopup(mensaje).openPopup();
        mapa.setView([lat, lng], 14);
    }

    function esUbicacionValida(lat, lng) {
        const punto = turf.point([lng, lat]);
        const poligono = turf.polygon(areaCbaCapital.geometry.coordinates);
        return turf.booleanPointInPolygon(punto, poligono);
    }

    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", function () {
            console.log(`📌 Tipo de envío seleccionado: ${this.value}`);
            mapaContainer.classList.remove("hidden");
            inicializarMapa();

            if (this.value === "delivery") {
                datosEnvio.classList.remove("hidden");
            } else {
                datosEnvio.classList.add("hidden");
                actualizarMarcador(ubicacionLocal.lat, ubicacionLocal.lng, "Retiro en local", true);
            }
        });
    });

    btnBuscarDireccion.addEventListener("click", function () {
        const direccion = inputDireccion.value.trim();
        if (direccion === "") {
            mostrarAlerta("Ingrese una dirección", "Por favor, ingrese una dirección válida.");
            return;
        }

        console.log("🔍 Buscando dirección:", direccion);

        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ', Córdoba, Argentina')}&addressdetails=1`)
            .then(response => response.json())
            .then(data => {
                if (!Array.isArray(data) || data.length === 0) {
                    mostrarAlerta("No se encontraron resultados.", "Intente con otra dirección.");
                    return;
                }

                const resultado = data.find(entry => 
                    (entry.address.city === "Córdoba" || entry.address.town === "Córdoba") && entry.address.state === "Córdoba"
                );

                if (!resultado) {
                    mostrarAlerta("Dirección fuera de Córdoba Capital", "Ingrese una dirección válida dentro de Córdoba Capital.");
                } else {
                    actualizarMarcador(parseFloat(resultado.lat), parseFloat(resultado.lon), direccion, esUbicacionValida(resultado.lat, resultado.lon));
                    console.log("📌 Dirección validada:", direccion);
                }
            })
            .catch(error => {
                console.error("❌ Error en la búsqueda de dirección:", error);
                mostrarAlerta("Error de conexión", "Hubo un error en la búsqueda. Intente nuevamente.");
            });
    });

    btnContinuarPago.addEventListener("click", function (event) {
        event.preventDefault();
        console.log("✅ Botón 'Continuar con el Pago' clickeado.");

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

        const carritoId = obtenerCarritoID();
        if (!carritoId) {
            console.error("❌ No se pudo obtener el ID del carrito.");
            return;
        }

        Swal.fire({
            icon: 'question',
            title: 'Confirmar dirección',
            text: `¿La dirección ingresada es correcta?\n\n${direccion}`,
            showCancelButton: true,
            confirmButtonText: 'Sí, confirmar',
            cancelButtonText: 'No, cambiar'
        }).then(result => {
            if (result.isConfirmed) {
                console.log("📡 Enviando datos al servidor...");
                window.location.href = "/carrito/confirmarPedido";
            }
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

    console.log("✅ Inicialización del script completada.");
});
