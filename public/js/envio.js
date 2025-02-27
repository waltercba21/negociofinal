document.addEventListener("DOMContentLoaded", function () {
    console.log("📌 Script cargado correctamente.");

    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
    const btnContinuarPago = document.getElementById("continuar-pago");
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
                [-64.2204030946718, -31.364278427615925],
                [-64.174512, -31.372190]
            ]]
        }
    };

    // Inicializar Mapa con cuadrante verde
// Modificación en la función inicializarMapa()
function inicializarMapa() {
    if (!mapa) {
        mapa = L.map("mapa").setView(ubicacionLocal, 14);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapa);

        // Agregar el área de entrega al mapa
        L.geoJSON(areaCbaCapital, {
            style: {
                color: "green",
                fillColor: "#32CD32",
                fillOpacity: 0.3
            }
        }).addTo(mapa);
    }

    // ✅ Forzar la actualización del tamaño después de un pequeño retraso
    setTimeout(() => {
        mapa.invalidateSize();
        console.log("🗺️ Mapa actualizado correctamente.");
    }, 500);
}


    // Actualizar marcador en el mapa
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

    // Validar si la ubicación está dentro de la zona permitida
    function esUbicacionValida(lat, lng) {
        const punto = turf.point([lng, lat]);
        const poligono = turf.polygon(areaCbaCapital.geometry.coordinates);
        return turf.booleanPointInPolygon(punto, poligono);
    }

    // Evento al cambiar el tipo de envío
    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", function () {
            console.log(`📌 Tipo de envío seleccionado: ${this.value}`);
            if (!mapa) {
                inicializarMapa();  // Asegurarse de que el mapa se inicializa
            }
    
            mapaContainer.classList.remove("hidden");
    
            if (this.value === "delivery") {
                datosEnvio.classList.remove("hidden");
                inputDireccion.value = ""; // Reiniciar el input de dirección si se cambia
            } else {
                datosEnvio.classList.add("hidden");
                actualizarMarcador(ubicacionLocal.lat, ubicacionLocal.lng, "Retiro en local", true);
            }
        });
    });
    

    // Evento para buscar dirección
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
            if (data.confirmarCambio) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Dirección registrada previamente',
                    text: `Tiene la dirección "${data.direccionExistente}" predefinida. ¿Desea cambiarla por "${data.direccionNueva}"?`,
                    showCancelButton: true,
                    confirmButtonText: 'Sí, actualizar',
                    cancelButtonText: 'No, mantener'
                }).then(result => {
                    if (result.isConfirmed) {
                        fetch("/carrito/envio/actualizar", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ direccion: data.direccionNueva })
                        })
                        .then(response => response.json())
                        .then(updateData => {
                            if (updateData.success) {
                                Swal.fire("Actualizado", "Su dirección ha sido actualizada.", "success")
                                .then(() => window.location.href = "/carrito/confirmarDatos");
                            }
                        });
                    } else {
                        window.location.href = "/carrito/confirmarDatos";
                    }
                });
            } else if (data.success) {
                window.location.href = "/carrito/confirmarDatos";
            }
        })
        .catch(error => {
            mostrarAlerta("Error", "No se pudo conectar con el servidor.");
        });
    });
    
    

    // Función para mostrar alertas con SweetAlert
    function mostrarAlerta(titulo, mensaje) {
        Swal.fire({
            icon: 'error',
            title: titulo,
            text: mensaje,
            confirmButtonText: 'Aceptar'
        });
    }

    // Ocultar elementos iniciales
    mapaContainer.classList.add("hidden");
    datosEnvio.classList.add("hidden");

    console.log("✅ Inicialización del script completada.");
});