/**
 * AUTOFAROS — index.js
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
  ════════════════════════════════ */
  function setupCatCarousel() {
    const track   = document.getElementById('catTrack');
    const wrapper = document.querySelector('.cat-carousel__track-wrapper');
    if (!track || !wrapper) return;

    const cards = Array.from(track.querySelectorAll('.cat-card'));
    if (cards.length < 2) return;

    // Forzar que el track se expanda
    track.style.width    = 'max-content';
    track.style.minWidth = '100%';
    wrapper.style.overflow = 'hidden';

    let isHovering = false;
    let mouseDir   = 0;
    let autoRaf    = null;
    let mouseRaf   = null;

    const SCROLL_SPEED = 1.2;
    const MOUSE_SPEED  = 3.0;

    /* ── Autoplay ── */
    const autoStep = () => {
      if (!isHovering) {
        const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
        if (wrapper.scrollLeft >= maxScroll - 2) {
          wrapper.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          wrapper.scrollLeft += SCROLL_SPEED;
        }
      }
      autoRaf = requestAnimationFrame(autoStep);
    };

    const startAuto = () => {
      if (prefersReducedMotion() || autoRaf) return;
      autoRaf = requestAnimationFrame(autoStep);
    };

    const stopAuto = () => {
      if (autoRaf) cancelAnimationFrame(autoRaf);
      autoRaf = null;
    };

    /* ── Mouse scroll por zona ── */
    const mouseStep = () => {
      if (!isHovering || mouseDir === 0) { mouseRaf = null; return; }
      wrapper.scrollLeft += mouseDir * MOUSE_SPEED;
      mouseRaf = requestAnimationFrame(mouseStep);
    };

    wrapper.addEventListener('mouseenter', () => { isHovering = true; });
    wrapper.addEventListener('mouseleave', () => {
      isHovering = false;
      mouseDir = 0;
      if (mouseRaf) { cancelAnimationFrame(mouseRaf); mouseRaf = null; }
    });

    wrapper.addEventListener('mousemove', (e) => {
      const rect  = wrapper.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;

      if (ratio < 0.3)       mouseDir = -1;
      else if (ratio > 0.7)  mouseDir =  1;
      else                   mouseDir =  0;

      if (mouseDir !== 0 && !mouseRaf) {
        mouseRaf = requestAnimationFrame(mouseStep);
      }
    });

    /* ── Touch swipe ── */
    let touchStartX = 0;
    wrapper.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
      const dx = touchStartX - e.touches[0].clientX;
      wrapper.scrollLeft += dx * 0.5;
    }, { passive: true });

    /* ── Drag con pointer ── */
    let isDragging    = false;
    let dragStartX    = 0;
    let dragStartScroll = 0;
    let maxMovement   = 0;

    wrapper.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDragging      = true;
      dragStartX      = e.clientX;
      dragStartScroll = wrapper.scrollLeft;
      maxMovement     = 0;
      wrapper.setPointerCapture(e.pointerId);
    });

    wrapper.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      maxMovement = Math.max(maxMovement, Math.abs(dx));
      wrapper.scrollLeft = dragStartScroll - dx;
    });

    const endDrag = () => { isDragging = false; };
    wrapper.addEventListener('pointerup',          endDrag);
    wrapper.addEventListener('pointercancel',      endDrag);
    wrapper.addEventListener('lostpointercapture', endDrag);

    wrapper.addEventListener('click', (e) => {
      if (maxMovement > 8) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    startAuto();
  }

  /* ════════════════════════════════
     2. CARRUSEL OFERTAS
  ════════════════════════════════ */
  function setupOfertasCarousel() {
    const list    = document.getElementById('ofertasList');
    const btnPrev = document.getElementById('ofertaArrowPrev');
    const btnNext = document.getElementById('ofertaArrowNext');
    if (!list) return;

    const cards = Array.from(list.querySelectorAll('.product-card'));
    if (!cards.length) return;

    const perPage     = () => window.innerWidth <= 480 ? 1 : 2;
    let page          = 0;
    let autoId        = null;

    // Dots
    let dotsEl = null;
    const viewport = document.getElementById('ofertasViewport');
    if (viewport) {
      dotsEl = document.createElement('div');
      dotsEl.className = 'ofertas-dots';
      viewport.parentNode.insertBefore(dotsEl, viewport.nextSibling);
    }

    const totalPages = () => Math.ceil(cards.length / perPage());

    const render = () => {
      const pp    = perPage();
      const start = page * pp;
      const end   = start + pp;

      cards.forEach((c, i) => {
        c.classList.toggle('oferta-visible', i >= start && i < end);
      });

      if (btnPrev) btnPrev.disabled = page === 0;
      if (btnNext) btnNext.disabled = page >= totalPages() - 1;

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
    list.addEventListener('touchstart',  stopAuto, { passive: true });

    let resizeT = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { page = 0; render(); startAuto(); }, 150);
    });

    render();
    startAuto();
  }

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