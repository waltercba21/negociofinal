/**
 * AUTOFAROS — Home / Index compatible con index.ejs actual
 * public/js/pages/index.js
 */
(() => {
  'use strict';

  const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  window.abrirMapa = function () {
    window.open('https://maps.app.goo.gl/c6bik6TL7uBQP3KZ8', '_blank');
  };

  function setupCatCarousel() {
    const track = document.getElementById('catTrack');
    const btnPrev = document.getElementById('catArrowPrev');
    const btnNext = document.getElementById('catArrowNext');

    if (!track) return;

    const cards = Array.from(track.querySelectorAll('.cat-card'));
    if (!cards.length) return;

    let autoId = null;
    let resumeTimer = null;
    let isDragging = false;
    let startX = 0;
    let startScroll = 0;
    let dragDistance = 0;

    const getGap = () => parseInt(getComputedStyle(track).gap, 10) || 18;
    const getStep = () => {
      const firstCard = cards[0];
      return firstCard ? firstCard.offsetWidth + getGap() : 220;
    };

    const canScroll = () => track.scrollWidth > track.clientWidth + 4;

    const updateArrows = () => {
      if (!btnPrev || !btnNext) return;

      if (!canScroll()) {
        btnPrev.disabled = true;
        btnNext.disabled = true;
        return;
      }

      btnPrev.disabled = track.scrollLeft <= 4;
      btnNext.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    };

    const scrollToLeft = (left) => {
      track.scrollTo({ left, behavior: 'smooth' });
      setTimeout(updateArrows, 280);
    };

    const scrollPrev = () => {
      scrollToLeft(track.scrollLeft - getStep() * 2);
    };

    const scrollNext = () => {
      scrollToLeft(track.scrollLeft + getStep() * 2);
    };

    const stopAuto = () => {
      if (autoId) clearInterval(autoId);
      autoId = null;
    };

    const startAuto = () => {
      if (prefersReducedMotion()) return;
      if (!canScroll()) return;
      if (autoId) return;

      autoId = setInterval(() => {
        const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
        if (atEnd) {
          scrollToLeft(0);
        } else {
          scrollNext();
        }
      }, 3500);
    };

    const pauseThenResume = () => {
      stopAuto();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(startAuto, 2200);
    };

    btnPrev?.addEventListener('click', (e) => {
      e.preventDefault();
      pauseThenResume();
      scrollPrev();
    });

    btnNext?.addEventListener('click', (e) => {
      e.preventDefault();
      pauseThenResume();
      scrollNext();
    });

    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      dragDistance = 0;
      stopAuto();
      track.setPointerCapture?.(e.pointerId);
    });

    track.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      dragDistance = Math.max(dragDistance, Math.abs(dx));
      track.scrollLeft = startScroll - dx;
      updateArrows();
      if (e.pointerType !== 'mouse') e.preventDefault();
    }, { passive: false });

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      pauseThenResume();
    };

    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('lostpointercapture', endDrag);

    track.addEventListener('click', (e) => {
      if (dragDistance <= 8) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    track.addEventListener('scroll', updateArrows, { passive: true });
    track.addEventListener('mouseenter', stopAuto);
    track.addEventListener('mouseleave', startAuto);
    track.addEventListener('touchstart', stopAuto, { passive: true });

    window.addEventListener('resize', () => {
      updateArrows();
      startAuto();
    });

    updateArrows();
    startAuto();
  }

  function setupOfertasCarousel() {
    const track = document.getElementById('ofertasList');
    const viewport = document.getElementById('ofertasViewport');
    const btnPrev = document.getElementById('ofertaArrowPrev');
    const btnNext = document.getElementById('ofertaArrowNext');
    const dotsWrap = document.getElementById('ofertaDots');

    if (!track) return;

    const cards = Array.from(track.querySelectorAll('.oferta-card'));
    if (!cards.length) return;

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
        dot.setAttribute('aria-label', `Ver ofertas ${i + 1}`);
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

      cards.forEach((card, index) => {
        card.style.display = index >= start && index < end ? 'flex' : 'none';
      });

      const hasPages = totalPages() > 1;

      if (btnPrev) {
        btnPrev.disabled = !hasPages;
        btnPrev.style.visibility = hasPages ? 'visible' : 'hidden';
      }

      if (btnNext) {
        btnNext.disabled = !hasPages;
        btnNext.style.visibility = hasPages ? 'visible' : 'hidden';
      }

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
      resumeTimer = setTimeout(startAuto, 2200);
    };

    btnPrev?.addEventListener('click', (e) => {
      e.preventDefault();
      pauseThenResume();
      prev();
    });

    btnNext?.addEventListener('click', (e) => {
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