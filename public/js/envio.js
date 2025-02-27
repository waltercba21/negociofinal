document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
    const btnContinuarPago = document.getElementById("continuar-pago");  
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

        const mensaje = dentroDeZona ? `<b>Dirección:</b> ${direccion}` : 
            `<b>Dirección:</b> ${direccion}<br><span style='color:red;'>⛔ Fuera del área de entrega</span>`;
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
            mapaContainer.classList.remove("hidden");
            inicializarMapa();

            if (this.value === "delivery") {
                datosEnvio.classList.remove("hidden");
            } else {
                datosEnvio.classList.add("hidden");
                actualizarMarcador(ubicacionLocal.lat, ubicacionLocal.lng, "Igualdad 88, Córdoba Capital", true);
            }
        });
    });

    btnBuscarDireccion.addEventListener("click", function () {
        const direccion = inputDireccion.value.trim();
        if (direccion !== "") {
            buscarDireccion(direccion);
        }
   

    function buscarDireccion(direccion) {
        const spinner = document.getElementById("spinner");
        if (!spinner) {
            console.error("❌ Spinner no encontrado en el DOM.");
            return;
        }
        spinner.style.display = "block";  
        requestAnimationFrame(() => {
            setTimeout(() => {
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ', Córdoba, Argentina')}&addressdetails=1`)
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                        return response.json();
                    })
                    .then(data => {
                        if (!Array.isArray(data) || data.length === 0) {
                            throw new Error("⚠️ No se encontraron resultados.");
                        }

                        let resultadoCbaCapital = data.find(entry => 
                            (entry.address.city === "Córdoba" || entry.address.town === "Córdoba") && entry.address.state === "Córdoba"
                        );

                        if (!resultadoCbaCapital) {
                            mostrarAlerta("No se encontró la dirección en Córdoba Capital", "Intente con otra dirección.");
                            ocultarSpinner();
                        } else {
                            manejarResultado(resultadoCbaCapital, direccion);
                            ocultarSpinner();
                        }
                    })
                    .catch(error => manejarError(error));
            }, 50);
        });
    }

    function manejarResultado(resultado, direccion) {
        const lat = parseFloat(resultado.lat);
        const lon = parseFloat(resultado.lon);
        const dentroDeZona = esUbicacionValida(lat, lon);
        actualizarMarcador(lat, lon, direccion, dentroDeZona);

        if (!dentroDeZona) {
            mostrarAlerta("⛔ Dirección fuera del área de entrega", "La dirección ingresada está fuera del área habilitada.");
        }
    }

    function manejarError(error) {
        console.error("❌ Error en la búsqueda:", error);
        mostrarAlerta("Error de conexión", "Hubo un error en la búsqueda de la dirección. Verifique la conexión o intente con otra dirección.");
        ocultarSpinner();
    }

    function ocultarSpinner() {
        const spinner = document.getElementById("spinner");
        if (spinner) {
            spinner.style.display = "none";
        }
    }

    function mostrarAlerta(titulo, mensaje) {
        Swal.fire({
            icon: 'error',
            title: titulo,
            text: mensaje,
            confirmButtonText: 'Aceptar'
        });
    }

    if (btnContinuarPago) {
        btnContinuarPago.addEventListener("click", function (event) {
            event.preventDefault();
    
            console.log("Botón continuar clickeado.");
            const direccion = inputDireccion.value.trim();
            const tipoEnvio = document.querySelector("input[name='tipo-envio']:checked").value;
            
            let datosEnvio = {
                carrito_id: obtenerCarritoID(), 
                tipo_envio: tipoEnvio,
                direccion: tipoEnvio === "delivery" ? direccion : "Retiro en local"
            };
    
            if (tipoEnvio === "delivery" && direccion === "") {
                Swal.fire({
                    icon: 'warning',
                    title: '¡Atención!',
                    text: 'Por favor, ingrese una dirección antes de continuar.',
                    confirmButtonText: 'Aceptar'
                });
                return;
            }
    
            Swal.fire({
                icon: 'question',
                title: 'Confirmar envío',
                text: `¿Está seguro que desea guardar estos datos?\n\nTipo: ${datosEnvio.tipo_envio}\nDirección: ${datosEnvio.direccion}`,
                showCancelButton: true,
                confirmButtonText: 'Sí, confirmar',
                cancelButtonText: 'No, cambiar'
            }).then(result => {
                if (result.isConfirmed) {
                    fetch("/api/guardar-envio", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(datosEnvio)
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            window.location.href = "/carrito/confirmarDatos";
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: 'Hubo un problema al guardar los datos. Inténtelo de nuevo.'
                            });
                        }
                    })
                    .catch(error => {
                        console.error("Error al enviar los datos:", error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'No se pudo conectar con el servidor.'
                        });
                    });
                }
            });
        });
    } else {
        console.error("❌ El botón 'continuar-pago' no se encontró en el DOM.");
    }
    

    mapaContainer.classList.add("hidden");
    datosEnvio.classList.add("hidden");
}); 
});
