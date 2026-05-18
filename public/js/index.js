/**
 * AUTOFAROS — Home v8
 * public/js/pages/index.js
 */
(() => {
  'use strict';

  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const noMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const dragGuard = (threshold = 8) => {
    let max = 0;
    return {
      reset()    { max = 0; },
      record(dx) { max = Math.max(max, Math.abs(dx)); },
      wasDrag()  { return max > threshold; }
    };
  };

  window.abrirMapa = () => window.open('https://maps.app.goo.gl/c6bik6TL7uBQP3KZ8', '_blank');

  /* ─────────────────────────────────────────────────
     1. HEADER SCROLL
  ───────────────────────────────────────────────── */
  function initHeaderScroll() {
    const h = qs('.site-header');
    if (!h) return;
    let raf = false;
    window.addEventListener('scroll', () => {
      if (raf) return;
      raf = true;
      requestAnimationFrame(() => {
        h.classList.toggle('scrolled', window.scrollY > 20);
        raf = false;
      });
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────────
     2. CARRUSEL CATEGORÍAS — scroll horizontal
  ───────────────────────────────────────────────── */
  function initCatCarousel() {
    const track   = qs('#catTrack');
    const btnPrev = qs('#catArrowPrev');
    const btnNext = qs('#catArrowNext');
    if (!track) return;

    const cards = qsa('.cat-card', track);
    if (!cards.length) return;

    let autoId, resumeId, dragging = false, startX = 0, startScroll = 0;
    const guard = dragGuard();

    const step = () => (cards[0].offsetWidth + (parseInt(getComputedStyle(track).gap) || 14)) * 2;
    const prev = () => track.scrollBy({ left: -step(), behavior: 'smooth' });
    const next = () => track.scrollBy({ left:  step(), behavior: 'smooth' });

    const updateArrows = () => {
      if (!btnPrev || !btnNext) return;
      btnPrev.disabled = track.scrollLeft <= 4;
      btnNext.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    };

    const stopAuto  = () => { clearInterval(autoId); autoId = null; };
    const startAuto = () => {
      if (noMotion() || cards.length < 4 || autoId) return;
      autoId = setInterval(() => {
        track.scrollLeft >= track.scrollWidth - track.clientWidth - 4
          ? track.scrollTo({ left: 0, behavior: 'smooth' })
          : next();
      }, 3800);
    };
    const pause = () => { stopAuto(); clearTimeout(resumeId); resumeId = setTimeout(startAuto, 2500); };

    btnPrev?.addEventListener('click', () => { pause(); prev(); });
    btnNext?.addEventListener('click', () => { pause(); next(); });

    track.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; startX = e.clientX; startScroll = track.scrollLeft;
      guard.reset(); track.setPointerCapture(e.pointerId);
      track.classList.add('is-dragging'); stopAuto();
    });
    track.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX; guard.record(dx);
      track.scrollLeft = startScroll - dx;
      if (e.pointerType !== 'mouse') e.preventDefault();
    }, { passive: false });
    const endDrag = () => { if (!dragging) return; dragging = false; track.classList.remove('is-dragging'); pause(); };
    track.addEventListener('pointerup',         endDrag);
    track.addEventListener('pointercancel',      endDrag);
    track.addEventListener('lostpointercapture', endDrag);
    track.addEventListener('click', e => { if (guard.wasDrag()) { e.preventDefault(); e.stopPropagation(); } }, true);

    let raf = 0;
    track.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; updateArrows(); }); }, { passive: true });
    track.addEventListener('mouseenter', stopAuto);
    track.addEventListener('mouseleave', startAuto);
    track.addEventListener('touchstart',  stopAuto, { passive: true });
    track.addEventListener('focusin',     stopAuto);
    track.addEventListener('focusout',    pause);

    updateArrows();
    startAuto();
  }

  /* ─────────────────────────────────────────────────
     3. OFERTAS SLIDER — translateX, 1 card a la vez
  ───────────────────────────────────────────────── */
  function initOfertasSlider() {
    const track    = qs('#ofertasList');
    const viewport = qs('#ofertasViewport');
    const btnPrev  = qs('#ofertaArrowPrev');
    const btnNext  = qs('#ofertaArrowNext');
    const dotsWrap = qs('#ofertasDots');
    if (!track || !viewport) return;

    // Solo tomar las cards de oferta (no empty states)
    const cards = qsa('.product-card--oferta', track);
    if (!cards.length) return;

    const total = cards.length;
    let current = 0;
    let autoId, resumeId;

    // Forzar el layout correcto por JS también (doble seguridad)
    Object.assign(track.style, {
      display:       'flex',
      flexDirection: 'row',
      flexWrap:      'nowrap',
      height:        '100%',
      transition:    'transform 380ms cubic-bezier(0.4,0,0.2,1)',
    });
    cards.forEach(c => {
      Object.assign(c.style, {
        flex:     '0 0 100%',
        width:    '100%',
        minWidth: '100%',
        maxWidth: '100%',
        height:   '100%',
      });
    });

    // Dots
    const buildDots = () => {
      if (!dotsWrap || total <= 1) return;
      dotsWrap.innerHTML = '';
      cards.forEach((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ofertas-dot' + (i === 0 ? ' is-active' : '');
        b.setAttribute('aria-label', `Oferta ${i + 1}`);
        b.addEventListener('click', () => { pauseAuto(); goTo(i); });
        dotsWrap.appendChild(b);
      });
    };

    const updateDots = () => {
      if (!dotsWrap) return;
      qsa('.ofertas-dot', dotsWrap).forEach((d, i) => d.classList.toggle('is-active', i === current));
    };

    // Moverse al índice (con wrap)
    const goTo = (idx) => {
      current = ((idx % total) + total) % total;
      track.style.transform = `translateX(-${current * 100}%)`;
      // Botones siempre activos (loop infinito)
      if (btnPrev) btnPrev.disabled = false;
      if (btnNext) btnNext.disabled = false;
      updateDots();
    };

    const next = () => goTo(current + 1);
    const prev = () => goTo(current - 1);

    // Autoplay
    const stopAuto  = () => { clearInterval(autoId); autoId = null; };
    const startAuto = () => {
      if (noMotion() || total <= 1 || autoId) return;
      autoId = setInterval(next, 4500);
    };
    const pauseAuto = () => {
      stopAuto();
      clearTimeout(resumeId);
      resumeId = setTimeout(startAuto, 3000);
    };

    btnPrev?.addEventListener('click', () => { pauseAuto(); prev(); });
    btnNext?.addEventListener('click', () => { pauseAuto(); next(); });

    // Pausa al hover sobre el panel completo
    const panel = viewport.closest('.products-panel');
    if (panel) {
      panel.addEventListener('mouseenter', stopAuto);
      panel.addEventListener('mouseleave', startAuto);
    }

    // Swipe touch
    let touchX = 0;
    viewport.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    viewport.addEventListener('touchend',   e => {
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) { pauseAuto(); dx < 0 ? next() : prev(); }
    }, { passive: true });

    // Si hay solo 1 card, ocultar nav
    if (total <= 1) {
      if (btnPrev) btnPrev.style.display = 'none';
      if (btnNext) btnNext.style.display = 'none';
      if (dotsWrap) dotsWrap.style.display = 'none';
    }

    buildDots();
    goTo(0);
    startAuto();
  }

  /* ─────────────────────────────────────────────────
     4. ANIMACIONES DE ENTRADA
  ───────────────────────────────────────────────── */
  function initAnimations() {
    if (noMotion() || !('IntersectionObserver' in window)) return;
    if (!document.getElementById('af-anim')) {
      const s = document.createElement('style');
      s.id = 'af-anim';
      s.textContent = `
        @keyframes afUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        .af-hidden  { opacity:0 }
        .af-visible { animation:afUp .5s cubic-bezier(0.16,1,0.3,1) both }
      `;
      document.head.appendChild(s);
    }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting) return;
        target.classList.replace('af-hidden', 'af-visible');
        obs.unobserve(target);
      });
    }, { threshold: 0.07 });

    qsa('.hero-band, .cat-section, .products-panel').forEach((el, i) => {
      el.classList.add('af-hidden');
      el.style.animationDelay = `${i * 70}ms`;
      obs.observe(el);
    });
  }

  /* ─────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────── */
  function init() {
    initHeaderScroll();
    initCatCarousel();
    initOfertasSlider();
    initAnimations();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();