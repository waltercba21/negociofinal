/**
 * AUTOFAROS — Home / Index
 * public/js/pages/index.js
 *
 * Módulos:
 *   1. Carrusel de Categorías — scroll horizontal + flechas + drag + autoplay
 *   2. Carrusel de Ofertas    — páginas de 2 items + flechas + autoplay
 */

(() => {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────
  const $ = (sel, root = document) => root.querySelector(sel);

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  /** Devuelve true si el pointer se movió más de `threshold` px durante el drag */
  const makeDragGuard = (threshold = 8) => {
    let maxDelta = 0;
    return {
      reset()    { maxDelta = 0; },
      record(dx) { maxDelta = Math.max(maxDelta, Math.abs(dx)); },
      wasDrag()  { return maxDelta > threshold; }
    };
  };

  // ── Función global requerida por header y otros módulos ──────────────────
  window.abrirMapa = function () {
    window.open('https://maps.app.goo.gl/c6bik6TL7uBQP3KZ8', '_blank');
  };

  // ════════════════════════════════════════════════════════════════════════
  // 1. CARRUSEL CATEGORÍAS
  // ════════════════════════════════════════════════════════════════════════
  function setupCatCarousel() {
    const track   = document.getElementById('catTrack');
    const btnPrev = document.getElementById('catArrowPrev');
    const btnNext = document.getElementById('catArrowNext');
    if (!track) return;

    const cards = Array.from(track.querySelectorAll('.cat-card'));
    if (!cards.length) return;

    let autoId       = null;
    let resumeTimer  = null;
    let isDragging   = false;
    let startX       = 0;
    let startScroll  = 0;
    const guard      = makeDragGuard();

    // ── Utilidades de scroll ────────────────────────────────────────────
    const scrollBy = (px, behavior = 'smooth') => {
      track.scrollBy({ left: px, behavior });
    };

    /** Ancho de una card + gap */
    const cardStep = () => {
      const card = cards[0];
      const gap = parseInt(getComputedStyle(track).gap) || 16;
      return card.offsetWidth + gap;
    };

    const scrollPrev = () => scrollBy(-cardStep() * 2);
    const scrollNext = () => scrollBy(cardStep() * 2);

    // ── Actualizar estado de flechas ────────────────────────────────────
    const updateArrows = () => {
      if (!btnPrev || !btnNext) return;
      btnPrev.disabled = track.scrollLeft <= 4;
      btnNext.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    };

    // ── Autoplay ────────────────────────────────────────────────────────
    const stopAuto = () => {
      clearInterval(autoId);
      autoId = null;
    };

    const startAuto = () => {
      if (prefersReducedMotion() || cards.length < 3) return;
      if (autoId) return;
      autoId = setInterval(() => {
        // Si llegó al final, vuelve al inicio
        const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
        if (atEnd) {
          track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollNext();
        }
      }, 3500);
    };

    const pauseThenResume = () => {
      stopAuto();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(startAuto, 2000);
    };

    // ── Flechas ─────────────────────────────────────────────────────────
    btnPrev?.addEventListener('click', () => { pauseThenResume(); scrollPrev(); });
    btnNext?.addEventListener('click', () => { pauseThenResume(); scrollNext(); });

    // ── Drag con pointer events ──────────────────────────────────────────
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDragging  = true;
      startX      = e.clientX;
      startScroll = track.scrollLeft;
      guard.reset();
      track.setPointerCapture(e.pointerId);
      stopAuto();
    });

    track.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      guard.record(dx);
      track.scrollLeft = startScroll - dx;
      if (e.pointerType !== 'mouse') e.preventDefault();
    }, { passive: false });

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      pauseThenResume();
    };

    track.addEventListener('pointerup',         endDrag);
    track.addEventListener('pointercancel',      endDrag);
    track.addEventListener('lostpointercapture', endDrag);

    // ── Prevenir navegación en click si fue drag ─────────────────────────
    track.addEventListener('click', (e) => {
      if (!guard.wasDrag()) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // ── Scroll listener → actualizar flechas ────────────────────────────
    let rafScroll = 0;
    track.addEventListener('scroll', () => {
      if (rafScroll) return;
      rafScroll = requestAnimationFrame(() => { rafScroll = 0; updateArrows(); });
    }, { passive: true });

    // ── Pausa hover ─────────────────────────────────────────────────────
    track.addEventListener('mouseenter', stopAuto);
    track.addEventListener('mouseleave', startAuto);
    track.addEventListener('touchstart', stopAuto, { passive: true });
    track.addEventListener('focusin',    stopAuto);
    track.addEventListener('focusout',   pauseThenResume);

    // Init
    updateArrows();
    startAuto();
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. CARRUSEL OFERTAS
  // ════════════════════════════════════════════════════════════════════════
  function setupOfertasCarousel() {
    const list     = document.getElementById('ofertasList');
    const viewport = document.getElementById('ofertasViewport');
    const btnPrev  = document.getElementById('ofertaArrowPrev');
    const btnNext  = document.getElementById('ofertaArrowNext');
    if (!list || !viewport) return;

    const cards = Array.from(list.querySelectorAll('.product-card'));
    if (!cards.length) return;

    let page        = 0;
    let perPage     = 2;
    let autoId      = null;
    let resumeTimer = null;

    const calcPerPage = () => {
      return window.innerWidth <= 480 ? 1 : 2;
    };

    const totalPages = () => Math.ceil(cards.length / perPage);

    const render = () => {
      perPage = calcPerPage();
      const start = page * perPage;
      const end   = start + perPage;

      cards.forEach((card, i) => {
        card.style.display = (i >= start && i < end) ? 'flex' : 'none';
      });

      const tp = totalPages();
      if (btnPrev) btnPrev.disabled = page === 0;
      if (btnNext) btnNext.disabled = page >= tp - 1;

      // Ocultar nav si no es necesaria
      const showNav = tp > 1;
      if (btnPrev) btnPrev.style.visibility = showNav ? '' : 'hidden';
      if (btnNext) btnNext.style.visibility = showNav ? '' : 'hidden';
    };

    const next = () => {
      page = (page + 1) >= totalPages() ? 0 : page + 1;
      render();
    };

    const prev = () => {
      page = (page - 1) < 0 ? totalPages() - 1 : page - 1;
      render();
    };

    const stopAuto = () => { clearInterval(autoId); autoId = null; };

    const startAuto = () => {
      if (prefersReducedMotion()) return;
      if (cards.length <= perPage) return;
      if (autoId) return;
      autoId = setInterval(next, 5500);
    };

    const pauseThenResume = () => {
      stopAuto();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(startAuto, 2000);
    };

    btnPrev?.addEventListener('click', () => { pauseThenResume(); prev(); });
    btnNext?.addEventListener('click', () => { pauseThenResume(); next(); });

    list.addEventListener('mouseenter', stopAuto);
    list.addEventListener('mouseleave', startAuto);
    list.addEventListener('touchstart', stopAuto, { passive: true });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { page = 0; render(); startAuto(); }, 150);
    });

    render();
    startAuto();
  }

  // ════════════════════════════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════════════════════════════
  function init() {
    setupCatCarousel();
    setupOfertasCarousel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
