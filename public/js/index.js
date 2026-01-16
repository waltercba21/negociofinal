// index.js (REEMPLAZAR COMPLETO)

(() => {
  "use strict";

  // ===================== Helpers =====================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  // Evita “click” después de drag
// Evita “click” después de drag (FIX: medir MAX desplazamiento, no sumatoria)
const makeDragGuard = () => {
  let moved = 0;
  return {
    reset() { moved = 0; },
    add(dx) { moved = Math.max(moved, Math.abs(dx)); }, // <-- FIX
    isDragClick() { return moved > 8; }
  };
};


  // ===================== Header toggle (menu) =====================
  // Mantiene compatibilidad con tu HTML: <button class="hamburger" onclick="toggleMenu()">
  window.toggleMenu = function toggleMenu() {
    const header = $("header");
    const navbar = $(".navbar");

    if (header) header.classList.toggle("open");

    // fallback si no existiera CSS de .open
    if (navbar) {
      const isOpen = header ? header.classList.contains("open") : navbar.style.display !== "none";
      navbar.style.display = isOpen ? "flex" : "none";
    }

    // NO ocultamos .icons (eran acciones clave y se perdían en mobile)
  };

  window.abrirMapa = function abrirMapa() {
    window.open("https://maps.app.goo.gl/c6bik6TL7uBQP3KZ8", "_blank");
  };

// ===================== Carrusel Categorías =====================
function setupCategoriasCarousel() {
  const scroller = $(".contenedor-carrousel");
  if (!scroller) return;

  const row = $(".carrousel", scroller) || scroller;
  const items = $$(".pelicula", row);
  if (!items.length) return;

  // Soporta ambos: .flecha-izquierda/.flecha-derecha o #flecha-izquierda/#flecha-derecha
  const btnLeft = $(".flecha-izquierda") || $("#flecha-izquierda");
  const btnRight = $(".flecha-derecha") || $("#flecha-derecha");

  const indicadores = $$(".indicadores button, .indicadores span, .indicadores div");
  let autoplayId = null;
  let resumeTimeout = null;

  const dragGuard = makeDragGuard();
  let isDragging = false;
  let startX = 0;
  let startScrollLeft = 0;

  // Para mouse-move scroll
  let rafMove = 0;
  let lastMoveX = 0;

  const getActiveIndex = () => {
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    let bestI = 0;
    let bestD = Infinity;

    for (let i = 0; i < items.length; i++) {
      const el = items[i];
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const d = Math.abs(elCenter - center);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    return bestI;
  };

  const scrollToIndex = (i, behavior = "smooth") => {
    const idx = clamp(i, 0, items.length - 1);
    const el = items[idx];
    const target =
      el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;

    scroller.scrollTo({ left: target, behavior });
    setIndicador(idx);
  };

  const setIndicador = (idx) => {
    if (!indicadores.length) return;

    indicadores.forEach((n) => n.classList && n.classList.remove("activo"));

    if (indicadores[idx] && indicadores[idx].classList) {
      indicadores[idx].classList.add("activo");
    }
  };

  const next = () => {
    const i = getActiveIndex();
    const ni = (i + 1) % items.length;
    scrollToIndex(ni, "smooth");
  };

  const prev = () => {
    const i = getActiveIndex();
    const pi = (i - 1 + items.length) % items.length;
    scrollToIndex(pi, "smooth");
  };

  const stopAutoplay = () => {
    if (autoplayId) clearInterval(autoplayId);
    autoplayId = null;
  };

  const startAutoplay = () => {
    if (prefersReducedMotion()) return;
    if (items.length <= 1) return;
    if (autoplayId) return;

    autoplayId = setInterval(next, 4500);
  };

  const pauseThenResume = () => {
    stopAutoplay();
    if (resumeTimeout) clearTimeout(resumeTimeout);
    resumeTimeout = setTimeout(() => startAutoplay(), 1400);
  };

  // Flechas (solo si existen)
  if (btnRight) btnRight.addEventListener("click", () => { pauseThenResume(); next(); });
  if (btnLeft) btnLeft.addEventListener("click", () => { pauseThenResume(); prev(); });

  // ✅ Click navegación (robusto aunque pointer-capture “retargetee” el click al scroller)
  scroller.addEventListener("click", (e) => {
    if (dragGuard.isDragClick()) return;

    // El elemento real bajo el puntero (más fiable que e.target acá)
    const el = document.elementFromPoint(e.clientX, e.clientY) || e.target;

    // Si hay link, navegamos por href
    const link = el && el.closest("a.pelicula-link");
    if (link) {
      e.preventDefault();
      window.location.href = link.getAttribute("href");
      return;
    }

    // Fallback: data-categoria
    const pelicula = el && el.closest(".pelicula");
    if (!pelicula) return;

    const img = $(".imagen-carrusel", pelicula) || pelicula.querySelector("img");
    if (!img) return;

    const categoria = img.getAttribute("data-categoria");
    if (!categoria) return;

    window.location.href = `/productos?categoria=${encodeURIComponent(categoria)}`;
  });

  // Drag (pointer events) + snap al soltar
  scroller.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    isDragging = true;
    dragGuard.reset();

    startX = e.clientX;
    startScrollLeft = scroller.scrollLeft;

    scroller.setPointerCapture(e.pointerId);
    scroller.style.cursor = "grabbing";

    stopAutoplay();
  });

  scroller.addEventListener("pointermove", (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    dragGuard.add(dx);

    scroller.scrollLeft = startScrollLeft - dx;
    if (e.pointerType !== "mouse") e.preventDefault();
  }, { passive: false });

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;

    scroller.style.cursor = "";
    scrollToIndex(getActiveIndex(), "smooth");
    pauseThenResume();
  };

  scroller.addEventListener("pointerup", endDrag);
  scroller.addEventListener("pointercancel", endDrag);
  scroller.addEventListener("lostpointercapture", endDrag);

  // “Mover el mouse” para desplazar (desktop): suave y sin arrastrar
  const canMouseMoveScroll =
    window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches;

  if (canMouseMoveScroll) {
    scroller.addEventListener("mousemove", (e) => {
      if (isDragging) return;
      lastMoveX = e.clientX;

      if (rafMove) return;
      rafMove = requestAnimationFrame(() => {
        rafMove = 0;

        const rect = scroller.getBoundingClientRect();
        const x = clamp(lastMoveX - rect.left, 0, rect.width);
        const ratio = rect.width ? (x / rect.width) : 0;
        const maxScroll = scroller.scrollWidth - scroller.clientWidth;
        const target = ratio * maxScroll;

        scroller.scrollLeft += (target - scroller.scrollLeft) * 0.12;
      });
    });

    scroller.addEventListener("mouseenter", () => stopAutoplay());
    scroller.addEventListener("mouseleave", () => {
      scrollToIndex(getActiveIndex(), "smooth");
      startAutoplay();
    });
  }

  // Pausa en interacción
  scroller.addEventListener("touchstart", stopAutoplay, { passive: true });
  scroller.addEventListener("focusin", stopAutoplay);
  scroller.addEventListener("focusout", pauseThenResume);

  // Actualiza indicador al hacer scroll manual (throttle con rAF)
  let rafScroll = 0;
  scroller.addEventListener("scroll", () => {
    if (rafScroll) return;
    rafScroll = requestAnimationFrame(() => {
      rafScroll = 0;
      setIndicador(getActiveIndex());
    });
  });

  // Arranque inicial
  setIndicador(getActiveIndex());
  startAutoplay();
}


  // ===================== Carrusel Ofertas =====================
  function setupOfertasCarousel() {
    const contenedor = $(".contenedor-productos-ofertas");
    if (!contenedor) return;

    const tarjetas = $$(".card-oferta", contenedor);
    const flechaIzq = $(".flecha-izquierda-ofertas");
    const flechaDer = $(".flecha-derecha-ofertas");
    if (!tarjetas.length) return;

    let index = 0;
    let cardsPerView = 3;
    let autoId = null;
    let resumeTimeout = null;

    const calcCardsPerView = () => {
      const w = window.innerWidth;
      if (w <= 520) return 1;
      if (w <= 920) return 2;
      return 3;
    };

    const render = () => {
      cardsPerView = calcCardsPerView();

      const total = tarjetas.length;
      const maxIndex = Math.max(0, Math.ceil(total / cardsPerView) - 1);
      index = clamp(index, 0, maxIndex);

      const start = index * cardsPerView;
      const end = start + cardsPerView;

      tarjetas.forEach((t, i) => {
        t.style.display = (i >= start && i < end) ? "flex" : "none";
      });

      // si no hay “páginas”, ocultá flechas y frená autoplay
      const needNav = total > cardsPerView;
      if (flechaIzq) flechaIzq.style.display = needNav ? "flex" : "none";
      if (flechaDer) flechaDer.style.display = needNav ? "flex" : "none";

      if (!needNav) stopAuto();
    };

    const next = () => {
      const total = tarjetas.length;
      const maxIndex = Math.max(0, Math.ceil(total / cardsPerView) - 1);
      index = (index + 1) > maxIndex ? 0 : index + 1;
      render();
    };

    const prev = () => {
      const total = tarjetas.length;
      const maxIndex = Math.max(0, Math.ceil(total / cardsPerView) - 1);
      index = (index - 1) < 0 ? maxIndex : index - 1;
      render();
    };

    const stopAuto = () => {
      if (autoId) clearInterval(autoId);
      autoId = null;
    };

    const startAuto = () => {
      if (prefersReducedMotion()) return;
      if (autoId) return;
      if (tarjetas.length <= cardsPerView) return;
      autoId = setInterval(next, 6000);
    };

    const pauseThenResume = () => {
      stopAuto();
      if (resumeTimeout) clearTimeout(resumeTimeout);
      resumeTimeout = setTimeout(() => startAuto(), 1400);
    };

    if (flechaDer) flechaDer.addEventListener("click", () => { pauseThenResume(); next(); });
    if (flechaIzq) flechaIzq.addEventListener("click", () => { pauseThenResume(); prev(); });

    // Pausa al interactuar
    contenedor.addEventListener("mouseenter", stopAuto);
    contenedor.addEventListener("mouseleave", () => startAuto());
    contenedor.addEventListener("touchstart", stopAuto, { passive: true });

    // Recalcula en resize (debounce)
    let resizeT = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        render();
        startAuto();
      }, 120);
    });

    render();
    startAuto();
  }

  // ===================== Init =====================
  document.addEventListener("DOMContentLoaded", () => {
    // Importante: eliminamos el comportamiento viejo que escondía navbar/icons en mobile.
    // (Eso rompía acciones clave y UX)

    setupCategoriasCarousel();
    setupOfertasCarousel();
  });

})();
