/**
 * AUTOFAROS — index.js
 * Carruseles index robustos
 */
(() => {
  'use strict';

  window.abrirMapa = function () {
    window.open('https://maps.app.goo.gl/c6bik6TL7uBQP3KZ8', '_blank');
  };

  const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  function setupCatCarousel() {
    const track = document.getElementById('catTrack');
    const btnPrev = document.getElementById('catArrowPrev');
    const btnNext = document.getElementById('catArrowNext');

    if (!track || !btnPrev || !btnNext) {
      console.warn('[index.js] Carrusel categorías: faltan elementos');
      return;
    }

    const cards = Array.from(track.querySelectorAll('.cat-card'));

    if (cards.length <= 1) {
      console.warn('[index.js] Carrusel categorías: no hay suficientes cards');
      return;
    }

    const viewport = track.parentElement;

    let index = 0;
    let autoId = null;
    let resumeTimer = null;
    let isDragging = false;
    let startX = 0;
    let dragX = 0;

    track.style.display = 'flex';
    track.style.willChange = 'transform';
    track.style.transition = 'transform 280ms cubic-bezier(.16,1,.3,1)';

    if (viewport) {
      viewport.style.overflow = 'hidden';
    }

    const getGap = () => parseInt(getComputedStyle(track).gap, 10) || 18;

    const getStep = () => {
      const card = cards[0];
      return (card?.getBoundingClientRect().width || 184) + getGap();
    };

    const getVisibleCount = () => {
      const viewportWidth = viewport?.clientWidth || track.parentElement?.clientWidth || window.innerWidth;
      return Math.max(1, Math.floor(viewportWidth / getStep()));
    };

    const getMaxIndex = () => Math.max(0, cards.length - getVisibleCount());

    const render = (animate = true) => {
      const max = getMaxIndex();

      if (index < 0) index = 0;
      if (index > max) index = max;

      track.style.transition = animate ? 'transform 280ms cubic-bezier(.16,1,.3,1)' : 'none';
      track.style.transform = `translateX(${-index * getStep()}px)`;

      const hasMove = max > 0;

      btnPrev.disabled = !hasMove;
      btnNext.disabled = !hasMove;

      btnPrev.style.visibility = hasMove ? 'visible' : 'hidden';
      btnNext.style.visibility = hasMove ? 'visible' : 'hidden';
    };

    const next = () => {
      const max = getMaxIndex();
      index = index >= max ? 0 : index + 1;
      render(true);
    };

    const prev = () => {
      const max = getMaxIndex();
      index = index <= 0 ? max : index - 1;
      render(true);
    };

    const stopAuto = () => {
      if (autoId) clearInterval(autoId);
      autoId = null;
    };

    const startAuto = () => {
      if (prefersReducedMotion()) return;
      if (getMaxIndex() <= 0) return;
      if (autoId) return;

      autoId = setInterval(next, 3500);
    };

    const pauseThenResume = () => {
      stopAuto();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(startAuto, 2300);
    };

    btnPrev.addEventListener('click', (e) => {
      e.preventDefault();
      pauseThenResume();
      prev();
    });

    btnNext.addEventListener('click', (e) => {
      e.preventDefault();
      pauseThenResume();
      next();
    });

    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      isDragging = true;
      startX = e.clientX;
      dragX = 0;
      stopAuto();

      track.style.transition = 'none';
      track.setPointerCapture?.(e.pointerId);
    });

    track.addEventListener('pointermove', (e) => {
      if (!isDragging) return;

      dragX = e.clientX - startX;
      track.style.transform = `translateX(${(-index * getStep()) + dragX}px)`;

      if (e.pointerType !== 'mouse') e.preventDefault();
    }, { passive: false });

    const endDrag = () => {
      if (!isDragging) return;

      isDragging = false;

      if (Math.abs(dragX) > 45) {
        if (dragX < 0) next();
        else prev();
      } else {
        render(true);
      }

      pauseThenResume();
    };

    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('lostpointercapture', endDrag);

    track.addEventListener('click', (e) => {
      if (Math.abs(dragX) <= 8) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    track.addEventListener('mouseenter', stopAuto);
    track.addEventListener('mouseleave', startAuto);

    window.addEventListener('resize', () => {
      index = 0;
      render(false);
      startAuto();
    });

    render(false);
    startAuto();

    console.log('[index.js] Carrusel categorías inicializado:', cards.length);
  }

  function setupOfertasCarousel() {
    const track = document.getElementById('ofertasList');
    const viewport = document.getElementById('ofertasViewport');
    const btnPrev = document.getElementById('ofertaArrowPrev');
    const btnNext = document.getElementById('ofertaArrowNext');
    const dotsWrap = document.getElementById('ofertasDots') || document.getElementById('ofertaDots');

    if (!track || !btnPrev || !btnNext) {
      console.warn('[index.js] Carrusel ofertas: faltan elementos');
      return;
    }

    const cards = Array.from(track.querySelectorAll('.oferta-card, .product-card'));

    if (!cards.length) {
      console.warn('[index.js] Carrusel ofertas: no hay cards');
      return;
    }

    let page = 0;
    let perPage = 2;
    let autoId = null;
    let resumeTimer = null;

    const calcPerPage = () => window.innerWidth <= 768 ? 1 : 2;
    const totalPages = () => Math.max(1, Math.ceil(cards.length / perPage));

    const renderDots = () => {
      if (!dotsWrap) return;

      dotsWrap.innerHTML = '';

      if (totalPages() <= 1) return;

      for (let i = 0; i < totalPages(); i++) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'oferta-dot' + (i === page ? ' is-active' : '');
        dot.setAttribute('aria-label', `Ver grupo de ofertas ${i + 1}`);

        dot.addEventListener('click', () => {
          page = i;
          pauseThenResume();
          render();
        });

        dotsWrap.appendChild(dot);
      }
    };

    const render = () => {
      perPage = calcPerPage();

      if (page >= totalPages()) page = 0;

      const start = page * perPage;
      const end = start + perPage;

      cards.forEach((card, i) => {
        card.style.display = i >= start && i < end ? 'flex' : 'none';
      });

      const hasPages = totalPages() > 1;

      btnPrev.disabled = !hasPages;
      btnNext.disabled = !hasPages;

      btnPrev.style.visibility = hasPages ? 'visible' : 'hidden';
      btnNext.style.visibility = hasPages ? 'visible' : 'hidden';

      renderDots();
    };

    const next = () => {
      page = page + 1 >= totalPages() ? 0 : page + 1;
      render();
    };

    const prev = () => {
      page = page - 1 < 0 ? totalPages() - 1 : page - 1;
      render();
    };

    const stopAuto = () => {
      if (autoId) clearInterval(autoId);
      autoId = null;
    };

    const startAuto = () => {
      if (prefersReducedMotion()) return;
      if (cards.length <= perPage) return;
      if (autoId) return;

      autoId = setInterval(next, 5200);
    };

    const pauseThenResume = () => {
      stopAuto();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(startAuto, 2300);
    };

    btnPrev.addEventListener('click', (e) => {
      e.preventDefault();
      pauseThenResume();
      prev();
    });

    btnNext.addEventListener('click', (e) => {
      e.preventDefault();
      pauseThenResume();
      next();
    });

    track.addEventListener('mouseenter', stopAuto);
    track.addEventListener('mouseleave', startAuto);
    viewport?.addEventListener('touchstart', stopAuto, { passive: true });

    window.addEventListener('resize', () => {
      page = 0;
      render();
      startAuto();
    });

    render();
    startAuto();

    console.log('[index.js] Carrusel ofertas inicializado:', cards.length);
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
