// public/js/pages/lista.js
// Autofaros v2026-03-09 — lógica específica de la vista lista de productos

document.addEventListener('DOMContentLoaded', () => {
  console.log('[AF] lista.js cargado');

  /* ──────────────────────────────────────────────
     CAROUSEL — actualiza dots al cambiar imagen
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

    // Actualizar dots
    const dotsContainer = document.getElementById('dots-' + index);
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.pcard__dot').forEach((dot, i) => {
        dot.classList.toggle('pcard__dot--active', i === activa);
      });
    }
  };

  /* ──────────────────────────────────────────────
     QTY BUTTONS — +/- delegado en el grid
  ────────────────────────────────────────────── */
  const grid = document.getElementById('contenedor-productos');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const btnMinus = e.target.closest('.qty-btn--minus');
    const btnPlus  = e.target.closest('.qty-btn--plus');
    if (!btnMinus && !btnPlus) return;

    const row   = (btnMinus || btnPlus).closest('.pcard__qty-row');
    if (!row) return;
    const input = row.querySelector('.cantidad-input');
    if (!input || input.disabled) return;

    const min = parseInt(input.min) || 1;
    const max = parseInt(input.max) || 9999;
    let val   = parseInt(input.value) || min;

    if (btnMinus) val = Math.max(min, val - 1);
    if (btnPlus)  val = Math.min(max, val + 1);

    input.value = val;
    // Disparar evento input para que agregarAlCarrito.js detecte el cambio
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  /* ──────────────────────────────────────────────
     MODAL APLICACIONES (escobillas)
     Funciona tanto en SSR como en cards dinámicas
  ────────────────────────────────────────────── */
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeAplicaciones(raw) {
    let s = String(raw ?? '').trim();
    if (!s) return { subtitle: '', lines: [] };

    s = s.replace(/<br\s*\/?\s*>/gi, '\n').replace(/\r/g, '');

    if (!s.includes('\n')) {
      const m = s.match(/\b[A-ZÁÉÍÓÚÑ]{2,}\b/);
      if (m && typeof m.index === 'number' && m.index > 0) {
        const subtitle = s.slice(0, m.index).trim();
        const rest = s.slice(m.index).trim().replace(/\s+(?=[A-ZÁÉÍÓÚÑ]{2,}\b)/g, '\n');
        s = subtitle + '\n' + rest;
      } else {
        s = s.replace(/\s{2,}/g, '\n');
      }
    }

    const lines = s.split('\n').map(x => x.trim()).filter(Boolean);
    let subtitle = '';
    if (lines.length >= 2 && /^(escobilla|kit|rear)/i.test(lines[0])) {
      subtitle = lines.shift();
    }
    return { subtitle, lines };
  }

  function buildAplicacionesHtml(raw) {
    const { subtitle, lines } = normalizeAplicaciones(raw);
    const items = (lines || []).slice(0, 400).map(l => `
      <li class="af-apps-li">
        <span class="af-apps-ico"><i class="fa-solid fa-car"></i></span>
        <span class="af-apps-txt">${escapeHtml(l)}</span>
      </li>
    `).join('');

    return `
      <div class="af-apps-wrap">
        ${subtitle ? `<div class="af-apps-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        <ul class="af-apps-ul">${items || '<li class="af-apps-li"><span class="af-apps-txt">Sin aplicaciones cargadas.</span></li>'}</ul>
      </div>
    `;
  }

  function mostrarAplicacionesModal(titulo, raw) {
    const contenido = String(raw ?? '').trim();
    if (!contenido) return;

    if (window.Swal) {
      Swal.fire({
        title: titulo || 'Aplicaciones',
        html: buildAplicacionesHtml(contenido),
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
    }
  }

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.btn-aplicaciones');
    if (!btn) return;

    const titulo = (btn.dataset.titulo || 'Aplicaciones').toString();
    let texto = (btn.dataset.aplicaciones || '').toString();
    try { texto = JSON.parse(texto); } catch(_) {}

    mostrarAplicacionesModal(titulo, texto);
  }, { passive: true });

  /* ──────────────────────────────────────────────
     LOADING STATE — reemplaza el texto genérico
     que usa selectores.js con un spinner
  ────────────────────────────────────────────── */
  const observer = new MutationObserver(() => {
    const p = grid.querySelector('p');
    if (p && p.textContent.trim() === 'Cargando productos...') {
      grid.innerHTML = `
        <div class="productos-loading">
          <div class="loading-spinner"></div>
          <span>Buscando productos…</span>
        </div>
      `;
    }
  });

  observer.observe(grid, { childList: true, subtree: false });
});
