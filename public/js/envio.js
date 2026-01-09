document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ envio.js CIRCULO LEAFLET activo");

  const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
  const mapaContainer = document.getElementById("mapa-container");
  const datosEnvio = document.getElementById("datos-envio");
  const inputDireccion = document.getElementById("direccion");
  const btnBuscarDireccion = document.getElementById("buscar-direccion");
  const btnContinuarPago = document.getElementById("continuar-pago");
  const infoRetiroLocal = document.getElementById("info-retiro-local");
  const spinner = document.getElementById("spinner");

  let mapa = null;
  let marcador = null;
  let circuloZona = null;

  const direccionLocal = "IGUALDAD 88, Centro, Córdoba";
  const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 };

  // ✅ Ajustá este radio hasta que te coincida con circunvalación
  const RADIO_CIRCUNVALACION_M = 8500; // 8.5 km

  function inicializarMapa() {
    if (mapa) return;

    // importante: el container debe estar visible antes
    mapa = L.map("mapa").setView([ubicacionLocal.lat, ubicacionLocal.lng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapa);

    // ✅ Círculo REAL
    circuloZona = L.circle([ubicacionLocal.lat, ubicacionLocal.lng], {
      radius: RADIO_CIRCUNVALACION_M,
      color: "green",
      fillColor: "#32CD32",
      fillOpacity: 0.3,
    }).addTo(mapa);

    mapa.fitBounds(circuloZona.getBounds());

    setTimeout(() => {
      mapa.invalidateSize();
      console.log("🗺️ Mapa actualizado correctamente.");
    }, 200);
  }

  function esUbicacionValida(lat, lng) {
    const centro = L.latLng(ubicacionLocal.lat, ubicacionLocal.lng);
    const punto = L.latLng(parseFloat(lat), parseFloat(lng));
    return centro.distanceTo(punto) <= RADIO_CIRCUNVALACION_M; // metros
  }

  function actualizarMarcador(lat, lng, direccion, dentroDeZona) {
    if (!mapa) return;

    const ll = [parseFloat(lat), parseFloat(lng)];

    if (marcador) marcador.setLatLng(ll);
    else marcador = L.marker(ll).addTo(mapa);

    const mensaje = dentroDeZona
      ? `<b>Dirección:</b> ${direccion}`
      : `<b>Dirección:</b> ${direccion}<br><span style='color:red;'>⛔ Fuera del área de entrega</span>`;

    marcador.bindPopup(mensaje).openPopup();
    mapa.setView(ll, 14);
  }

  tipoEnvioRadios.forEach(radio => {
    radio.addEventListener("change", function () {
      console.log(`📌 Tipo de envío seleccionado: ${this.value}`);

      // ✅ mostrar antes de crear el mapa
      mapaContainer.classList.remove("hidden");
      inicializarMapa();

      if (this.value === "delivery") {
        datosEnvio.classList.remove("hidden");
        inputDireccion.value = "";
        if (infoRetiroLocal) infoRetiroLocal.classList.add("hidden");

        if (circuloZona) mapa.fitBounds(circuloZona.getBounds());
      } else {
        datosEnvio.classList.add("hidden");
        if (infoRetiroLocal) infoRetiroLocal.classList.remove("hidden");

        actualizarMarcador(ubicacionLocal.lat, ubicacionLocal.lng, direccionLocal, true);
      }
    });
  });

  btnBuscarDireccion.addEventListener("click", function () {
    const direccion = inputDireccion.value.trim();
    if (!direccion) {
      mostrarAlerta("Ingrese una dirección", "Por favor, ingrese una dirección válida.");
      return;
    }

    if (spinner) spinner.classList.remove("hidden");
    console.log("🔍 Buscando dirección:", direccion);

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion + ", Córdoba, Argentina")}&addressdetails=1&limit=5`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          mostrarAlerta("No se encontraron resultados.", "Intente con otra dirección.");
          return;
        }

        const resultado = data.find(entry =>
          (entry.address.city === "Córdoba" || entry.address.town === "Córdoba") &&
          entry.address.state === "Córdoba"
        ) || data[0];

        const lat = parseFloat(resultado.lat);
        const lon = parseFloat(resultado.lon);

        actualizarMarcador(lat, lon, direccion, esUbicacionValida(lat, lon));
        console.log("📌 Dirección validada:", direccion);
      })
      .catch(error => {
        console.error("❌ Error en la búsqueda de dirección:", error);
        mostrarAlerta("Error de conexión", "Hubo un error en la búsqueda. Intente nuevamente.");
      })
      .finally(() => {
        if (spinner) spinner.classList.add("hidden");
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
    if (tipoEnvio === "delivery" && !direccion) {
      mostrarAlerta("Ingrese una dirección", "Por favor, ingrese una dirección válida.");
      return;
    }

    const payload = {
      tipo_envio: tipoEnvio,
      direccion: tipoEnvio === "delivery" ? direccion : direccionLocal
    };

    fetch("/carrito/envio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(data => {
        if (data.confirmarCambio) {
          Swal.fire({
            icon: "warning",
            title: "Dirección registrada previamente",
            text: `Tiene la dirección "${data.direccionExistente}" predefinida. ¿Desea cambiarla por "${data.direccionNueva}"?`,
            showCancelButton: true,
            confirmButtonText: "Sí, actualizar",
            cancelButtonText: "No, mantener"
          }).then(result => {
            if (result.isConfirmed) {
              fetch("/carrito/envio/actualizar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ direccion: data.direccionNueva })
              })
                .then(r => r.json())
                .then(u => {
                  if (u.success) {
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
      .catch(() => mostrarAlerta("Error", "No se pudo conectar con el servidor."));
  });

  function mostrarAlerta(titulo, mensaje) {
    Swal.fire({
      icon: "error",
      title: titulo,
      text: mensaje,
      confirmButtonText: "Aceptar"
    });
  }

  // Estado inicial
  mapaContainer.classList.add("hidden");
  datosEnvio.classList.add("hidden");
  if (infoRetiroLocal) infoRetiroLocal.classList.add("hidden");
  if (spinner) spinner.classList.add("hidden");

  console.log("✅ Inicialización del script completada.");
});
