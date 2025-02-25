document.addEventListener("DOMContentLoaded", function () {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const mapaContainer = document.getElementById("mapa-container");
    const datosEnvio = document.getElementById("datos-envio");
    const inputDireccion = document.getElementById("direccion");
    const btnBuscarDireccion = document.getElementById("buscar-direccion");
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
        console.log("Latitud recibida:", lat, "Longitud recibida:", lng);
        const punto = turf.point([lng, lat]);
        const poligono = turf.polygon(areaCbaCapital.geometry.coordinates);
        const resultado = turf.booleanPointInPolygon(punto, poligono);
        console.log("El punto está dentro del polígono:", resultado);
        return resultado;
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

    function buscarDireccion(direccion) {
        const spinner = document.getElementById("spinner");
        console.log("Mostrando el spinner");
        spinner.style.display = "block";  // Aseguramos que el spinner se vea
    
        // Forzar un pequeño retraso para asegurarnos de que el spinner se vea
        setTimeout(() => {
            console.log("Iniciando la búsqueda de la dirección:", direccion);
    
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ', Córdoba, Argentina')}&addressdetails=1`)
                .then(response => response.json())
                .then(data => {
                    console.log("Datos recibidos:", data);
                    let resultadoCbaCapital = data.find(entry => 
                        (entry.address.city === "Córdoba" || entry.address.town === "Córdoba") && entry.address.state === "Córdoba"
                    );
    
                    if (!resultadoCbaCapital) {
                        console.log("Reintentando con variaciones de la dirección");
    
                        const variaciones = ["Av.", "Bv.", "Calle", "Cto.", "Río", "Avenida", "Boulevard", "Ruta", ""].map(prefijo => `${prefijo} ${direccion}`.trim());
                        console.log("Variaciones de la dirección:", variaciones);
    
                        let promesas = variaciones.map(variante => 
                            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(variante + ', Córdoba, Argentina')}&addressdetails=1`).then(res => res.json())
                        );
    
                        console.log("Esperando respuestas para las variaciones...");
    
                        Promise.all(promesas).then(resultados => {
                            console.log("Respuestas de variaciones:", resultados);
                            let encontrado = false;
                            resultados.forEach(res => {
                                let match = res.find(entry => 
                                    (entry.address.city === "Córdoba" || entry.address.town === "Córdoba") && entry.address.state === "Córdoba"
                                );
                                if (match) {
                                    resultadoCbaCapital = match;
                                    encontrado = true;
                                }
                            });
    
                            // Ocultar el spinner después de que todas las búsquedas hayan terminado
                            console.log("Ocultando el spinner");
                            spinner.style.display = "none";  // Ocultamos el spinner
    
                            if (encontrado) {
                                const lat = parseFloat(resultadoCbaCapital.lat);
                                const lon = parseFloat(resultadoCbaCapital.lon);
                                console.log("Coordenadas obtenidas:", lat, lon);
    
                                const dentroDeZona = esUbicacionValida(lat, lon);
                                actualizarMarcador(lat, lon, direccion, dentroDeZona);
    
                                if (!dentroDeZona) {
                                    Swal.fire({
                                        icon: 'error',
                                        title: '⛔ Dirección fuera del área de entrega',
                                        text: 'La dirección ingresada está fuera del área habilitada.',
                                        confirmButtonText: 'Aceptar'
                                    });
                                }
                            } else {
                                Swal.fire({
                                    icon: 'error',
                                    title: 'No se encontró la dirección en Córdoba Capital',
                                    text: 'Intente con otra dirección.',
                                    confirmButtonText: 'Aceptar'
                                });
                            }
                        }).catch(error => {
                            // Ocultar el spinner si ocurre un error
                            console.log("Error en las variaciones:", error);
                            spinner.style.display = "none";  // Ocultamos el spinner
    
                            Swal.fire({
                                icon: 'error',
                                title: 'Error de conexión',
                                text: 'Hubo un problema al buscar la dirección. Por favor, intente nuevamente.',
                                confirmButtonText: 'Aceptar'
                            });
                        });
    
                    } else {
                        const lat = parseFloat(resultadoCbaCapital.lat);
                        const lon = parseFloat(resultadoCbaCapital.lon);
                        console.log("Coordenadas obtenidas:", lat, lon);
    
                        const dentroDeZona = esUbicacionValida(lat, lon);
                        actualizarMarcador(lat, lon, direccion, dentroDeZona);
    
                        if (!dentroDeZona) {
                            Swal.fire({
                                icon: 'error',
                                title: '⛔ Dirección fuera del área de entrega',
                                text: 'La dirección ingresada está fuera del área habilitada.',
                                confirmButtonText: 'Aceptar'
                            });
                        }
    
                        // Asegurarse de ocultar el spinner cuando la búsqueda termine
                        console.log("Ocultando el spinner");
                        spinner.style.display = "none";  // Ocultamos el spinner
                    }
                })
                .catch(error => {
                    // Ocultar el spinner si ocurre un error
                    console.log("Error en la búsqueda:", error);
                    spinner.style.display = "none";  // Ocultamos el spinner
    
                    Swal.fire({
                        icon: 'error',
                        title: 'Error de conexión',
                        text: 'Hubo un error en la búsqueda de la dirección. Verifique la conexión o intente con otra dirección.',
                        confirmButtonText: 'Aceptar'
                    });
                });
        }, 50);  // Pequeño retraso antes de iniciar la búsqueda
    }
    
    
    

    btnBuscarDireccion.addEventListener("click", function () {
        const direccion = inputDireccion.value.trim();
        if (direccion !== "") {
            buscarDireccion(direccion);
        }
    });

    mapaContainer.classList.add("hidden");
    datosEnvio.classList.add("hidden");

});
