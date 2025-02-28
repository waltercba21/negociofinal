document.addEventListener("DOMContentLoaded", function () {
    console.log("📌 Script de envío cargado correctamente.");

    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
    const btnContinuarPago = document.getElementById("continuar-pago");
    const spinner = document.getElementById("spinner");
    let mapa, marcador;

    const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 };

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

    if (btnBuscarDireccion) {
        btnBuscarDireccion.addEventListener("click", function () {
            const direccion = inputDireccion.value.trim();
            if (direccion === "") {
                mostrarAlerta("Ingrese una dirección", "Por favor, ingrese una dirección válida.");
                return;
            }

            console.log("🔍 Buscando dirección:", direccion);
            spinner.style.display = "block";

            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ', Córdoba, Argentina')}&addressdetails=1`)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    spinner.style.display = "none";

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
                    spinner.style.display = "none";
                    console.error("❌ Error en la búsqueda de dirección:", error);
                    mostrarAlerta("Error de conexión", "Hubo un error en la búsqueda. Intente nuevamente.");
                });
        });
    }

    if (btnContinuarPago) {
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

            const datosEnvio = {
                tipo_envio: tipoEnvio,
                direccion: tipoEnvio === "delivery" ? direccion : "Retiro en local"
            };

            console.log("📦 Datos a enviar:", datosEnvio);

            Swal.fire({
                icon: 'question',
                title: 'Confirmar envío',
                text: `¿Está seguro que desea guardar estos datos?\n\nTipo: ${datosEnvio.tipo_envio}\nDirección: ${datosEnvio.direccion}`,
                showCancelButton: true,
                confirmButtonText: 'Sí, confirmar',
                cancelButtonText: 'No, cambiar'
            }).then(result => {
                if (result.isConfirmed) {
                    console.log("📡 Enviando datos al servidor...");
                    fetch("/envio", { 
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(datosEnvio)
                    })
                    .then(response => response.json())
                    .then(data => {
                        console.log("🔄 Respuesta del servidor recibida:", data);
                        if (data.success) {
                            window.location.href = "/carrito/confirmarDatos";
                        } else {
                            mostrarAlerta("Error", "Hubo un problema al guardar los datos.");
                        }
                    })
                    .catch(error => {
                        console.error("❌ Error al enviar los datos:", error);
                        mostrarAlerta("Error", "No se pudo conectar con el servidor.");
                    });
                }
            });
        });
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
});
