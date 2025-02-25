document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
    const direccionLocal = document.getElementById("direccion-local"); // Elemento para la dirección antes del mapa
    const leyendaDireccion = document.getElementById("leyenda-direccion"); // Elemento para la leyenda sobre el mapa
    let mapa;
    let marcador;

    const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 }; // Igualdad 88, Córdoba Capital

    // Definir los límites de Córdoba Capital como GeoJSON
    const areaCbaCapital = {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[ 
                [-64.174512, -31.372190], // Noreste
                [-64.141308, -31.426028], // Sureste
                [-64.204045, -31.465101], // Sur
                [-64.244475, -31.396353], // Suroeste
                [-64.2204030946718, -31.364278427615925], // Noroeste
                [-64.174512, -31.372190]  // Cierra el polígono
            ]]
        }
    };

    let poligonoZona = null;
    let geojsonZona = null;

    function inicializarMapa() {
        if (!mapa) {
            mapa = L.map("mapa").setView(ubicacionLocal, 14);

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapa);

            // Dibujar zona permitida en el mapa como GeoJSON
            geojsonZona = L.geoJSON(areaCbaCapital, {
                style: {
                    color: "green",       // Contorno verde
                    fillColor: "#32CD32", // Verde brillante
                    fillOpacity: 0.3
                }
            }).addTo(mapa);
        }
    }

    function actualizarMarcador(lat, lng) {
        if (!mapa) return;

        if (marcador) {
            marcador.setLatLng([lat, lng]);
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

    function esUbicacionValida(lat, lng) {
        if (!geojsonZona) return false;
        const punto = turf.point([lng, lat]); // Crear un punto
        const poligono = turf.polygon(areaCbaCapital.geometry.coordinates); // Crear un polígono
        return turf.booleanPointInPolygon(punto, poligono); // Verificar si está dentro
    }

    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", function () {
            mapaContainer.classList.remove("hidden");
            inicializarMapa();

            if (this.value === "delivery") {
                datosEnvio.classList.remove("hidden");
                direccionLocal.classList.add("hidden"); // Ocultar la dirección cuando no es retiro en local
                leyendaDireccion.classList.add("hidden"); // Ocultar leyenda en el mapa
            } else if (this.value === "local") {
                direccionLocal.classList.remove("hidden"); // Mostrar dirección del local
                leyendaDireccion.classList.remove("hidden"); // Mostrar leyenda sobre el mapa
                direccionLocal.innerHTML = "Dirección del Local: IGUALDAD 88, CENTRO - CÓRDOBA";
                leyendaDireccion.innerHTML = `<b>Dirección:</b> IGUALDAD 88, CENTRO - CÓRDOBA`;
                actualizarMarcador(ubicacionLocal.lat, ubicacionLocal.lng); // Actualizar marcador
            }
        });
    });

    btnBuscarDireccion.addEventListener("click", function () {
        const direccion = inputDireccion.value;
        if (direccion.trim() !== "") {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`)
                .then(response => response.text())  // Cambié a .text() para obtener el texto sin parsear como JSON
                .then(text => {
                    try {
                        const data = JSON.parse(text);  // Intentamos parsear el texto a JSON
                        if (data.length > 0) {
                            const lat = parseFloat(data[0].lat);
                            const lon = parseFloat(data[0].lon);

                            if (esUbicacionValida(lat, lon)) {
                                actualizarMarcador(lat, lon);
                            } else {
                                // Reemplazar la alerta por SweetAlert
                                Swal.fire({
                                    icon: 'error',
                                    title: '⛔ Dirección fuera del área de entrega',
                                    text: 'La dirección ingresada está fuera del área habilitada.',
                                    confirmButtonText: 'Aceptar'
                                });
                            }
                        } else {
                            // Reemplazar la alerta por SweetAlert
                            Swal.fire({
                                icon: 'error',
                                title: 'No se encontró la dirección',
                                text: 'Intente con otra dirección.',
                                confirmButtonText: 'Aceptar'
                            });
                        }
                    } catch (error) {
                        console.error("Error al parsear la respuesta:", error);
                        // Reemplazar la alerta por SweetAlert
                        Swal.fire({
                            icon: 'error',
                            title: 'Error en la búsqueda',
                            text: 'Hubo un problema al procesar la dirección. Intente nuevamente.',
                            confirmButtonText: 'Aceptar'
                        });
                    }
                })
                .catch(error => {
                    console.error("Error al buscar la dirección:", error);
                    // Reemplazar la alerta por SweetAlert
                    Swal.fire({
                        icon: 'error',
                        title: 'Error de conexión',
                        text: 'Hubo un error en la búsqueda de la dirección.',
                        confirmButtonText: 'Aceptar'
                    });
                });
        }
    });

    mapaContainer.classList.add("hidden");
    datosEnvio.classList.add("hidden");
});
