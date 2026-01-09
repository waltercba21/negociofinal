document.addEventListener("DOMContentLoaded", function () {
    console.log("📌 Script cargado correctamente.");

    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
    const btnContinuarPago = document.getElementById("continuar-pago");
    const infoRetiroLocal = document.getElementById("info-retiro-local"); // ✅ nuevo

    let mapa, marcador;

    // ✅ Dirección del local (texto visible + popup del mapa)
    const direccionLocal = "IGUALDAD 88, Centro, Córdoba";

    // Ubicación predeterminada
    const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 };

  // ✅ Zona delivery: círculo (ajustá el radio hasta que coincida con circunvalación)
const RADIO_CIRCUNVALACION_KM = 8.5; // probá 8.0 / 8.5 / 9.0
const areaCbaCapital = turf.circle(
  [ubicacionLocal.lng, ubicacionLocal.lat],
  RADIO_CIRCUNVALACION_KM,
  { steps: 128, units: "kilometers" }
);
// Inicializar Mapa con zona verde (círculo)
function inicializarMapa() {
  if (!mapa) {
    mapa = L.map("mapa").setView(ubicacionLocal, 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapa);

    // ✅ Agregar el área de entrega al mapa
    const capaZona = L.geoJSON(areaCbaCapital, {
      style: {
        color: "green",
        fillColor: "#32CD32",
        fillOpacity: 0.3,
      },
    }).addTo(mapa);

    // ✅ Encajar el mapa a la zona (se ve perfecto)
    mapa.fitBounds(capaZona.getBounds());
  }

  // Forzar la actualización del tamaño después de un pequeño retraso
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

   function esUbicacionValida(lat, lng) {
  const punto = turf.point([lng, lat]);
  return turf.booleanPointInPolygon(punto, areaCbaCapital);
}


    // Evento al cambiar el tipo de envío
    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", function () {
            console.log(`📌 Tipo de envío seleccionado: ${this.value}`);

            if (!mapa) {
                inicializarMapa();
            }

            mapaContainer.classList.remove("hidden");

            if (this.value === "delivery") {
                datosEnvio.classList.remove("hidden");
                inputDireccion.value = "";
                if (infoRetiroLocal) infoRetiroLocal.classList.add("hidden");
            } else {
                datosEnvio.classList.add("hidden");
                if (infoRetiroLocal) infoRetiroLocal.classList.remove("hidden");

                // ✅ ahora muestra la dirección real del local
                actualizarMarcador(ubicacionLocal.lat, ubicacionLocal.lng, direccionLocal, true);
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
                    actualizarMarcador(
                        parseFloat(resultado.lat),
                        parseFloat(resultado.lon),
                        direccion,
                        esUbicacionValida(resultado.lat, resultado.lon)
                    );
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

        const datosEnvioPayload = {
            tipo_envio: tipoEnvio,
            // ✅ si es local, guardamos la dirección real (igual se identifica por tipo_envio)
            direccion: tipoEnvio === "delivery" ? direccion : direccionLocal
        };

        fetch("/carrito/envio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datosEnvioPayload)
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
            .catch(() => {
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
    if (infoRetiroLocal) infoRetiroLocal.classList.add("hidden");

    console.log("✅ Inicialización del script completada.");
});
