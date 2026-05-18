/**
 * AUTOFAROS — Home v9.3
 * public/js/pages/index.js
 *
 * BUGS CORREGIDOS:
 * - rAF declarado como variable local, no como const en closure
 * - Slider de ofertas: inicialización defensiva con verificación de DOM
 * - Carrusel: verificación de visibilidad antes de scroll
 */
(function () {
  'use strict';

  /* ── Utilidades ─────────────────────────────── */
  function qs(sel, root)  { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function noMotion()     { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches); }

  window.abrirMapa = function () {
    window.open('https://maps.app.goo.gl/c6bik6TL7uBQP3KZ8', '_blank');
  };

  /* ════════════════════════════════════════════
     1. HEADER SCROLL
  ════════════════════════════════════════════ */
  function initHeaderScroll() {
    var header = qs('.site-header');
    if (!header) return;
    var busy = false;
    window.addEventListener('scroll', function () {
      if (busy) return;
      busy = true;
      requestAnimationFrame(function () {
        header.classList.toggle('scrolled', window.scrollY > 20);
        busy = false;
      });
    }, { passive: true });
  }

  /* ════════════════════════════════════════════
     2. CARRUSEL CATEGORÍAS
     Track: #catTrack (overflow-x auto, scroll)
     Cards: .cat-card (hijos directos o descendientes)
     Flechas: #catArrowPrev / #catArrowNext
  ════════════════════════════════════════════ */
  function initCatCarousel() {
    var track   = qs('#catTrack');
    var btnPrev = qs('#catArrowPrev');
    var btnNext = qs('#catArrowNext');

    if (!track) return;

    var cards = qsa('.cat-card', track);
    if (!cards.length) return;

    var autoId    = null;
    var resumeId  = null;
    var dragging  = false;
    var startX    = 0;
    var startScroll = 0;
    var maxDelta  = 0;

    function cardStep() {
      var gap = parseInt(window.getComputedStyle(track).gap, 10) || 14;
      return (cards[0].offsetWidth + gap) * 2;
    }

    function scrollPrev() { track.scrollBy({ left: -cardStep(), behavior: 'smooth' }); }
    function scrollNext() { track.scrollBy({ left:  cardStep(), behavior: 'smooth' }); }

    function updateArrows() {
      if (!btnPrev || !btnNext) return;
      btnPrev.disabled = track.scrollLeft <= 4;
      btnNext.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    }

    function stopAuto() { clearInterval(autoId); autoId = null; }

    function startAuto() {
      if (noMotion() || cards.length < 4 || autoId) return;
      autoId = setInterval(function () {
        if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 4) {
          track.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          scrollNext();
        }
      }, 3800);
    }

    function pauseAuto() {
      stopAuto();
      clearTimeout(resumeId);
      resumeId = setTimeout(startAuto, 2500);
    }

    /* Clic flechas */
    if (btnPrev) btnPrev.addEventListener('click', function () { pauseAuto(); scrollPrev(); });
    if (btnNext) btnNext.addEventListener('click', function () { pauseAuto(); scrollNext(); });

    /* Drag pointer */
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging    = true;
      startX      = e.clientX;
      startScroll = track.scrollLeft;
      maxDelta    = 0;
      track.setPointerCapture(e.pointerId);
      track.classList.add('is-dragging');
      stopAuto();
    });

    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      maxDelta = Math.max(maxDelta, Math.abs(dx));
      track.scrollLeft = startScroll - dx;
      if (e.pointerType !== 'mouse') e.preventDefault();
    }, { passive: false });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      pauseAuto();
    }
    track.addEventListener('pointerup',         endDrag);
    track.addEventListener('pointercancel',      endDrag);
    track.addEventListener('lostpointercapture', endDrag);

    track.addEventListener('click', function (e) {
      if (maxDelta > 8) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    /* Scroll → actualizar flechas */
    var rafId = 0;
    track.addEventListener('scroll', function () {
      if (rafId) return;
      rafId = requestAnimationFrame(function () { rafId = 0; updateArrows(); });
    }, { passive: true });

    track.addEventListener('mouseenter', stopAuto);
    track.addEventListener('mouseleave', startAuto);
    track.addEventListener('touchstart',  stopAuto, { passive: true });

    updateArrows();
    startAuto();
  }

  /* ════════════════════════════════════════════
     3. SLIDER OFERTAS — translateX
     Track: #ofertasList
     Viewport: #ofertasViewport
     Flechas: #ofertaArrowPrev / #ofertaArrowNext
     Dots: #ofertasDots
  ════════════════════════════════════════════ */
  function initOfertasSlider() {
    var track    = qs('#ofertasList');
    var viewport = qs('#ofertasViewport');
    var btnPrev  = qs('#ofertaArrowPrev');
    var btnNext  = qs('#ofertaArrowNext');
    var dotsWrap = qs('#ofertasDots');

    /* Si no hay viewport o track, no hay ofertas — salir silenciosamente */
    if (!track || !viewport) return;

    var cards = qsa('.oferta-card', track);
    if (!cards.length) return;

    var total   = cards.length;
    var current = 0;
    var autoId  = null;
    var resumeId = null;

    /* Forzar layout por JS — neutraliza cualquier CSS externo */
    track.style.cssText += ';display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;height:100%!important;transition:transform 380ms cubic-bezier(0.4,0,0.2,1);will-change:transform;';

    for (var i = 0; i < cards.length; i++) {
      cards[i].style.cssText += ';flex:0 0 100%!important;width:100%!important;min-width:100%!important;height:100%!important;';
    }

    /* Dots */
    function buildDots() {
      if (!dotsWrap || total <= 1) return;
      dotsWrap.innerHTML = '';
      for (var d = 0; d < total; d++) {
        var btn = document.createElement('button');
        btn.className = 'oferta-dot' + (d === 0 ? ' is-active' : '');
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Oferta ' + (d + 1));
        (function(idx) {
          btn.addEventListener('click', function () { pauseSlider(); goTo(idx); });
        })(d);
        dotsWrap.appendChild(btn);
      }
    }

    function syncDots() {
      if (!dotsWrap) return;
      var dots = qsa('.oferta-dot', dotsWrap);
      for (var d = 0; d < dots.length; d++) {
        dots[d].classList.toggle('is-active', d === current);
      }
    }

    /* Ir al slide N */
    function goTo(idx) {
      current = ((idx % total) + total) % total;
      track.style.transform = 'translateX(-' + (current * 100) + '%)';
      if (btnPrev) btnPrev.disabled = false;
      if (btnNext) btnNext.disabled = false;
      syncDots();
    }

    function goPrev() { goTo(current - 1); }
    function goNext() { goTo(current + 1); }

    /* Autoplay */
    function stopSlider()  { clearInterval(autoId); autoId = null; }
    function startSlider() {
      if (noMotion() || total <= 1 || autoId) return;
      autoId = setInterval(goNext, 4500);
    }
    function pauseSlider() {
      stopSlider();
      clearTimeout(resumeId);
      resumeId = setTimeout(startSlider, 3000);
    }

    if (btnPrev) btnPrev.addEventListener('click', function () { pauseSlider(); goPrev(); });
    if (btnNext) btnNext.addEventListener('click', function () { pauseSlider(); goNext(); });

    /* Hover pausa — usar el panel padre si existe, sino el viewport */
    var pauseTarget = viewport.closest('.products-panel') || viewport;
    pauseTarget.addEventListener('mouseenter', stopSlider);
    pauseTarget.addEventListener('mouseleave', startSlider);

    /* Swipe touch */
    var touchStartX = 0;
    viewport.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    viewport.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) {
        pauseSlider();
        if (dx < 0) goNext(); else goPrev();
      }
    }, { passive: true });

    /* Ocultar nav si hay 1 sola card */
    if (total <= 1) {
      if (btnPrev)  btnPrev.style.display  = 'none';
      if (btnNext)  btnNext.style.display  = 'none';
      if (dotsWrap) dotsWrap.style.display = 'none';
    }

    buildDots();
    goTo(0);
    startSlider();
  }

  /* ════════════════════════════════════════════
     4. ANIMACIONES DE ENTRADA
  ════════════════════════════════════════════ */
  function initAnims() {
    if (noMotion() || !('IntersectionObserver' in window)) return;

    var styleId = 'af-anim-style';
    if (!qs('#' + styleId)) {
      var s = document.createElement('style');
      s.id = styleId;
      s.textContent = '@keyframes afUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}.af-h{opacity:0}.af-v{animation:afUp .5s cubic-bezier(.16,1,.3,1) both}';
      document.head.appendChild(s);
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('af-h');
        entry.target.classList.add('af-v');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.07 });

    var targets = qsa('.hero-band, .cat-section, .products-panel');
    targets.forEach(function (el, i) {
      el.classList.add('af-h');
      el.style.animationDelay = (i * 70) + 'ms';
      obs.observe(el);
    });
  }

  /* ════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════ */
  function init() {
    initHeaderScroll();
    initCatCarousel();
    initOfertasSlider();
    initAnims();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());