document.addEventListener("DOMContentLoaded", function () {
  console.log("📌 envio.js (CIRCULO REAL) cargado");

  const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
  const mapaContainer = document.getElementById("mapa-container");
  const datosEnvio = document.getElementById("datos-envio");
  const inputDireccion = document.getElementById("direccion");
  const btnBuscarDireccion = document.getElementById("buscar-direccion");
  const btnContinuarPago = document.getElementById("continuar-pago");
  const infoRetiroLocal = document.getElementById("info-retiro-local");
  const spinner = document.getElementById("spinner");

  let mapa, marcador, capaZona;

  // Dirección del local
  const direccionLocal = "IGUALDAD 88, Centro, Córdoba";

  // Centro de referencia (cerca del centro)
  const ubicacionLocal = { lat: -31.407473534930432, lng: -64.18164561932392 };

  // ✅ Radio aproximado circunvalación (ajustalo a gusto)
  const RADIO_CIRCUNVALACION_M = 8500; // 8.5 km

  function inicializarMapa() {
    if (mapa) return;

    mapa = L.map("mapa").setView([ubicacionLocal.lat, ubicacionLocal.lng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapa);

    // ✅ CÍRCULO REAL (no diamante)
    capaZona = L.circle([ubicacionLocal.lat, ubicacionLocal.lng], {
      radius: RADIO_CIRCUNVALACION_M,
      color: "green",
      fillColor: "#32CD32",
      fillOpacity: 0.3,
    }).addTo(mapa);

    mapa.fitBounds(capaZona.getBounds());
  }

  function refrescarMapaSize() {
    if (!mapa) return;
    setTimeout(() => {
      mapa.invalidateSize();
      // mantener zona visible
      if (capaZona) mapa.fitBounds(capaZona.getBounds());
    }, 200);
  }

  function actualizarMarcador(lat, lng, direccion, dentroDeZona) {
    if (!mapa) return;

    if (marcador) marcador.setLatLng([lat, lng]);
    else marcador = L.marker([lat, lng]).addTo(mapa);

    const mensaje = dentroDeZona
      ? `<b>Dirección:</b> ${direccion}`
      : `<b>Dirección:</b> ${direccion}<br><span style='color:red;'>⛔ Fuera del área de entrega</span>`;

    marcador.bindPopup(mensaje).openPopup();
    mapa.setView([lat, lng], 14);
  }

  // ✅ Validación por distancia al centro (círculo perfecto)
  function esUbicacionValida(lat, lng) {
    const centro = L.latLng(ubicacionLocal.lat, ubicacionLocal.lng);
    const punto = L.latLng(parseFloat(lat), parseFloat(lng));
    const distancia = centro.distanceTo(punto); // metros
    return distancia <= RADIO_CIRCUNVALACION_M;
  }

  // Cambio de tipo envío
  tipoEnvioRadios.forEach(radio => {
    radio.addEventListener("change", function () {
      console.log(`📌 Tipo de envío: ${this.value}`);

      // ✅ Primero mostrar contenedor, luego inicializar para evitar bugs de tamaño
      mapaContainer.classList.remove("hidden");
      inicializarMapa();
      refrescarMapaSize();

      if (this.value === "delivery") {
        datosEnvio.classList.remove("hidden");
        inputDireccion.value = "";
        if (infoRetiroLocal) infoRetiroLocal.classList.add("hidden");
        if (marcador) marcador.remove(), (marcador = null);
        if (capaZona) mapa.fitBounds(capaZona.getBounds());
      } else {
        datosEnvio.classList.add("hidden");
        if (infoRetiroLocal) infoRetiroLocal.classList.remove("hidden");
        actualizarMarcador(ubicacionLocal.lat, ubicacionLocal.lng, direccionLocal, true);
      }
    });
  });

  // Buscar dirección (Nominatim)
  btnBuscarDireccion.addEventListener("click", function () {
    const direccion = inputDireccion.value.trim();
    if (!direccion) {
      mostrarAlerta("Ingrese una dirección", "Por favor, ingrese una dirección válida.");
      return;
    }

    if (spinner) spinner.classList.remove("hidden");

    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ar&q=${encodeURIComponent(direccion + ", Córdoba, Argentina")}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          mostrarAlerta("No se encontraron resultados.", "Intente con otra dirección.");
          return;
        }

        const r0 = data[0];
        const lat = parseFloat(r0.lat);
        const lon = parseFloat(r0.lon);

        actualizarMarcador(lat, lon, direccion, esUbicacionValida(lat, lon));
      })
      .catch(() => {
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
      direccion: tipoEnvio === "delivery" ? direccion : direccionLocal,
    };

    fetch("/carrito/envio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
            cancelButtonText: "No, mantener",
          }).then(result => {
            if (result.isConfirmed) {
              fetch("/carrito/envio/actualizar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ direccion: data.direccionNueva }),
              })
                .then(r => r.json())
                .then(u => {
                  if (u.success) {
                    Swal.fire("Actualizado", "Su dirección ha sido actualizada.", "success")
                      .then(() => (window.location.href = "/carrito/confirmarDatos"));
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
      confirmButtonText: "Aceptar",
    });
  }

  // Estado inicial
  mapaContainer.classList.add("hidden");
  datosEnvio.classList.add("hidden");
  if (infoRetiroLocal) infoRetiroLocal.classList.add("hidden");
  if (spinner) spinner.classList.add("hidden");
});
