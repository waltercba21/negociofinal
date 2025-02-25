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
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ', Córdoba, Argentina')}&addressdetails=1`)
            .then(response => response.json())
            .then(data => {
                let resultadoCbaCapital = data.find(entry => 
                    (entry.address.city === "Córdoba" || entry.address.town === "Córdoba") && entry.address.state === "Córdoba" 
                );

                if (!resultadoCbaCapital) {
                    console.log("Reintentando con variaciones de la dirección");
                    const variaciones = ["Av.", "Bv.", "Calle", ""].map(prefijo => `${prefijo} ${direccion}`.trim());
                    let promesas = variaciones.map(variante => 
                        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(variante + ', Córdoba, Argentina')}&addressdetails=1`).then(res => res.json())
                    );

                    return Promise.all(promesas).then(resultados => {
                        for (let res of resultados) {
                            let encontrado = res.find(entry => 
                                (entry.address.city === "Córdoba" || entry.address.town === "Córdoba") && entry.address.state === "Córdoba"
                            );
                            if (encontrado) {
                                return buscarDireccion(encontrado.display_name);
                            }
                        }
                        throw new Error("No se encontró la dirección");
                    });
                }

                if (resultadoCbaCapital) {
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
            })
            .catch(error => {
                console.error("Error al buscar la dirección:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error de conexión',
                    text: 'Hubo un error en la búsqueda de la dirección.',
                    confirmButtonText: 'Aceptar'
                });
            });
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
