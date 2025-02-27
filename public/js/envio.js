document.addEventListener("DOMContentLoaded", function () {
    console.log("📌 Script cargado correctamente.");

    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
    const btnContinuarPago = document.getElementById("continuar-pago");

    console.log("🔎 Verificando elementos en el DOM...");
    if (!btnContinuarPago) {
        console.error("❌ El botón 'continuar-pago' NO SE ENCONTRÓ en el DOM.");
        return;
    }

    let mapa, marcador;
    const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 };

    // Inicialización de Mapa
    function inicializarMapa() {
        if (!mapa) {
            mapa = L.map("mapa").setView(ubicacionLocal, 14);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapa);
        }
    }

    // Función para actualizar marcador en el mapa
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

    // Evento para seleccionar el tipo de envío
    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", function () {
            console.log(`📌 Tipo de envío seleccionado: ${this.value}`);
            mapaContainer.classList.remove("hidden");
            inicializarMapa();
            if (this.value === "delivery") {
                datosEnvio.classList.remove("hidden");
            } else {
                datosEnvio.classList.add("hidden");
                actualizarMarcador(ubicacionLocal.lat, ubicacionLocal.lng, "Retiro en local");
            }
        });
    });

    // Buscar dirección con OpenStreetMap API
    btnBuscarDireccion.addEventListener("click", function () {
        const direccion = inputDireccion.value.trim();
        if (direccion === "") {
            mostrarAlerta("Ingrese una dirección", "Por favor, ingrese una dirección válida.");
            return;
        }

        console.log("🔍 Buscando dirección:", direccion);

        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ', Córdoba, Argentina')}`)
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
                    actualizarMarcador(parseFloat(resultado.lat), parseFloat(resultado.lon), direccion);
                    console.log("📌 Dirección validada:", direccion);
                }
            })
            .catch(error => {
                console.error("❌ Error en la búsqueda de dirección:", error);
                mostrarAlerta("Error de conexión", "Hubo un error en la búsqueda. Intente nuevamente.");
            });
    });

    // Evento para continuar con el pago
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

        // Verificar si la función obtenerCarritoID existe
        if (typeof obtenerCarritoID !== "function") {
            console.error("❌ La función obtenerCarritoID() no está definida.");
            return;
        }

        const carritoId = obtenerCarritoID();
        if (!carritoId) {
            console.error("❌ No se pudo obtener el ID del carrito.");
            return;
        }

        const datosEnvio = {
            carrito_id: carritoId,
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
                        console.log("✅ Datos guardados correctamente. Redirigiendo...");
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
