document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ envio.js ENVIO OPT v20260119-debug-trace+mobilefix");

  // =========================
  // ELEMENTOS
  // =========================
  const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
  const mapaContainer = document.getElementById("mapa-container");
  const datosEnvio = document.getElementById("datos-envio");
  const inputDireccion = document.getElementById("direccion");
  const btnBuscarDireccion = document.getElementById("buscar-direccion");

  // OJO: hay 2 botones en el EJS (desktop + mobile)
  const btnContinuarPago = document.getElementById("continuar-pago");
  const btnContinuarPagoMobile = document.getElementById("continuar-pago-mobile");

  const infoRetiroLocal = document.getElementById("info-retiro-local");
  const spinner = document.getElementById("spinner");

  const uberBadge = document.getElementById("uber-badge");
  const deliveryCostoBox = document.getElementById("delivery-costo");
  const deliveryCostoValor = document.getElementById("delivery-costo-valor");
  const deliveryHint = document.getElementById("delivery-hint");

  // =========================
  // DEBUG INIT
  // =========================
  const traceId = `env_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  console.log(`[${traceId}] 🔧 DOM ready`);
  console.log(`[${traceId}] 🔧 botones`, {
    continuarDesktop: !!btnContinuarPago,
    continuarMobile: !!btnContinuarPagoMobile,
    radios: tipoEnvioRadios.length,
    inputDireccion: !!inputDireccion,
    btnBuscarDireccion: !!btnBuscarDireccion,
    mapaContainer: !!mapaContainer,
  });

  // Captura de clicks global (para saber qué botón estás tocando realmente)
  document.addEventListener(
    "click",
    (e) => {
      const t = e.target;
      const btn = t && t.closest ? t.closest("#continuar-pago, #continuar-pago-mobile") : null;
      if (btn) {
        console.log(`[${traceId}] 🖱 CLICK CAPTURADO`, {
          id: btn.id,
          tag: btn.tagName,
          typeAttr: btn.getAttribute("type"),
        });
      }
    },
    true
  );

  // =========================
  // MAPA / ESTADO
  // =========================
  let mapa = null;
  let marcador = null;
  let circuloZona = null;

  // Estado de validación delivery
  let deliveryValidado = false;
  let deliveryDentroZona = false;

  // =========================
  // CONFIG
  // =========================
  const direccionLocal = "IGUALDAD 88, Centro, Córdoba";
  const ubicacionCentro = { lat: -31.407473534930432, lng: -64.1830 };
  const RADIO_CIRCUNVALACION_M = 5800;
  const COSTO_DELIVERY = 5000;

  // Restringir búsqueda a Córdoba Capital (viewbox: left,top,right,bottom)
  const CBA_VIEWBOX = { left: -64.30, top: -31.30, right: -64.05, bottom: -31.55 };

  // =========================
  // HELPERS UI
  // =========================
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

  // =========================
  // NOMINATIM
  // =========================
  function buildNominatimSearchURL(q) {
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.searchParams.set("format", "json");
    u.searchParams.set("addressdetails", "1");
    u.searchParams.set("limit", "5");
    u.searchParams.set("countrycodes", "ar");
    u.searchParams.set(
      "viewbox",
      `${CBA_VIEWBOX.left},${CBA_VIEWBOX.top},${CBA_VIEWBOX.right},${CBA_VIEWBOX.bottom}`
    );
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

    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const exact = list.find((e) => {
      const a = e.address || {};
      const city = norm(a.city || a.town || a.municipality || a.city_district);
      const state = norm(a.state);
      return (
        (city === "cordoba" || city === "cordoba capital" || city === "cordoba, cordoba") &&
        state.includes("cordoba")
      );
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

  // =========================
  // MAPA
  // =========================
  function inicializarMapa() {
    if (mapa) return;

    if (typeof L === "undefined") {
      console.warn(`[${traceId}] ⚠ Leaflet (L) no está definido. No se inicializa mapa.`);
      return;
    }

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

    console.log(`[${traceId}] 🗺 mapa inicializado`);
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
    if (!mapa) return;
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
    if (!mapa) return;

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

    console.log(`[${traceId}] 📍 setPuntoDelivery`, { lat, lng, ok, dir });
  }

  // =========================
  // UI: CHANGE TIPO ENVIO
  // =========================
  tipoEnvioRadios.forEach((radio) => {
    radio.addEventListener("change", function () {
      const tipo = this.value;
      console.log(`[${traceId}] 📌 change tipo_envio:`, tipo);

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

        if (mapa) {
          asegurarMarcador(ubicacionCentro.lat, ubicacionCentro.lng, true);
          actualizarPopup("Mové el pin o buscá tu dirección", true);
        }
      } else {
        datosEnvio?.classList.add("hidden");
        infoRetiroLocal?.classList.remove("hidden");

        uberBadge?.classList.add("hidden");
        deliveryHint?.classList.add("hidden");

        ocultarCostoDelivery();

        // importante: limpiar input para no confundir
        if (inputDireccion) inputDireccion.value = "";
        deliveryValidado = false;
        deliveryDentroZona = false;

        if (mapa) {
          asegurarMarcador(ubicacionCentro.lat, ubicacionCentro.lng, false);
          actualizarPopup(direccionLocal, true);
          mapa.setView([ubicacionCentro.lat, ubicacionCentro.lng], 14);
        }
      }
    });
  });

  // =========================
  // BUSCAR DIRECCION
  // =========================
  btnBuscarDireccion?.addEventListener("click", async function () {
    const direccion = inputDireccion?.value?.trim() || "";
    console.log(`[${traceId}] 🔎 click buscar-direccion`, { direccion });

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
      console.error(`[${traceId}] ❌ error buscar direccion`, e);
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo buscar la dirección." });
    } finally {
      setSpinner(false);
    }
  });

  // =========================
  // CONTINUAR (UNIFICADO desktop+mobile)
  // =========================
  function onContinuar(event) {
    event.preventDefault();

    const fromId = event?.target?.closest?.("#continuar-pago, #continuar-pago-mobile")?.id || "unknown";
    const tipoEnvio = getTipoEnvioSeleccionado();
    const direccion = inputDireccion?.value?.trim() || "";

    console.log(`[${traceId}] ▶ continuar`, {
      from: fromId,
      tipoEnvio,
      direccionInput: direccion,
      deliveryValidado,
      deliveryDentroZona,
    });

    if (!tipoEnvio) {
      Swal.fire({ icon: "error", title: "Seleccione un tipo de envío", text: "Debe elegir una opción de envío antes de continuar." });
      return;
    }

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
      traceId,
      tipo_envio: tipoEnvio,
      direccion: tipoEnvio === "delivery" ? direccion : null,
    };

    console.log(`[${traceId}] 📤 POST /carrito/envio payload`, payload);

    fetch("/carrito/envio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        console.log(`[${traceId}] ✅ resp /carrito/envio`, data);

        if (data && data.confirmarCambio) {
          // Solo debería pasar en delivery, pero lo manejamos igual
          return Swal.fire({
            icon: "warning",
            title: "Dirección registrada previamente",
            text: `Tiene la dirección "${data.direccionExistente}" predefinida. ¿Desea cambiarla por "${data.direccionNueva}"?`,
            showCancelButton: true,
            confirmButtonText: "Sí, actualizar",
            cancelButtonText: "No, mantener",
          }).then((result) => {
            if (result.isConfirmed) {
              console.log(`[${traceId}] ✅ usuario confirmó actualizar dirección`);
              return fetch("/carrito/envio/actualizar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  traceId,
                  tipo_envio: "delivery",
                  direccion: data.direccionNueva,
                }),
              })
                .then((r2) => r2.json())
                .then((u) => {
                  console.log(`[${traceId}] ✅ resp /carrito/envio/actualizar`, u);
                  const cid = u?.id_carrito || data?.id_carrito || "";
                  window.location.href = `/carrito/confirmarDatos?carrito_id=${cid}&t=${Date.now()}`;
                });
            } else {
              console.log(`[${traceId}] ❎ usuario mantuvo dirección`);
              const cid = data?.id_carrito || "";
              window.location.href = `/carrito/confirmarDatos?carrito_id=${cid}&t=${Date.now()}`;
            }
          });
        }

        if (data && data.success) {
          const cid = data?.id_carrito || "";
          console.log(`[${traceId}] ➜ redirect confirmarDatos carrito_id=`, cid);
          window.location.href = `/carrito/confirmarDatos?carrito_id=${cid}&t=${Date.now()}`;
          return;
        }

        Swal.fire({
          icon: "error",
          title: "Error",
          text: (data && data.message) ? data.message : "No se pudo guardar el envío.",
        });
      })
      .catch((err) => {
        console.error(`[${traceId}] ❌ error fetch /carrito/envio`, err);
        Swal.fire({ icon: "error", title: "Error", text: "No se pudo conectar con el servidor." });
      });
  }

  btnContinuarPago?.addEventListener("click", onContinuar);
  btnContinuarPagoMobile?.addEventListener("click", onContinuar);

  // Estado inicial
  mapaContainer?.classList.add("hidden");
  datosEnvio?.classList.add("hidden");
  infoRetiroLocal?.classList.add("hidden");
  uberBadge?.classList.add("hidden");
  deliveryHint?.classList.add("hidden");
  ocultarCostoDelivery();
  setSpinner(false);
});
