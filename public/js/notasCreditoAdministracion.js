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
    const proveedorEl = document.getElementById('notaCreditoProveedor');
    const fechaEl = document.getElementById('notaCreditoFecha');
    const numeroEl = document.getElementById('notaCreditoNumero');
    const facturaNumeroEl = document.getElementById('notaCreditoFacturaNumero');
    const tipoEl = document.getElementById('notaCreditoTipo');
    const ivaEl = document.getElementById('notaCreditoIVA');
    const importeEl = document.getElementById('notaCreditoImporteTotal');
    const btn = document.getElementById('btnGuardarNotaCredito');

    if (!btn) return;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      const data = {
        id_proveedor: Number(proveedorEl?.value || 0),
        fecha: (fechaEl?.value || '').trim(),
        numero_nota_credito: (numeroEl?.value || '').trim(),
        numero_factura: (facturaNumeroEl?.value || '').trim(),
        tipo: (tipoEl?.value || '').trim(),
        iva: (ivaEl?.value || '').trim(),
        importe_total: Number.parseFloat(importeEl?.value || '0') || 0
      };

      if (!data.id_proveedor || !data.fecha || !data.numero_nota_credito || !data.numero_factura) {
        alert('Faltan datos obligatorios.');
        return;
      }

      const tiposValidos = ['descuento', 'devolucion_mercaderia', 'diferencia_precio'];
      if (!tiposValidos.includes(data.tipo)) {
        alert('Tipo de nota de crédito inválido.');
        return;
      }

      const ivasValidos = ['21', '10.5'];
      if (!ivasValidos.includes(data.iva)) {
        alert('IVA inválido.');
        return;
      }

      if (!(data.importe_total > 0)) {
        alert('El importe total debe ser mayor a 0.');
        return;
      }

      const prefix = getAdminPrefix();

      try {
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        // (opcional) chequeo duplicado (si existe endpoint)
        try {
          const q = new URLSearchParams({
            proveedor: String(data.id_proveedor),
            fecha: data.fecha,
            numero: data.numero_nota_credito
          });

          const resDup = await fetch(`${prefix}/api/verificar-nota-credito-duplicada?${q.toString()}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });

          if (resDup.ok) {
            const dup = await resDup.json();
            if (dup?.existe) {
              alert('Ya existe una Nota de Crédito con ese proveedor, fecha y número.');
              return;
            }
          }
        } catch {
          // no bloquear el guardado
        }

        // ✅ ENVIAR COMO FORM URLENCODED (compat con express.urlencoded)
        const body = new URLSearchParams();
        body.set('id_proveedor', String(data.id_proveedor));
        body.set('fecha', data.fecha);
        body.set('numero_nota_credito', data.numero_nota_credito);
        body.set('numero_factura', data.numero_factura);
        body.set('tipo', data.tipo);
        body.set('iva', data.iva);
        body.set('importe_total', String(data.importe_total));

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
          alert(msg || 'Error al crear nota de crédito.');
          return;
        }

        const out = await res.json().catch(() => ({}));
        alert(out?.message || 'Nota de crédito creada exitosamente.');

        // reset
        if (fechaEl) fechaEl.value = '';
        if (numeroEl) numeroEl.value = '';
        if (facturaNumeroEl) facturaNumeroEl.value = '';
        if (tipoEl) tipoEl.value = '';
        if (ivaEl) ivaEl.value = '';
        if (importeEl) importeEl.value = '';
      } catch (err) {
        console.error(err);
        alert('Error al guardar la Nota de Crédito.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Nota de Crédito';
      }
    });
  });
})();
