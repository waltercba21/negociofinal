/**
 * AUTOFAROS — Header Logic
 * public/js/layout/header.js
 *
 * Responsabilidades:
 *   1. Buscador: input/clear
 *   2. Hamburger: toggle menú mobile (panel deslizante + overlay)
 *   3. Scroll: clase .scrolled en header
 *   4. Socket.io: registro de usuario, notificaciones
 *   5. Badge de pedidos (admin)
 *   6. Badge del carrito (usuario)
 */

(function () {
  'use strict';

  /* ════════════════════════════════════════════
     1. BUSCADOR — input + botón limpiar
  ════════════════════════════════════════════ */
  function initSearch() {
    const input = document.getElementById('headerEntradaBusqueda');
    const clearBtn = document.getElementById('headerBotonLimpiar');
    if (!input || !clearBtn) return;

    const syncClear = () => {
      if (input.value.trim()) {
        clearBtn.removeAttribute('hidden');
      } else {
        clearBtn.setAttribute('hidden', '');
      }
    };

    syncClear();
    input.addEventListener('input', syncClear, { passive: true });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      syncClear();
      input.focus();
    }, { passive: true });
  }

  /* ════════════════════════════════════════════
     2. HAMBURGER — panel deslizante lateral + overlay
     
     CAMBIOS respecto a la versión anterior:
     - El nav ahora es un drawer lateral (desde la derecha) — no un dropdown
     - Se agregó soporte para el overlay (#navOverlay)
     - El "cerrar al click fuera" ahora usa el overlay, no document.click
       (evita falsos cierres al interactuar con el panel)
     - Se mantiene el cierre con Escape
  ════════════════════════════════════════════ */
  function initHamburger() {
    const btn     = document.getElementById('hamburgerBtn');
    const nav     = document.getElementById('mainNav');
    const overlay = document.getElementById('navOverlay');
    if (!btn || !nav) return;

    /* — Abrir el panel — */
    const openNav = () => {
      nav.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Cerrar menu');
      // NO bloquear body overflow: en iOS Safari hace la pagina ininteractuable
      if (overlay) {
        overlay.classList.add('is-open');
        overlay.removeAttribute('aria-hidden');
      }
    };

    /* — Cerrar el panel — */
    const closeNav = () => {
      nav.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Abrir menu de navegacion');
      if (overlay) {
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
      }
    };

    /* — Toggle — */
    const toggle = () => {
      nav.classList.contains('is-open') ? closeNav() : openNav();
    };

    /* — Eventos — */
    btn.addEventListener('click', toggle);

    /* Cerrar al tocar el overlay (área fuera del panel) */
    if (overlay) {
      overlay.addEventListener('click', closeNav, { passive: true });
    }

    /* Cerrar con Escape */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        closeNav();
        btn.focus();
      }
    });

    /*
     * NOTA: Se eliminó el document.addEventListener('click', ...) anterior
     * que cerraba el menú al hacer click fuera.
     * Razón: con el drawer lateral, ese listener se disparaba al hacer
     * scroll o tocar dentro del panel, cerrándolo inesperadamente.
     * El overlay cubre exactamente el área fuera del panel y es más preciso.
     */
  }

  /* ════════════════════════════════════════════
     3. SCROLL — clase .scrolled en el header
  ════════════════════════════════════════════ */
  function initScrollBehavior() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 20);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // estado inicial
  }

  /* ════════════════════════════════════════════
     4. SOCKET.IO — registro + notificaciones
  ════════════════════════════════════════════ */
  function initSocket() {
    if (typeof io === 'undefined') return;

    const headerEl = document.querySelector('.site-header[data-usuario-id]');
    if (!headerEl) return;

    const usuarioId = headerEl.dataset.usuarioId;
    const isAdmin   = headerEl.dataset.isAdmin === 'true';

    const socket = io();

    // Registrar usuario en el socket (para notificaciones personales)
    if (usuarioId) {
      socket.emit('register', { usuarioId: Number(usuarioId) });
    }

    // ── Notificación para USUARIOS: pedido actualizado ──
    socket.on('pedidoActualizado', (data) => {
      if (typeof Swal === 'undefined') return;
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: `Pedido #${data.id_pedido}`,
        text: `Estado actualizado: ${data.estado}`,
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true,
        customClass: { popup: 'swal-autofaros-toast' }
      });
    });

    // ── Notificaciones ADMIN ──
    if (isAdmin) {
      socket.on('nuevoPedido', (payload = {}) => {
        toastAdmin(payload.mensaje || `📦 Nuevo pedido #${payload.id_carrito || ''}`);
        actualizarBadgePedidos();
      });

      socket.on('actualizarNotificacion', () => {
        actualizarBadgePedidos();
        if (typeof actualizarPedidosPendientes === 'function') {
          actualizarPedidosPendientes();
        }
      });

      // Carga inicial del badge
      actualizarBadgePedidos();
    }
  }

  /* ════════════════════════════════════════════
     5. BADGE PEDIDOS (admin)
  ════════════════════════════════════════════ */
  async function actualizarBadgePedidos() {
    const badge = document.getElementById('badge-pedidos');
    if (!badge) return;

    try {
      const res = await fetch('/pedidos/cantidad', {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return;

      const data = await res.json();
      const n = Number(data.cantidad || 0);

      badge.textContent = n;
      n > 0 ? badge.removeAttribute('hidden') : badge.setAttribute('hidden', '');
    } catch (_) {
      // silencioso — no romper la UI por un error de red
    }
  }

  /* ════════════════════════════════════════════
     UTILIDADES INTERNAS
  ════════════════════════════════════════════ */
  function toastAdmin(texto) {
    if (typeof Swal === 'undefined') return;
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: texto,
      showConfirmButton: false,
      timer: 3200,
      timerProgressBar: true,
      customClass: { popup: 'swal-autofaros-toast' }
    });
  }

  /* ════════════════════════════════════════════
     INIT — esperar DOM listo
  ════════════════════════════════════════════ */
  function init() {
    initSearch();
    initHamburger();
    initScrollBehavior();
    initSocket();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();