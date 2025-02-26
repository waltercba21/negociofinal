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
    
        if (!spinner) {
            console.error("❌ Spinner no encontrado en el DOM.");
            return;
        }
    
        console.log("✅ Mostrando el spinner");
        spinner.style.display = "block";  
    
        setTimeout(() => {
            console.log("🔍 Iniciando la búsqueda de la dirección:", direccion);
    
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ', Córdoba, Argentina')}&addressdetails=1`)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    console.log("📥 Datos recibidos:", data);
    
                    if (!Array.isArray(data) || data.length === 0) {
                        throw new Error("⚠️ No se encontraron resultados.");
                    }
    
                    let resultadoCbaCapital = data.find(entry => 
                        (entry.address.city === "Córdoba" || entry.address.town === "Córdoba") && entry.address.state === "Córdoba"
                    );
    
                    if (!resultadoCbaCapital) {
                        console.log("🔄 Reintentando con variaciones de la dirección");
                        const variaciones = ["Av.", "Bv.", "Calle", "Cto.", "Río", "Avenida", "Boulevard", "Ruta", ""].map(prefijo => `${prefijo} ${direccion}`.trim());
    
                        console.log("📌 Variaciones generadas:", variaciones);
    
                        let promesas = variaciones.map(variante => 
                            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(variante + ', Córdoba, Argentina')}&addressdetails=1`)
                            .then(res => res.ok ? res.json() : Promise.reject(`Error HTTP: ${res.status}`))
                        );
    
                        Promise.allSettled(promesas).then(resultados => {
                            console.log("📬 Respuestas de variaciones recibidas:", resultados);
    
                            let encontrado = false;
                            resultados.forEach(res => {
                                if (res.status === "fulfilled" && Array.isArray(res.value) && res.value.length > 0) {
                                    let match = res.value.find(entry => 
                                        (entry.address.city === "Córdoba" || entry.address.town === "Córdoba") && entry.address.state === "Córdoba"
                                    );
                                    if (match) {
                                        resultadoCbaCapital = match;
                                        encontrado = true;
                                    }
                                }
                            });
    
                            spinner.style.display = "none";
                            console.log("✅ Spinner ocultado");
    
                            if (encontrado) {
                                manejarResultado(resultadoCbaCapital, direccion);
                            } else {
                                mostrarAlerta("No se encontró la dirección en Córdoba Capital", "Intente con otra dirección.");
                            }
                        }).catch(error => manejarError(error, spinner));
    
                    } else {
                        spinner.style.display = "none";
                        console.log("✅ Spinner ocultado");
                        manejarResultado(resultadoCbaCapital, direccion);
                    }
                })
                .catch(error => manejarError(error, spinner));
        }, 100);
    }
    
    function manejarResultado(resultado, direccion) {
        const lat = parseFloat(resultado.lat);
        const lon = parseFloat(resultado.lon);
        console.log("📌 Coordenadas obtenidas:", lat, lon);
    
        const dentroDeZona = esUbicacionValida(lat, lon);
        actualizarMarcador(lat, lon, direccion, dentroDeZona);
    
        if (!dentroDeZona) {
            mostrarAlerta("⛔ Dirección fuera del área de entrega", "La dirección ingresada está fuera del área habilitada.");
        }
    }
    
    function manejarError(error, spinner) {
        console.error("❌ Error en la búsqueda:", error);
        if (spinner) spinner.style.display = "none";  
        mostrarAlerta("Error de conexión", "Hubo un error en la búsqueda de la dirección. Verifique la conexión o intente con otra dirección.");
    }
    
    function mostrarAlerta(titulo, mensaje) {
        Swal.fire({
            icon: 'error',
            title: titulo,
            text: mensaje,
            confirmButtonText: 'Aceptar'
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
