/**
 * AUTOFAROS — Home / Index v7
 * public/js/pages/index.js
 *
 * Módulos:
 *   1. Carrusel de Categorías — scroll snap + drag + flechas + autoplay + tilt 3D
 *   2. Carrusel de Ofertas   — páginas de 1/2 items + flechas + autoplay
 *   3. Header scroll effect
 *   4. Animaciones de entrada (IntersectionObserver)
 */

(() => {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────
  const $ = (sel, root = document) => root.querySelector(sel);

  const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const makeDragGuard = (threshold = 8) => {
    let maxDelta = 0;
    return {
      reset()    { maxDelta = 0; },
      record(dx) { maxDelta = Math.max(maxDelta, Math.abs(dx)); },
      wasDrag()  { return maxDelta > threshold; }
    };
  };

  // ── Global requerido por header ──────────────────────────────────────────
  window.abrirMapa = function () {
    window.open('https://maps.app.goo.gl/c6bik6TL7uBQP3KZ8', '_blank');
  };

  // ════════════════════════════════════════════════════════════════════════
  // 1. HEADER — efecto scroll
  // ════════════════════════════════════════════════════════════════════════
  function setupHeaderScroll() {
    const header = $('.site-header');
    if (!header) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        header.classList.toggle('scrolled', window.scrollY > 20);
        ticking = false;
      });
    }, { passive: true });
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. TILT 3D EN CARDS
  // ════════════════════════════════════════════════════════════════════════
  function setupCardTilt() {
    if (prefersReducedMotion()) return;
    if (window.matchMedia('(hover: none)').matches) return; // no tilt en touch

    document.querySelectorAll('.cat-card__link').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width  - 0.5;  // -0.5 a 0.5
        const y = (e.clientY - rect.top)  / rect.height - 0.5;
        const rotX = -(y * 10).toFixed(2);
        const rotY =  (x * 10).toFixed(2);
        card.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-6px) scale(1.03)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. CARRUSEL CATEGORÍAS
  // ════════════════════════════════════════════════════════════════════════
  function setupCatCarousel() {
    const track   = $('#catTrack');
    const btnPrev = $('#catArrowPrev');
    const btnNext = $('#catArrowNext');
    if (!track) return;

    const cards = Array.from(track.querySelectorAll('.cat-card'));
    if (!cards.length) return;

    let autoId      = null;
    let resumeTimer = null;
    let isDragging  = false;
    let startX      = 0;
    let startScroll = 0;
    const guard     = makeDragGuard();

    // ── Scroll utilities ────────────────────────────────────────────────
    const cardStep = () => {
      const card = cards[0];
      const gap = parseInt(getComputedStyle(track).gap) || 16;
      return (card.offsetWidth + gap) * 2;
    };

    const scrollPrev = () => track.scrollBy({ left: -cardStep(), behavior: 'smooth' });
    const scrollNext = () => track.scrollBy({ left:  cardStep(), behavior: 'smooth' });

    const updateArrows = () => {
      if (!btnPrev || !btnNext) return;
      btnPrev.disabled = track.scrollLeft <= 4;
      btnNext.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    };

    // ── Autoplay ────────────────────────────────────────────────────────
    const stopAuto  = () => { clearInterval(autoId); autoId = null; };
    const startAuto = () => {
      if (prefersReducedMotion() || cards.length < 4) return;
      if (autoId) return;
      autoId = setInterval(() => {
        const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
        if (atEnd) {
          track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollNext();
        }
      }, 3800);
    };

    const pauseThenResume = () => {
      stopAuto();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(startAuto, 2500);
    };

    // ── Flechas ─────────────────────────────────────────────────────────
    btnPrev?.addEventListener('click', () => { pauseThenResume(); scrollPrev(); });
    btnNext?.addEventListener('click', () => { pauseThenResume(); scrollNext(); });

    // ── Drag ────────────────────────────────────────────────────────────
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDragging  = true;
      startX      = e.clientX;
      startScroll = track.scrollLeft;
      guard.reset();
      track.setPointerCapture(e.pointerId);
      track.classList.add('is-dragging');
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
      track.classList.remove('is-dragging');
      pauseThenResume();
    };

    track.addEventListener('pointerup',         endDrag);
    track.addEventListener('pointercancel',      endDrag);
    track.addEventListener('lostpointercapture', endDrag);

    track.addEventListener('click', (e) => {
      if (!guard.wasDrag()) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // ── Scroll listener ──────────────────────────────────────────────────
    let rafId = 0;
    track.addEventListener('scroll', () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => { rafId = 0; updateArrows(); });
    }, { passive: true });

    // ── Pausa hover / focus ──────────────────────────────────────────────
    track.addEventListener('mouseenter', stopAuto);
    track.addEventListener('mouseleave', startAuto);
    track.addEventListener('touchstart',  stopAuto, { passive: true });
    track.addEventListener('focusin',     stopAuto);
    track.addEventListener('focusout',    pauseThenResume);

    // Init
    updateArrows();
    startAuto();
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. CARRUSEL OFERTAS
  // ════════════════════════════════════════════════════════════════════════
  function setupOfertasCarousel() {
    const list     = $('#ofertasList');
    const viewport = $('#ofertasViewport');
    const btnPrev  = $('#ofertaArrowPrev');
    const btnNext  = $('#ofertaArrowNext');
    if (!list || !viewport) return;

    const cards = Array.from(list.querySelectorAll('.product-card'));
    if (!cards.length) return;

    let page        = 0;
    let perPage     = 1;
    let autoId      = null;
    let resumeTimer = null;

    const calcPerPage = () => window.innerWidth <= 1100 ? 1 : 1;
    const totalPages  = () => Math.ceil(cards.length / perPage);

    const render = () => {
      perPage = calcPerPage();
      const start = page * perPage;
      const end   = start + perPage;

      cards.forEach((card, i) => {
        card.style.display = (i >= start && i < end) ? '' : 'none';
      });

      const tp = totalPages();
      if (btnPrev) btnPrev.disabled = page === 0;
      if (btnNext) btnNext.disabled = page >= tp - 1;

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

    const stopAuto  = () => { clearInterval(autoId); autoId = null; };
    const startAuto = () => {
      if (prefersReducedMotion()) return;
      if (cards.length <= perPage) return;
      if (autoId) return;
      autoId = setInterval(next, 5000);
    };
    const pauseThenResume = () => {
      stopAuto();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(startAuto, 2500);
    };

    btnPrev?.addEventListener('click', () => { pauseThenResume(); prev(); });
    btnNext?.addEventListener('click', () => { pauseThenResume(); next(); });

    list.addEventListener('mouseenter', stopAuto);
    list.addEventListener('mouseleave', startAuto);
    list.addEventListener('touchstart',  stopAuto, { passive: true });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { page = 0; render(); startAuto(); }, 150);
    });

    render();
    startAuto();
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. ANIMACIONES DE ENTRADA
  // ════════════════════════════════════════════════════════════════════════
  function setupEntranceAnimations() {
    if (prefersReducedMotion()) return;
    if (!('IntersectionObserver' in window)) return;

    // Inyectar keyframe si no existe
    if (!document.getElementById('af-fadeup-style')) {
      const style = document.createElement('style');
      style.id = 'af-fadeup-style';
      style.textContent = `
        @keyframes afFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .af-anim-hidden { opacity: 0; }
        .af-anim-visible {
          animation: afFadeUp 0.55s cubic-bezier(0.16,1,0.3,1) both;
        }
      `;
      document.head.appendChild(style);
    }

    const targets = document.querySelectorAll('.hero-band, .cat-section, .products-panel');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.classList.remove('af-anim-hidden');
          el.classList.add('af-anim-visible');
          el.style.animationDelay = `${i * 80}ms`;
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.08 });

    targets.forEach(el => {
      el.classList.add('af-anim-hidden');
      observer.observe(el);
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════════════════════════════
  function init() {
    setupHeaderScroll();
    setupCatCarousel();
    setupOfertasCarousel();
    setupCardTilt();
    setupEntranceAnimations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();