// public/js/pages/detalle.js
// Autofaros v2026-03-18

/* ══════════════════════════════════════════════
   CAROUSEL GALERÍA
══════════════════════════════════════════════ */
(function initGallery() {
  const track    = document.getElementById('carousel-detalle');
  const btnPrev  = document.getElementById('det-prev');
  const btnNext  = document.getElementById('det-next');
  const thumbs   = document.querySelectorAll('.det-gallery__thumb');

  if (!track) return;

  const imagenes = track.querySelectorAll('.det-gallery__img');
  if (!imagenes.length) return;

  let current = 0;

  function goTo(idx) {
    imagenes[current].classList.add('hidden');
    thumbs[current]?.classList.remove('is-active');
    current = (idx + imagenes.length) % imagenes.length;
    imagenes[current].classList.remove('hidden');
    thumbs[current]?.classList.add('is-active');
  }

  btnPrev?.addEventListener('click', () => goTo(current - 1));
  btnNext?.addEventListener('click', () => goTo(current + 1));

  thumbs.forEach((btn, i) => {
    btn.addEventListener('click', () => goTo(i));
  });

  // Click para ampliar
  track.addEventListener('click', () => {
    const src = imagenes[current]?.src;
    if (!src) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 8px 48px rgba(0,0,0,.6)';
    overlay.appendChild(img);
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  });
})();

/* ══════════════════════════════════════════════
   CANTIDAD + CARRITO
══════════════════════════════════════════════ */
(function initCart() {
  const qInput = document.getElementById('det-qty');
  const btnMin = document.getElementById('det-qty-minus');
  const btnMax = document.getElementById('det-qty-plus');
  const btnAdd = document.getElementById('det-btn-cart');

  if (!qInput) return;

  btnMin?.addEventListener('click', () => {
    const v = parseInt(qInput.value) || 1;
    qInput.value = Math.max(1, v - 1);
  });
  btnMax?.addEventListener('click', () => {
    const v = parseInt(qInput.value) || 1;
    qInput.value = Math.min(parseInt(qInput.max) || 99, v + 1);
  });

  btnAdd?.addEventListener('click', () => {
    const productoId = btnAdd.dataset.id;
    const cantidad   = parseInt(qInput.value) || 1;
    if (!productoId) return;
    document.dispatchEvent(new CustomEvent('af:addToCart', {
      detail: { id: productoId, cantidad },
      bubbles: true
    }));
  });
})();

/* ══════════════════════════════════════════════
   BUSCADOR DE APLICACIONES (COMPATIBILIDADES)
══════════════════════════════════════════════ */
(function initAppsSearch() {
  const list     = document.getElementById('appsList');
  const input    = document.getElementById('appsSearch');
  const clearBtn = document.getElementById('appsClear');
  const emptyMsg = document.getElementById('appsEmpty');
  const countEl  = document.getElementById('appsCount');

  if (!list || !input) return;

  let allItems = [];
  try { allItems = JSON.parse(list.dataset.items || '[]'); } catch(_) {}

  const totalCount = allItems.length;

  function escHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function highlight(text, query) {
    if (!query) return escHtml(text);
    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escHtml(text).replace(re, '<mark class="apps-hl">$1</mark>');
  }

  function render(query) {
    const q = (query || '').trim().toLowerCase();
    const filtered = q ? allItems.filter(l => l.toLowerCase().includes(q)) : allItems;

    if (countEl) {
      countEl.textContent = q ? filtered.length + ' / ' + totalCount : totalCount;
      countEl.classList.toggle('det-apps__count--filtered', q.length > 0);
    }

    if (emptyMsg) emptyMsg.style.display = filtered.length === 0 ? 'flex' : 'none';
    list.style.display = filtered.length === 0 ? 'none' : '';

    list.innerHTML = filtered.map(function(l) {
      return '<li class="det-apps__item det-apps__item--in"><i class="fa-solid fa-car-side"></i><span>' + highlight(l, query) + '</span></li>';
    }).join('');

    if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none';
  }

  render('');

  let timer;
  input.addEventListener('input', function() {
    clearTimeout(timer);
    timer = setTimeout(function() { render(input.value); }, 120);
  });

  clearBtn && clearBtn.addEventListener('click', function() {
    input.value = '';
    input.focus();
    render('');
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { input.value = ''; render(''); }
  });
})();