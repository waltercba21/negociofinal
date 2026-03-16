(() => {
  function getAdminPrefix() {
    return window.location.pathname.startsWith('/administracion') ? '/administracion' : '';
  }

  async function safeReadError(res) {
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await res.json();
        return j?.error || j?.message || JSON.stringify(j);
      }
      return await res.text();
    } catch {
      return 'Error inesperado';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const proveedorEl  = document.getElementById('notaCreditoProveedor');
    const fechaEl      = document.getElementById('notaCreditoFecha');
    const numeroEl     = document.getElementById('notaCreditoNumero');
    const tipoEl       = document.getElementById('notaCreditoTipo');
    const ivaEl        = document.getElementById('notaCreditoIVA');
    const importeEl    = document.getElementById('notaCreditoImporteTotal');
    const adminEl      = document.getElementById('notaCreditoAdministrador');
    const btn          = document.getElementById('btnGuardarNotaCredito');

    if (!btn) return;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      const id_proveedor        = Number(proveedorEl?.value || 0);
      const fecha               = (fechaEl?.value    || '').trim();
      const numero_nota_credito = (numeroEl?.value   || '').trim();
      const tipo                = (tipoEl?.value     || 'descuento').trim();
      const iva                 = (ivaEl?.value      || '21').trim();
      const importe_total       = parseFloat(importeEl?.value || '0') || 0;
      const administrador       = (adminEl?.value    || '').trim();

      // ── Validación: solo campos realmente obligatorios ────────────────────
      const faltantes = [];
      if (!id_proveedor)        faltantes.push('Proveedor');
      if (!fecha)               faltantes.push('Fecha');
      if (!numero_nota_credito) faltantes.push('Número de Nota de Crédito');
      if (!(importe_total > 0)) faltantes.push('Importe total (mayor a 0)');
      if (!administrador)       faltantes.push('Administrador');

      if (faltantes.length) {
        return Swal.fire({
          icon: 'warning',
          title: 'Faltan datos',
          html: 'Completá los siguientes campos:<br><br><strong>' + faltantes.join('<br>') + '</strong>',
          confirmButtonText: 'Entendido'
        });
      }

      const prefix = getAdminPrefix();

      // ── Verificación de duplicado ─────────────────────────────────────────
      try {
        const q = new URLSearchParams({
          proveedor: String(id_proveedor),
          fecha,
          numero: numero_nota_credito
        });
        const resDup = await fetch(`${prefix}/api/verificar-nota-credito-duplicada?${q.toString()}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (resDup.ok) {
          const dup = await resDup.json();
          if (dup?.existe) {
            return Swal.fire({
              icon: 'warning',
              title: 'Nota de crédito duplicada',
              text: 'Ya existe una nota de crédito con ese número para este proveedor.',
              confirmButtonText: 'Revisar'
            });
          }
        }
      } catch {
        // no bloquear el guardado si falla la verificación
      }

      // ── Guardar ───────────────────────────────────────────────────────────
      try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        // Mantiene urlencoded igual que el original (compatibilidad con express.urlencoded)
        const body = new URLSearchParams();
        body.set('id_proveedor',        String(id_proveedor));
        body.set('fecha',               fecha);
        body.set('numero_nota_credito', numero_nota_credito);
        body.set('numero_factura',      '-');   // campo requerido en DB, se vincula en Carta de Pago
        body.set('tipo',                tipo);
        body.set('iva',                 iva);
        body.set('importe_total',       String(importe_total));
        body.set('administrador',       administrador);

        const res = await fetch(`${prefix}/api/notas-credito`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'application/json'
          },
          body: body.toString()
        });

        if (!res.ok) {
          const msg = await safeReadError(res);
          return Swal.fire({
            icon: 'error',
            title: 'Error',
            text: msg || 'Error al crear nota de crédito.',
            confirmButtonText: 'Cerrar'
          });
        }

        const out = await res.json().catch(() => ({}));

        await Swal.fire({
          icon: 'success',
          title: 'Nota de crédito registrada',
          text: `La nota ${numero_nota_credito} fue guardada. Podés aplicarla en una Carta de Pago.`,
          confirmButtonText: 'Aceptar'
        });

        // Limpiar formulario
        if (proveedorEl) proveedorEl.value = '';
        if (fechaEl)     fechaEl.value     = '';
        if (numeroEl)    numeroEl.value    = '';
        if (tipoEl)      tipoEl.value      = 'descuento';
        if (ivaEl)       ivaEl.value       = '21';
        if (importeEl)   importeEl.value   = '';
        if (adminEl)     adminEl.value     = '';

        // Cerrar modal
        const modalEl = document.getElementById('modalNotaCredito');
        if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();

      } catch (err) {
        console.error('❌ Error al guardar nota de crédito:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo guardar la nota de crédito.',
          confirmButtonText: 'Cerrar'
        });
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1"></i>Guardar Nota de Crédito';
      }
    });
  });
})();