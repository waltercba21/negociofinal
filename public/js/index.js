/**
 * AUTOFAROS — Home / Index v8.1
 * public/js/pages/index.js
 */

(() => {
  'use strict';

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

  window.abrirMapa = function () {
    window.open('https://maps.app.goo.gl/c6bik6TL7uBQP3KZ8', '_blank');
  };

  // ════════════════════════════════════════════════════════════════════════
  // 1. HEADER SCROLL
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
  // 2. CARRUSEL CATEGORÍAS (scroll horizontal)
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

    const cardStep = () => {
      const gap = parseInt(getComputedStyle(track).gap) || 14;
      return (cards[0].offsetWidth + gap) * 2;
    };

    const scrollPrev = () => track.scrollBy({ left: -cardStep(), behavior: 'smooth' });
    const scrollNext = () => track.scrollBy({ left:  cardStep(), behavior: 'smooth' });

    const updateArrows = () => {
      if (!btnPrev || !btnNext) return;
      btnPrev.disabled = track.scrollLeft <= 4;
      btnNext.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    };

    const stopAuto  = () => { clearInterval(autoId); autoId = null; };
    const startAuto = () => {
      if (prefersReducedMotion() || cards.length < 4 || autoId) return;
      autoId = setInterval(() => {
        const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
        atEnd ? track.scrollTo({ left: 0, behavior: 'smooth' }) : scrollNext();
      }, 3800);
    };
    const pauseThenResume = () => {
      stopAuto();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(startAuto, 2500);
    };

    btnPrev?.addEventListener('click', () => { pauseThenResume(); scrollPrev(); });
    btnNext?.addEventListener('click', () => { pauseThenResume(); scrollNext(); });

    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
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

    let rafId = 0;
    track.addEventListener('scroll', () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => { rafId = 0; updateArrows(); });
    }, { passive: true });

    track.addEventListener('mouseenter', stopAuto);
    track.addEventListener('mouseleave', startAuto);
    track.addEventListener('touchstart',  stopAuto, { passive: true });
    track.addEventListener('focusin',     stopAuto);
    track.addEventListener('focusout',    pauseThenResume);

    updateArrows();
    startAuto();
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. CARRUSEL OFERTAS — translateX slide (1 card a la vez)
  // ════════════════════════════════════════════════════════════════════════
  function setupOfertasCarousel() {
    const track    = $('#ofertasList');       // el flex-row de cards
    const viewport = $('#ofertasViewport');   // overflow:hidden container
    const btnPrev  = $('#ofertaArrowPrev');
    const btnNext  = $('#ofertaArrowNext');
    const dotsWrap = $('.ofertas-dots');

    if (!track || !viewport) return;

    // Selecciona solo las cards de oferta (no empty states)
    const cards = Array.from(track.querySelectorAll('.product-card--oferta'));
    if (!cards.length) return;

    // Asegurar que el track es flex-row y NO tiene display:none en ninguna card
    track.style.display        = 'flex';
    track.style.flexDirection  = 'row';
    track.style.flexWrap       = 'nowrap';
    track.style.height         = '100%';
    cards.forEach(c => {
      c.style.display    = '';   // limpiar cualquier display:none residual
      c.style.flex       = '0 0 100%';
      c.style.width      = '100%';
      c.style.minWidth   = '100%';
      c.style.maxWidth   = '100%';
      c.style.height     = '100%';
    });

    let current    = 0;
    let autoId     = null;
    let resumeTimer = null;
    const total    = cards.length;

    // ── Dots ────────────────────────────────────────────────────────────
    const buildDots = () => {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      cards.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ofertas-dot' + (i === 0 ? ' is-active' : '');
        btn.setAttribute('aria-label', `Oferta ${i + 1}`);
        btn.addEventListener('click', () => { pauseThenResume(); goTo(i); });
        dotsWrap.appendChild(btn);
      });
    };

    const updateDots = () => {
      if (!dotsWrap) return;
      dotsWrap.querySelectorAll('.ofertas-dot').forEach((d, i) => {
        d.classList.toggle('is-active', i === current);
      });
    };

    // ── Render — mueve el track con translateX ───────────────────────────
    const goTo = (idx) => {
      current = ((idx % total) + total) % total;   // wrap
      track.style.transform = `translateX(-${current * 100}%)`;
      if (btnPrev) btnPrev.disabled = false;  // siempre habilitados (loop)
      if (btnNext) btnNext.disabled = false;
      updateDots();
    };

    const next = () => goTo(current + 1);
    const prev = () => goTo(current - 1);

    // ── Autoplay ────────────────────────────────────────────────────────
    const stopAuto  = () => { clearInterval(autoId); autoId = null; };
    const startAuto = () => {
      if (prefersReducedMotion() || total <= 1 || autoId) return;
      autoId = setInterval(next, 4500);
    };
    const pauseThenResume = () => {
      stopAuto();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(startAuto, 3000);
    };

    btnPrev?.addEventListener('click', () => { pauseThenResume(); prev(); });
    btnNext?.addEventListener('click', () => { pauseThenResume(); next(); });

    // Pausa al hacer hover sobre el panel de ofertas
    const panel = viewport.closest('.products-panel--ofertas');
    if (panel) {
      panel.addEventListener('mouseenter', stopAuto);
      panel.addEventListener('mouseleave', startAuto);
      panel.addEventListener('touchstart', stopAuto, { passive: true });
    }

    // ── Swipe touch en el viewport ───────────────────────────────────────
    let touchStartX = 0;
    viewport.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    viewport.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) {
        pauseThenResume();
        dx < 0 ? next() : prev();
      }
    }, { passive: true });

    // ── Ocultar nav si hay 1 sola card ──────────────────────────────────
    if (total <= 1) {
      if (btnPrev) btnPrev.style.visibility = 'hidden';
      if (btnNext) btnNext.style.visibility = 'hidden';
    }

    // Init
    buildDots();
    goTo(0);
    startAuto();
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. ANIMACIONES DE ENTRADA
  // ════════════════════════════════════════════════════════════════════════
  function setupEntranceAnimations() {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;

    if (!document.getElementById('af-fadeup-style')) {
      const s = document.createElement('style');
      s.id = 'af-fadeup-style';
      s.textContent = `
        @keyframes afFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .af-anim-hidden  { opacity: 0; }
        .af-anim-visible { animation: afFadeUp .5s cubic-bezier(0.16,1,0.3,1) both; }
      `;
      document.head.appendChild(s);
    }

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.remove('af-anim-hidden');
        el.classList.add('af-anim-visible');
        el.style.animationDelay = `${i * 70}ms`;
        obs.unobserve(el);
      });
    }, { threshold: 0.07 });

    document.querySelectorAll('.hero-band, .cat-section, .products-panel')
      .forEach(el => { el.classList.add('af-anim-hidden'); obs.observe(el); });
  }

  // ════════════════════════════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════════════════════════════
  function init() {
    setupHeaderScroll();
    setupCatCarousel();
    setupOfertasCarousel();
    setupEntranceAnimations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();