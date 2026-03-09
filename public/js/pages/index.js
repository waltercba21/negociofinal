/**
 * AUTOFAROS — index.js (versión corregida)
 * - Carrusel categorías: autoplay + seguir mouse izquierda/derecha
 * - Carrusel ofertas: autoplay con dots
 */
(() => {
  'use strict';

  window.abrirMapa = function () {
    window.open('https://maps.app.goo.gl/c6bik6TL7uBQP3KZ8', '_blank');
  };

  const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  /* ════════════════════════════════
     1. CARRUSEL CATEGORÍAS
     - Autoplay continuo
     - Mouse sobre el carrusel:
       mitad izquierda → scroll izquierda
       mitad derecha   → scroll derecha
  ════════════════════════════════ */
  function setupCatCarousel() {
    const track = document.getElementById('catTrack');
    if (!track) return;

    const cards = Array.from(track.querySelectorAll('.cat-card'));
    if (cards.length < 2) return;

    let autoId = null;
    let mouseScrollId = null;
    let isHovering = false;
    let mouseDir = 0; // -1 izquierda, 1 derecha, 0 parado

    const SCROLL_SPEED = 1.2; // px por frame en autoplay
    const MOUSE_SPEED  = 2.5; // px por frame al seguir mouse

    /* ── Autoplay suave con rAF ── */
    let autoRaf = null;

    const autoStep = () => {
      if (isHovering) { autoRaf = requestAnimationFrame(autoStep); return; }

      // Al llegar al final, vuelve suavemente al inicio
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (track.scrollLeft >= maxScroll - 2) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollLeft += SCROLL_SPEED;
      }
      autoRaf = requestAnimationFrame(autoStep);
    };

    const startAuto = () => {
      if (prefersReducedMotion()) return;
      if (autoRaf) return;
      autoRaf = requestAnimationFrame(autoStep);
    };

    const stopAuto = () => {
      if (autoRaf) cancelAnimationFrame(autoRaf);
      autoRaf = null;
    };

    /* ── Scroll por mouse (zona izq/der) ── */
    let mouseRaf = null;

    const mouseStep = () => {
      if (!isHovering || mouseDir === 0) { mouseRaf = null; return; }
      track.scrollLeft += mouseDir * MOUSE_SPEED;
      mouseRaf = requestAnimationFrame(mouseStep);
    };

    track.addEventListener('mouseenter', () => {
      isHovering = true;
      stopAuto();
    });

    track.addEventListener('mouseleave', () => {
      isHovering = false;
      mouseDir = 0;
      if (mouseRaf) { cancelAnimationFrame(mouseRaf); mouseRaf = null; }
      startAuto();
    });

    track.addEventListener('mousemove', (e) => {
      const rect = track.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;

      // Zona activa: primero y último 35%
      if (ratio < 0.35) {
        mouseDir = -1;
      } else if (ratio > 0.65) {
        mouseDir = 1;
      } else {
        mouseDir = 0;
      }

      if (mouseDir !== 0 && !mouseRaf) {
        mouseRaf = requestAnimationFrame(mouseStep);
      }
    });

    /* ── Touch: swipe ── */
    let touchStartX = 0;
    track.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      stopAuto();
    }, { passive: true });

    track.addEventListener('touchend', () => {
      setTimeout(startAuto, 1500);
    }, { passive: true });

    /* ── Drag con pointer ── */
    let isDragging = false;
    let dragStartX = 0;
    let dragStartScroll = 0;
    let maxMovement = 0;

    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartScroll = track.scrollLeft;
      maxMovement = 0;
      track.setPointerCapture(e.pointerId);
      stopAuto();
    });

    track.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      maxMovement = Math.max(maxMovement, Math.abs(dx));
      track.scrollLeft = dragStartScroll - dx;
    });

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      if (!isHovering) setTimeout(startAuto, 1500);
    };

    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('lostpointercapture', endDrag);

    // Prevenir click si fue drag
    track.addEventListener('click', (e) => {
      if (maxMovement > 8) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    startAuto();
  }

  /* ════════════════════════════════
     2. CARRUSEL OFERTAS
     - Muestra 2 cards a la vez
     - Autoplay cada 5s
     - Dots indicadores
     - Flechas opcionales
  ════════════════════════════════ */
  function setupOfertasCarousel() {
    const list    = document.getElementById('ofertasList');
    const btnPrev = document.getElementById('ofertaArrowPrev');
    const btnNext = document.getElementById('ofertaArrowNext');
    if (!list) return;

    const cards = Array.from(list.querySelectorAll('.product-card'));
    if (!cards.length) return;

    const perPage = () => window.innerWidth <= 480 ? 1 : 2;
    let page = 0;
    let autoId = null;

    // Crear dots
    let dotsEl = null;
    const viewport = document.getElementById('ofertasViewport');
    if (viewport) {
      dotsEl = document.createElement('div');
      dotsEl.className = 'ofertas-dots';
      viewport.parentNode.insertBefore(dotsEl, viewport.nextSibling);
    }

    const totalPages = () => Math.ceil(cards.length / perPage());

    const render = () => {
      const pp = perPage();
      const start = page * pp;
      const end = start + pp;

      cards.forEach((c, i) => {
        c.classList.toggle('oferta-visible', i >= start && i < end);
      });

      // Flechas
      if (btnPrev) btnPrev.disabled = page === 0;
      if (btnNext) btnNext.disabled = page >= totalPages() - 1;

      // Dots
      if (dotsEl) {
        dotsEl.innerHTML = '';
        const tp = totalPages();
        if (tp > 1) {
          for (let i = 0; i < tp; i++) {
            const dot = document.createElement('button');
            dot.className = 'ofertas-dot' + (i === page ? ' active' : '');
            dot.setAttribute('aria-label', `Página ${i + 1}`);
            dot.addEventListener('click', () => { page = i; render(); resetAuto(); });
            dotsEl.appendChild(dot);
          }
        }
      }
    };

    const next = () => { page = (page + 1) >= totalPages() ? 0 : page + 1; render(); };
    const prev = () => { page = (page - 1) < 0 ? totalPages() - 1 : page - 1; render(); };

    const stopAuto  = () => { clearInterval(autoId); autoId = null; };
    const startAuto = () => {
      if (prefersReducedMotion() || cards.length <= perPage()) return;
      if (autoId) return;
      autoId = setInterval(next, 5000);
    };
    const resetAuto = () => { stopAuto(); startAuto(); };

    btnPrev?.addEventListener('click', () => { prev(); resetAuto(); });
    btnNext?.addEventListener('click', () => { next(); resetAuto(); });

    list.addEventListener('mouseenter', stopAuto);
    list.addEventListener('mouseleave', startAuto);
    list.addEventListener('touchstart', stopAuto, { passive: true });

    let resizeT = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { page = 0; render(); startAuto(); }, 150);
    });

    render();
    startAuto();
  }

  /* ── INIT ── */
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
