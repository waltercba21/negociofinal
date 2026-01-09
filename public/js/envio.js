document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ envio.js NUEVO (CIRCULO REAL) v20260108-uber-1");

  const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
  const mapaContainer = document.getElementById("mapa-container");
  const datosEnvio = document.getElementById("datos-envio");
  const inputDireccion = document.getElementById("direccion");
  const btnBuscarDireccion = document.getElementById("buscar-direccion");
  const btnContinuarPago = document.getElementById("continuar-pago");
  const infoRetiroLocal = document.getElementById("info-retiro-local");
  const spinner = document.getElementById("spinner");

  // ✅ (Opcional) elementos UI Uber (deben existir en el EJS)
  const uberBadge = document.getElementById("uber-badge");
  const deliveryCostoBox = document.getElementById("delivery-costo");
  const deliveryCostoValor = document.getElementById("delivery-costo-valor");

  let mapa = null;
  let marcador = null;
  let circuloZona = null;

  // Estado de validación de delivery
  let deliveryValidado = false;
  let deliveryDentroZona = false;

  const direccionLocal = "IGUALDAD 88, Centro, Córdoba";

  // Centro del círculo (ajustado a la izquierda)
  const ubicacionLocal = { lat: -31.407473534930432, lng: -64.1830 };

  // Radio del área de delivery (metros)
  const RADIO_CIRCUNVALACION_M = 5800;

  // Costo delivery Uber
  const COSTO_DELIVERY = 5000;

  function fmtARS(n) {
    return "$" + Number(n).toLocaleString("es-AR");
  }

  function ocultarCostoDelivery() {
    if (deliveryCostoBox) deliveryCostoBox.classList.add("hidden");
  }

  function mostrarCostoDelivery() {
    if (!deliveryCostoBox || !deliveryCostoValor) return;
    deliveryCostoValor.textContent = fmtARS(COSTO_DELIVERY);
    deliveryCostoBox.classList.remove("hidden");
  }

  function inicializarMapa() {
    if (mapa) return;

    mapa = L.map("mapa").setView([ubicacionLocal.lat, ubicacionLocal.lng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapa);

    // ✅ CÍRCULO REAL
    circuloZona = L.circle([ubicacionLocal.lat, ubicacionLocal.lng], {
      radius: RADIO_CIRCUNVALACION_M,
      color: "green",
      fillColor: "#32CD32",
      fillOpacity: 0.3,
    }).addTo(mapa);

    mapa.fitBounds(circuloZona.getBounds());
  }

  function refrescarMapa() {
    if (!mapa) return;
    setTimeout(() => {
      mapa.invalidateSize();
      if (circuloZona) mapa.fitBounds(circuloZona.getBounds());
      console.log("🗺️ Mapa actualizado correctamente (NUEVO).");
    }, 200);
  }

  function esUbicacionValida(lat, lng) {
    const centro = L.latLng(ubicacionLocal.lat, ubicacionLocal.lng);
    const punto = L.latLng(parseFloat(lat), parseFloat(lng));
    return centro.distanceTo(punto) <= RADIO_CIRCUNVALACION_M;
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

  tipoEnvioRadios.forEach((radio) => {
    radio.addEventListener("change", function () {
      console.log(`📌 Tipo de envío seleccionado: ${this.value} (NUEVO)`);

      // Mostrar contenedor mapa
      mapaContainer.classList.remove("hidden");

      inicializarMapa();
      refrescarMapa();

      if (this.value === "delivery") {
        // Reset validación
        deliveryValidado = false;
        deliveryDentroZona = false;

        // UI
        datosEnvio.classList.remove("hidden");
        inputDireccion.value = "";
        if (infoRetiroLocal) infoRetiroLocal.classList.add("hidden");

        if (uberBadge) uberBadge.classList.remove("hidden");
        ocultarCostoDelivery();

      } else {
        // Retiro local
        datosEnvio.classList.add("hidden");
        if (infoRetiroLocal) infoRetiroLocal.classList.remove("hidden");

        if (uberBadge) uberBadge.classList.add("hidden");
        ocultarCostoDelivery();

        actualizarMarcador(ubicacionLocal.lat, ubicacionLocal.lng, direccionLocal, true);
      }
    });
  });

  btnBuscarDireccion.addEventListener("click", function () {
    const direccion = inputDireccion.value.trim();

    if (!direccion) {
      Swal.fire({
        icon: "error",
        title: "Ingrese una dirección",
        text: "Por favor, ingrese una dirección válida.",
      });
      return;
    }

    // Cada búsqueda vuelve a validar
    deliveryValidado = false;
    deliveryDentroZona = false;
    ocultarCostoDelivery();

    if (spinner) spinner.classList.remove("hidden");
    console.log("🔍 Buscando dirección (NUEVO):", direccion);

    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        direccion + ", Córdoba, Argentina"
      )}&addressdetails=1&limit=5`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) {
          Swal.fire({
            icon: "error",
            title: "No se encontraron resultados.",
            text: "Intente con otra dirección.",
          });
          return;
        }

        const r0 = data[0];
        const lat = parseFloat(r0.lat);
        const lon = parseFloat(r0.lon);

        const ok = esUbicacionValida(lat, lon);

        deliveryValidado = true;
        deliveryDentroZona = ok;

        actualizarMarcador(lat, lon, direccion, ok);

        // ✅ Mostrar precio recién cuando está OK dentro del área
        if (ok) mostrarCostoDelivery();
        else ocultarCostoDelivery();

        console.log("📌 Dirección validada (NUEVO):", direccion, "| dentroZona:", ok);
      })
      .catch((err) => {
        console.error("❌ Error búsqueda (NUEVO):", err);
        Swal.fire({
          icon: "error",
          title: "Error de conexión",
          text: "Hubo un error en la búsqueda. Intente nuevamente.",
        });
      })
      .finally(() => {
        if (spinner) spinner.classList.add("hidden");
      });
  });

  btnContinuarPago.addEventListener("click", function (event) {
    event.preventDefault();

    const tipoEnvio = document.querySelector("input[name='tipo-envio']:checked")?.value;
    if (!tipoEnvio) {
      Swal.fire({
        icon: "error",
        title: "Seleccione un tipo de envío",
        text: "Debe elegir una opción de envío antes de continuar.",
      });
      return;
    }

    const direccion = inputDireccion.value.trim();

    if (tipoEnvio === "delivery") {
      if (!direccion) {
        Swal.fire({
          icon: "error",
          title: "Ingrese una dirección",
          text: "Por favor, ingrese una dirección válida.",
        });
        return;
      }

      // ✅ exigir validación dentro de zona
      if (!deliveryValidado) {
        Swal.fire({
          icon: "error",
          title: "Validar dirección",
          text: "Por favor, toque “Buscar” para validar su dirección en el mapa.",
        });
        return;
      }

      if (!deliveryDentroZona) {
        Swal.fire({
          icon: "error",
          title: "Fuera del área de entrega",
          text: "Su dirección está fuera del área del delivery.",
        });
        return;
      }
    }

    const payload = {
      tipo_envio: tipoEnvio,
      direccion: tipoEnvio === "delivery" ? direccion : direccionLocal,
      // (Opcional) si querés guardarlo en backend:
      // costo_envio: tipoEnvio === "delivery" ? COSTO_DELIVERY : 0,
    };

    fetch("/carrito/envio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.confirmarCambio) {
          Swal.fire({
            icon: "warning",
            title: "Dirección registrada previamente",
            text: `Tiene la dirección "${data.direccionExistente}" predefinida. ¿Desea cambiarla por "${data.direccionNueva}"?`,
            showCancelButton: true,
            confirmButtonText: "Sí, actualizar",
            cancelButtonText: "No, mantener",
          }).then((result) => {
            if (result.isConfirmed) {
              fetch("/carrito/envio/actualizar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ direccion: data.direccionNueva }),
              })
                .then((r) => r.json())
                .then((u) => {
                  if (u.success) {
                    Swal.fire("Actualizado", "Su dirección ha sido actualizada.", "success").then(
                      () => (window.location.href = "/carrito/confirmarDatos")
                    );
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
      .catch(() =>
        Swal.fire({ icon: "error", title: "Error", text: "No se pudo conectar con el servidor." })
      );
  });

  // Estado inicial
  mapaContainer.classList.add("hidden");
  datosEnvio.classList.add("hidden");
  if (infoRetiroLocal) infoRetiroLocal.classList.add("hidden");
  if (spinner) spinner.classList.add("hidden");
  if (uberBadge) uberBadge.classList.add("hidden");
  ocultarCostoDelivery();
});
