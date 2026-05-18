/**
 * AUTOFAROS — Home v9.1
 * public/js/pages/index.js
 *
 * FIX: rAF declarado antes de usarse.
 * FIX: syncArrows se llama en scroll con RAF correcto.
 */
(() => {
  'use strict';

  /* ── Helpers ─────────────────────────────── */
  const qs       = (s, r = document) => r.querySelector(s);
  const qsa      = (s, r = document) => [...r.querySelectorAll(s)];
  const rAF      = fn => requestAnimationFrame(fn);   // declarado PRIMERO
  const noMotion = () => window.matchMedia?.('(prefers-reduced-motion:reduce)').matches ?? false;

  window.abrirMapa = () => window.open('https://maps.app.goo.gl/c6bik6TL7uBQP3KZ8', '_blank');

  /* ─────────────────────────────────────────
     1. HEADER SCROLL
  ───────────────────────────────────────── */
  function initHeader() {
    const h = qs('.site-header');
    if (!h) return;
    let busy = false;
    window.addEventListener('scroll', () => {
      if (busy) return;
      busy = true;
      rAF(() => { h.classList.toggle('scrolled', scrollY > 20); busy = false; });
    }, { passive: true });
  }

  /* ─────────────────────────────────────────
     2. CARRUSEL CATEGORÍAS
  ───────────────────────────────────────── */
  function initCatCarousel() {
    const track = qs('#catTrack');
    const btnPrev = qs('#catArrowPrev');
    const btnNext = qs('#catArrowNext');
    if (!track) return;

    const cards = qsa('.cat-card', track);
    if (!cards.length) return;

    let autoId = null, resumeId = null;
    let dragging = false, ox = 0, os = 0, maxD = 0;

    const step = () => {
      const gap = parseInt(getComputedStyle(track).gap) || 14;
      return (cards[0].offsetWidth + gap) * 2;
    };

    const doPrev = () => track.scrollBy({ left: -step(), behavior: 'smooth' });
    const doNext = () => track.scrollBy({ left:  step(), behavior: 'smooth' });

    const syncArrows = () => {
      if (!btnPrev || !btnNext) return;
      btnPrev.disabled = track.scrollLeft <= 4;
      btnNext.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    };

    const stop = () => { clearInterval(autoId); autoId = null; };
    const start = () => {
      if (noMotion() || cards.length < 4 || autoId) return;
      autoId = setInterval(() => {
        if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 4) {
          track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          doNext();
        }
      }, 3800);
    };
    const pause = () => {
      stop();
      clearTimeout(resumeId);
      resumeId = setTimeout(start, 2500);
    };

    /* Flechas */
    btnPrev?.addEventListener('click', () => { pause(); doPrev(); });
    btnNext?.addEventListener('click', () => { pause(); doNext(); });

    /* Drag */
    track.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; ox = e.clientX; os = track.scrollLeft; maxD = 0;
      track.setPointerCapture(e.pointerId);
      track.classList.add('is-dragging');
      stop();
    });
    track.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - ox;
      maxD = Math.max(maxD, Math.abs(dx));
      track.scrollLeft = os - dx;
      if (e.pointerType !== 'mouse') e.preventDefault();
    }, { passive: false });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      pause();
    };
    track.addEventListener('pointerup',         endDrag);
    track.addEventListener('pointercancel',      endDrag);
    track.addEventListener('lostpointercapture', endDrag);
    track.addEventListener('click', e => {
      if (maxD > 8) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    /* Scroll → sync flechas */
    let rafId = 0;
    track.addEventListener('scroll', () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => { rafId = 0; syncArrows(); });
    }, { passive: true });

    track.addEventListener('mouseenter', stop);
    track.addEventListener('mouseleave', start);
    track.addEventListener('touchstart',  stop, { passive: true });

    syncArrows();
    start();
  }

  /* ─────────────────────────────────────────
     3. SLIDER OFERTAS — translateX
  ───────────────────────────────────────── */
  function initOfertasSlider() {
    const track    = qs('#ofertasList');
    const viewport = qs('#ofertasViewport');
    const btnPrev  = qs('#ofertaArrowPrev');
    const btnNext  = qs('#ofertaArrowNext');
    const dotsWrap = qs('#ofertasDots');

    if (!track || !viewport) return;

    const cards = qsa('.oferta-card', track);
    if (!cards.length) return;

    const total = cards.length;
    let cur = 0, autoId = null, resumeId = null;

    /* Forzar layout correcto (Bootstrap puede pisarlo) */
    Object.assign(track.style, {
      display:        'flex',
      flexDirection:  'row',
      flexWrap:       'nowrap',
      height:         '100%',
      transition:     'transform 380ms cubic-bezier(0.4,0,0.2,1)',
      willChange:     'transform',
    });
    cards.forEach(c => {
      Object.assign(c.style, {
        flex:     '0 0 100%',
        width:    '100%',
        minWidth: '100%',
        height:   '100%',
      });
    });

    /* Dots */
    const buildDots = () => {
      if (!dotsWrap || total <= 1) return;
      dotsWrap.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const b = document.createElement('button');
        b.className = 'oferta-dot' + (i === 0 ? ' is-active' : '');
        b.type = 'button';
        b.setAttribute('aria-label', `Oferta ${i + 1}`);
        b.addEventListener('click', () => { pause(); goTo(i); });
        dotsWrap.appendChild(b);
      }
    };
    const syncDots = () => {
      if (!dotsWrap) return;
      qsa('.oferta-dot', dotsWrap).forEach((d, i) => d.classList.toggle('is-active', i === cur));
    };

    /* Ir a slide N */
    const goTo = idx => {
      cur = ((idx % total) + total) % total;
      track.style.transform = `translateX(-${cur * 100}%)`;
      if (btnPrev) btnPrev.disabled = false;
      if (btnNext) btnNext.disabled = false;
      syncDots();
    };

    const goPrev = () => goTo(cur - 1);
    const goNext = () => goTo(cur + 1);

    /* Autoplay */
    const stop = () => { clearInterval(autoId); autoId = null; };
    const start = () => {
      if (noMotion() || total <= 1 || autoId) return;
      autoId = setInterval(goNext, 4500);
    };
    const pause = () => {
      stop();
      clearTimeout(resumeId);
      resumeId = setTimeout(start, 3000);
    };

    btnPrev?.addEventListener('click', () => { pause(); goPrev(); });
    btnNext?.addEventListener('click', () => { pause(); goNext(); });

    /* Pausa hover sobre el panel */
    const panel = viewport.closest('.products-panel');
    if (panel) {
      panel.addEventListener('mouseenter', stop);
      panel.addEventListener('mouseleave', start);
    }

    /* Swipe touch */
    let tx = 0;
    viewport.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
    viewport.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) { pause(); dx < 0 ? goNext() : goPrev(); }
    }, { passive: true });

    /* Ocultar nav si hay 1 sola card */
    if (total <= 1) {
      if (btnPrev) btnPrev.style.display = 'none';
      if (btnNext) btnNext.style.display = 'none';
      if (dotsWrap) dotsWrap.style.display = 'none';
    }

    buildDots();
    goTo(0);
    start();
  }

  /* ─────────────────────────────────────────
     4. ANIMACIONES DE ENTRADA
  ───────────────────────────────────────── */
  function initAnims() {
    if (noMotion() || !('IntersectionObserver' in window)) return;
    if (!qs('#af-anim')) {
      const s = document.createElement('style');
      s.id = 'af-anim';
      s.textContent = `
        @keyframes afUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .af-h { opacity: 0; }
        .af-v { animation: afUp .5s cubic-bezier(.16,1,.3,1) both; }
      `;
      document.head.appendChild(s);
    }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting) return;
        target.classList.replace('af-h', 'af-v');
        obs.unobserve(target);
      });
    }, { threshold: 0.07 });

    qsa('.hero-band, .cat-section, .products-panel').forEach((el, i) => {
      el.classList.add('af-h');
      el.style.animationDelay = `${i * 70}ms`;
      obs.observe(el);
    });
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  function init() {
    initHeader();
    initCatCarousel();
    initOfertasSlider();
    initAnims();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();