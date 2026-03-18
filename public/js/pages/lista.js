// public/js/pages/lista.js
// Autofaros v2026-03-09

document.addEventListener('DOMContentLoaded', () => {
  console.log('[AF] lista.js cargado');

  /* ──────────────────────────────────────────────
     CAROUSEL
  ────────────────────────────────────────────── */
  window.moverCarrusel = function (index, direccion) {
    const carousel = document.getElementById('carousel-' + index);
    if (!carousel) return;
    const imagenes = carousel.querySelectorAll('.pcard__img');
    if (!imagenes.length) return;
    let activa = Array.from(imagenes).findIndex(img => !img.classList.contains('hidden'));
    if (activa < 0) activa = 0;
    imagenes[activa].classList.add('hidden');
    activa = (activa + direccion + imagenes.length) % imagenes.length;
    imagenes[activa].classList.remove('hidden');
    const dotsContainer = document.getElementById('dots-' + index);
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.pcard__dot').forEach((dot, i) => {
        dot.classList.toggle('pcard__dot--active', i === activa);
      });
    }
  };

  /* ──────────────────────────────────────────────
     QTY BUTTONS
  ────────────────────────────────────────────── */
  const grid = document.getElementById('contenedor-productos');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const btnMinus = e.target.closest('.qty-btn--minus');
    const btnPlus  = e.target.closest('.qty-btn--plus');
    if (!btnMinus && !btnPlus) return;
    const row = (btnMinus || btnPlus).closest('.pcard__qty-row');
    if (!row) return;
    const input = row.querySelector('.cantidad-input');
    if (!input || input.disabled) return;
    const min = parseInt(input.min) || 1;
    const max = parseInt(input.max) || 9999;
    let val = parseInt(input.value) || min;
    if (btnMinus) val = Math.max(min, val - 1);
    if (btnPlus)  val = Math.min(max, val + 1);
    input.value = val;
    input.dataset.afRequested = String(val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  /* ──────────────────────────────────────────────
     MODAL APLICACIONES
  ────────────────────────────────────────────── */
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalizeAplicaciones(raw) {
    let s = String(raw ?? '').trim();
    if (!s) return { subtitle: '', lines: [] };

    // La DB separa cada entrada con múltiples espacios/tabs consecutivos.
    // Primero aplanamos saltos de línea y tags <br> a un espacio.
    s = s.replace(/<br\s*\/?\s*>/gi, ' ').replace(/\r?\n/g, ' ');

    // Separar por 2 o más espacios/tabs consecutivos
    const partes = s.split(/[ \t]{2,}/).map(x => x.trim()).filter(Boolean);

    let subtitle = '';
    if (partes.length >= 2 && /^(escobilla|kit|rear)/i.test(partes[0])) {
      subtitle = partes.shift();
    }

    return { subtitle, lines: partes };
  }

  function buildAplicacionesHtml(raw) {
    const { subtitle, lines } = normalizeAplicaciones(raw);
    const items = lines.slice(0, 400).map(l => `
      <li class="af-apps-li">
        <span class="af-apps-ico"><i class="fa-solid fa-car"></i></span>
        <span class="af-apps-txt">${escapeHtml(l)}</span>
      </li>`).join('');
    return `<div class="af-apps-wrap">
      ${subtitle ? `<div class="af-apps-subtitle">${escapeHtml(subtitle)}</div>` : ''}
      <ul class="af-apps-ul">${items || '<li class="af-apps-li"><span class="af-apps-txt">Sin aplicaciones cargadas.</span></li>'}</ul>
    </div>`;
  }

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.btn-aplicaciones');
    if (!btn) return;
    const titulo = (btn.dataset.titulo || 'Aplicaciones').toString();
    let texto = (btn.dataset.aplicaciones || '').toString();
    try { texto = JSON.parse(texto); } catch(_) {}
    if (!window.Swal) return;
    Swal.fire({
      title: titulo,
      html: buildAplicacionesHtml(texto),
      width: 'min(980px, 94vw)',
      showCloseButton: true,
      confirmButtonText: 'Cerrar',
      customClass: {
        popup: 'af-apps-modal',
        title: 'af-apps-title',
        htmlContainer: 'af-apps-body',
        confirmButton: 'af-apps-confirm'
      }
    });
  }, { passive: true });

  /* ──────────────────────────────────────────────
     LOADING SPINNER
  ────────────────────────────────────────────── */
  const observer = new MutationObserver(() => {
    const p = grid.querySelector('p');
    if (p && p.textContent.trim() === 'Cargando productos...') {
      grid.innerHTML = `
        <div class="productos-loading">
          <div class="loading-spinner"></div>
          <span>Buscando productos…</span>
        </div>`;
    }
  });
  observer.observe(grid, { childList: true, subtree: false });
});