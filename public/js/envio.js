document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ envio.js ENVIO OPT v20260119-fix-local");

  const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
  const mapaContainer = document.getElementById("mapa-container");
  const datosEnvio = document.getElementById("datos-envio");
  const inputDireccion = document.getElementById("direccion");
  const btnBuscarDireccion = document.getElementById("buscar-direccion");
  const btnContinuarPago = document.getElementById("continuar-pago");
  const infoRetiroLocal = document.getElementById("info-retiro-local");
  const spinner = document.getElementById("spinner");

  const uberBadge = document.getElementById("uber-badge");
  const deliveryCostoBox = document.getElementById("delivery-costo");
  const deliveryCostoValor = document.getElementById("delivery-costo-valor");
  const deliveryHint = document.getElementById("delivery-hint");

  let mapa = null;
  let marcador = null;
  let circuloZona = null;

  let deliveryValidado = false;
  let deliveryDentroZona = false;

  const direccionLocal = "IGUALDAD 88, Centro, Córdoba";
  const ubicacionCentro = { lat: -31.407473534930432, lng: -64.1830 };
  const RADIO_CIRCUNVALACION_M = 5800;
  const COSTO_DELIVERY = 5000;
  const CBA_VIEWBOX = { left: -64.30, top: -31.30, right: -64.05, bottom: -31.55 };

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

  function setSpinner(on) {
    if (!spinner) return;
    spinner.classList.toggle("hidden", !on);
  }

  function getTipoEnvioSeleccionado() {
    return document.querySelector("input[name='tipo-envio']:checked")?.value || null;
  }

  function isInsideViewbox(lat, lng) {
    const la = Number(lat), lo = Number(lng);
    return (
      lo >= CBA_VIEWBOX.left &&
      lo <= CBA_VIEWBOX.right &&
      la <= CBA_VIEWBOX.top &&
      la >= CBA_VIEWBOX.bottom
    );
  }

  function buildNominatimSearchURL(q) {
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.searchParams.set("format", "json");
    u.searchParams.set("addressdetails", "1");
    u.searchParams.set("limit", "5");
    u.searchParams.set("countrycodes", "ar");
    u.searchParams.set("viewbox", `${CBA_VIEWBOX.left},${CBA_VIEWBOX.top},${CBA_VIEWBOX.right},${CBA_VIEWBOX.bottom}`);
    u.searchParams.set("bounded", "1");
    u.searchParams.set("q", q);
    return u.toString();
  }

  function buildNominatimReverseURL(lat, lng) {
    const u = new URL("https://nominatim.openstreetmap.org/reverse");
    u.searchParams.set("format", "json");
    u.searchParams.set("addressdetails", "1");
    u.searchParams.set("zoom", "18");
    u.searchParams.set("countrycodes", "ar");
    u.searchParams.set("lat", String(lat));
    u.searchParams.set("lon", String(lng));
    return u.toString();
  }

  function pickCordobaCapitalResult(list) {
    if (!Array.isArray(list) || list.length === 0) return null;

    const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const exact = list.find((e) => {
      const a = e.address || {};
      const city = norm(a.city || a.town || a.municipality || a.city_district);
      const state = norm(a.state);
      return (city === "cordoba" || city === "cordoba capital" || city === "cordoba, cordoba") && state.includes("cordoba");
    });

    return exact || list[0];
  }

  async function reverseGeocodeCordoba(lat, lng) {
    if (!isInsideViewbox(lat, lng)) return null;

    try {
      const resp = await fetch(buildNominatimReverseURL(lat, lng));
      const data = await resp.json().catch(() => null);
      if (!data) return null;

      const a = data.address || {};
      const city = String(a.city || a.town || a.municipality || a.city_district || "").toLowerCase();
      const state = String(a.state || "").toLowerCase();

      if (state && !state.includes("córdoba") && !state.includes("cordoba")) return null;
      if (city && city !== "córdoba" && city !== "cordoba") return null;

      const calle = a.road || a.pedestrian || a.footway || "";
      const nro = a.house_number || "";
      const txt = (calle ? `${calle} ${nro}`.trim() : (data.display_name || "")).trim();
      return txt || null;
    } catch {
      return null;
    }
  }

  function inicializarMapa() {
    if (mapa) return;

    mapa = L.map("mapa").setView([ubicacionCentro.lat, ubicacionCentro.lng], 13);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(mapa);

    circuloZona = L.circle([ubicacionCentro.lat, ubicacionCentro.lng], {
      radius: RADIO_CIRCUNVALACION_M,
      color: "green",
      fillColor: "#32CD32",
      fillOpacity: 0.3,
    }).addTo(mapa);

    mapa.fitBounds(circuloZona.getBounds());

    mapa.on("click", async (e) => {
      if (getTipoEnvioSeleccionado() !== "delivery") return;
      await setPuntoDelivery(e.latlng.lat, e.latlng.lng, { completarInput: true });
    });
  }

  function refrescarMapa() {
    if (!mapa) return;
    setTimeout(() => {
      mapa.invalidateSize();
      if (circuloZona) mapa.fitBounds(circuloZona.getBounds());
    }, 200);
  }

  function esUbicacionValida(lat, lng) {
    const centro = L.latLng(ubicacionCentro.lat, ubicacionCentro.lng);
    const punto = L.latLng(parseFloat(lat), parseFloat(lng));
    return centro.distanceTo(punto) <= RADIO_CIRCUNVALACION_M;
  }

  function asegurarMarcador(lat, lng, draggable) {
    const ll = [parseFloat(lat), parseFloat(lng)];

    if (!marcador) {
      marcador = L.marker(ll, { draggable: !!draggable }).addTo(mapa);

      marcador.on("dragend", async () => {
        if (getTipoEnvioSeleccionado() !== "delivery") return;
        const p = marcador.getLatLng();
        await setPuntoDelivery(p.lat, p.lng, { completarInput: true });
      });
    } else {
      marcador.setLatLng(ll);
      if (marcador.dragging) {
        draggable ? marcador.dragging.enable() : marcador.dragging.disable();
      }
    }
  }

  function actualizarPopup(direccion, ok) {
    if (!marcador) return;
    const mensaje = ok
      ? `<b>Dirección:</b> ${direccion}`
      : `<b>Dirección:</b> ${direccion}<br><span style='color:red;'>⛔ Fuera del área de entrega</span>`;
    marcador.bindPopup(mensaje).openPopup();
  }

  async function setPuntoDelivery(lat, lng, { completarInput }) {
    inicializarMapa();

    const ok = esUbicacionValida(lat, lng);
    deliveryValidado = true;
    deliveryDentroZona = ok;

    asegurarMarcador(lat, lng, true);

    let dir = inputDireccion?.value?.trim() || "Ubicación seleccionada";
    if (completarInput) {
      const rev = await reverseGeocodeCordoba(lat, lng);
      if (rev) {
        dir = rev;
        if (inputDireccion) inputDireccion.value = rev;
      }
    }

    actualizarPopup(dir, ok);
    mapa.setView([lat, lng], 14);

    if (ok) mostrarCostoDelivery();
    else ocultarCostoDelivery();
  }

  tipoEnvioRadios.forEach((radio) => {
    radio.addEventListener("change", async function () {
      const tipo = this.value;
      console.log("📌 tipo_envio:", tipo);

      mapaContainer?.classList.remove("hidden");
      inicializarMapa();
      refrescarMapa();

      if (tipo === "delivery") {
        deliveryValidado = false;
        deliveryDentroZona = false;

        datosEnvio?.classList.remove("hidden");
        infoRetiroLocal?.classList.add("hidden");

        uberBadge?.classList.remove("hidden");
        deliveryHint?.classList.remove("hidden");

        ocultarCostoDelivery();

        asegurarMarcador(ubicacionCentro.lat, ubicacionCentro.lng, true);
        actualizarPopup("Mové el pin o buscá tu dirección", true);
        deliveryValidado = false;
      } else {
        datosEnvio?.classList.add("hidden");
        infoRetiroLocal?.classList.remove("hidden");

        uberBadge?.classList.add("hidden");
        deliveryHint?.classList.add("hidden");

        ocultarCostoDelivery();

        if (inputDireccion) inputDireccion.value = "";
        deliveryValidado = false;
        deliveryDentroZona = false;

        asegurarMarcador(ubicacionCentro.lat, ubicacionCentro.lng, false);
        actualizarPopup(direccionLocal, true);
        mapa.setView([ubicacionCentro.lat, ubicacionCentro.lng], 14);
      }
    });
  });

  btnBuscarDireccion?.addEventListener("click", async function () {
    const direccion = inputDireccion?.value?.trim() || "";
    if (!direccion) {
      Swal.fire({ icon: "error", title: "Ingrese una dirección", text: "Por favor, ingrese una dirección válida." });
      return;
    }

    deliveryValidado = false;
    deliveryDentroZona = false;
    ocultarCostoDelivery();

    setSpinner(true);

    try {
      const resp = await fetch(buildNominatimSearchURL(direccion));
      const data = await resp.json().catch(() => []);

      const r0 = pickCordobaCapitalResult(data);
      if (!r0) {
        Swal.fire({ icon: "error", title: "No se encontró en Córdoba Capital", text: "Probá con calle + número." });
        return;
      }

      const lat = parseFloat(r0.lat);
      const lon = parseFloat(r0.lon);

      if (!isInsideViewbox(lat, lon)) {
        Swal.fire({ icon: "error", title: "Fuera de Córdoba Capital", text: "Esa dirección no está dentro del área de búsqueda." });
        return;
      }

      await setPuntoDelivery(lat, lon, { completarInput: false });
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo buscar la dirección." });
    } finally {
      setSpinner(false);
    }
  });

  btnContinuarPago?.addEventListener("click", function (event) {
    event.preventDefault();

    const tipoEnvio = getTipoEnvioSeleccionado();
    if (!tipoEnvio) {
      Swal.fire({ icon: "error", title: "Seleccione un tipo de envío", text: "Debe elegir una opción de envío antes de continuar." });
      return;
    }

    const direccion = inputDireccion?.value?.trim() || "";

    if (tipoEnvio === "delivery") {
      if (!direccion) {
        Swal.fire({ icon: "error", title: "Ingrese una dirección", text: "Por favor, ingrese una dirección válida." });
        return;
      }
      if (!deliveryValidado) {
        Swal.fire({ icon: "error", title: "Validar ubicación", text: "Buscá la dirección o mové el pin para validar el punto de entrega." });
        return;
      }
      if (!deliveryDentroZona) {
        Swal.fire({ icon: "error", title: "Fuera del área", text: "El punto seleccionado está fuera del área de delivery." });
        return;
      }
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
      .then((r) => r.json())
      .then((data) => {
        if (data && data.confirmarCambio) {

          // ✅ FIX: si es RETIRO, actualizar TAMBIÉN tipo_envio (y costo) para que confirmarDatos no muestre delivery
          if (tipoEnvio === "local") {
            return fetch("/carrito/envio/actualizar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tipo_envio: "local", direccion: null }),

            })
              .then((r2) => r2.json())
              .then((u) => {
                if (u && u.success) {
                  window.location.href = "/carrito/confirmarDatos";
                } else {
                  Swal.fire({ icon: "error", title: "Error", text: "No se pudo actualizar el envío." });
                }
              })
              .catch(() => Swal.fire({ icon: "error", title: "Error", text: "No se pudo conectar con el servidor." }));
          }

          // ✅ delivery: confirmación normal
          return Swal.fire({
            icon: "warning",
            title: "Dirección registrada previamente",
            text: `Tiene la dirección "${data.direccionExistente}" predefinida. ¿Desea cambiarla por "${data.direccionNueva}"?`,
            showCancelButton: true,
            confirmButtonText: "Sí, actualizar",
            cancelButtonText: "No, mantener",
          }).then((result) => {
            if (result.isConfirmed) {
              return fetch("/carrito/envio/actualizar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tipo_envio: "delivery", direccion: data.direccionNueva }),

              })
                .then((r2) => r2.json())
                .then((u) => {
                  if (u && u.success) {
                    return Swal.fire("Actualizado", "Su dirección ha sido actualizada.", "success").then(() => {
                      window.location.href = "/carrito/confirmarDatos";
                    });
                  }
                  Swal.fire({ icon: "error", title: "Error", text: "No se pudo actualizar la dirección." });
                });
            } else {
              window.location.href = "/carrito/confirmarDatos";
            }
          });
        }

        if (data && data.success) {
          window.location.href = "/carrito/confirmarDatos";
          return;
        }

        Swal.fire({
          icon: "error",
          title: "Error",
          text: (data && data.message) ? data.message : "No se pudo guardar el envío.",
        });
      })
      .catch(() => {
        Swal.fire({ icon: "error", title: "Error", text: "No se pudo conectar con el servidor." });
      });
  });

  mapaContainer?.classList.add("hidden");
  datosEnvio?.classList.add("hidden");
  infoRetiroLocal?.classList.add("hidden");
  uberBadge?.classList.add("hidden");
  deliveryHint?.classList.add("hidden");
  ocultarCostoDelivery();
  setSpinner(false);
});
