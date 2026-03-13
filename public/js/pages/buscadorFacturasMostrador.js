// buscadorFacturasMostrador.js — v2026-03-09-clean

function fechaHoyYYYYMMDD(timeZone = 'America/Argentina/Cordoba') {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

function formatCurrencyCL(valor) {
  const num = Number(valor) || 0;
  return num.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

// ── Funciones puras (no tocan DOM, pueden estar fuera) ──────────────────────

function updateSubtotal(row, verificarStock = true) {
  const inputPrecio = row.cells[3].querySelector('input');
  const inputCantidad = row.cells[4].querySelector('input');
  const stockActualCell = row.cells[5];

  if (!inputPrecio || !inputCantidad || !stockActualCell) return;

  let precio = parseFloat(inputPrecio.value.replace(/\$|\./g, '').replace(',', '.'));
  let cantidad = parseInt(inputCantidad.value);
  let stockActual = parseInt(stockActualCell.textContent.replace(/\$|\./g, '').replace(',', '.'));

  precio = !isNaN(precio) ? precio : 0;
  cantidad = !isNaN(cantidad) ? cantidad : 1;
  stockActual = !isNaN(stockActual) ? stockActual : 0;

  const subtotal = precio * cantidad;
  row.cells[6].textContent = subtotal.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

  if (verificarStock && document.activeElement === inputCantidad) {
    if (cantidad > stockActual) {
      Swal.fire({
        title: 'ALERTA',
        text: 'NO HAY STOCK DISPONIBLE. Solo hay ' + stockActual + ' unidades en stock.',
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
      inputCantidad.value = stockActual > 0 ? stockActual : 1;
      cantidad = parseInt(inputCantidad.value);
    }
    const stockRestante = stockActual - cantidad;
    if (stockRestante <= 5 && stockRestante >= 0) {
      Swal.fire({
        title: 'ALERTA',
        text: 'LLEGANDO AL LIMITE DE STOCK. Quedan ' + stockRestante + ' unidades disponibles.',
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
    }
  }

  calcularTotal();
}

function calcularTotal() {
  const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
  let total = 0;

  for (let i = 0; i < filasFactura.length; i++) {
    let subtotal = parseFloat(filasFactura[i].cells[6].textContent.replace(/\$|\./g, '').replace(',', '.'));
    subtotal = !isNaN(subtotal) ? subtotal : 0;
    total += subtotal;
  }

  const creditoCheckbox = document.querySelector('input[name="metodosPago"][value="CREDITO"]');
  const interesAmountInput = document.getElementById('interes-amount');
  const totalAmountInput = document.getElementById('total-amount');

  let interes = 0;
  if (creditoCheckbox && creditoCheckbox.checked) {
    interes = total * 0.15;
    total += interes;
  }

  if (interesAmountInput) interesAmountInput.value = interes.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
  if (totalAmountInput) totalAmountInput.value = total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
}

function agregarProductoATabla(codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto) {
  const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
  const filas = tablaFactura.rows;
  let filaDisponible = null;

  for (let i = 0; i < filas.length; i++) {
    if (!filas[i].cells[1].textContent.trim()) {
      filaDisponible = filas[i];
      break;
    }
  }

  if (!filaDisponible) {
    Swal.fire("Límite alcanzado", "Solo se pueden agregar hasta 10 productos.", "warning");
    return;
  }

  const cellImagen = filaDisponible.cells[0];
  const imgElement = cellImagen.querySelector("img");
  if (imagenProducto && imgElement) {
    imgElement.src = imagenProducto;
    imgElement.style.display = "block";
  }

  filaDisponible.cells[1].textContent = codigoProducto;
  filaDisponible.cells[2].textContent = nombreProducto;

  const inputPrecio = filaDisponible.cells[3].querySelector("input");
  if (inputPrecio) {
    inputPrecio.value = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    inputPrecio.disabled = false;
    inputPrecio.addEventListener('input', function () {
      updateSubtotal(filaDisponible, false);
    });
  }

  // Reemplazar celda de cantidad con botones +/-
  const stockNum = parseInt(stockActual) || 0;
  filaDisponible.cells[4].innerHTML = `
    <div class="qty-control">
      <button type="button" class="qty-btn qty-btn--minus" tabindex="-1"><i class="fa-solid fa-minus"></i></button>
      <input type="number" min="1" max="${stockNum}" value="1" class="facturas-tabla__input facturas-tabla__input--qty" />
      <button type="button" class="qty-btn qty-btn--plus" tabindex="-1"><i class="fa-solid fa-plus"></i></button>
    </div>`;

  const inputCantidad = filaDisponible.cells[4].querySelector("input");
  const btnMinus = filaDisponible.cells[4].querySelector(".qty-btn--minus");
  const btnPlus  = filaDisponible.cells[4].querySelector(".qty-btn--plus");

  btnMinus.addEventListener('click', () => {
    const val = parseInt(inputCantidad.value) || 1;
    if (val > 1) { inputCantidad.value = val - 1; updateSubtotal(filaDisponible); }
  });

  btnPlus.addEventListener('click', () => {
    const val = parseInt(inputCantidad.value) || 1;
    if (val < stockNum) { inputCantidad.value = val + 1; updateSubtotal(filaDisponible); }
    else {
      Swal.fire({ title: 'Stock insuficiente', text: `Solo hay ${stockNum} unidades disponibles.`, icon: 'warning', confirmButtonText: 'Entendido' });
    }
  });

  inputCantidad.addEventListener('input', function () {
    updateSubtotal(filaDisponible);
  });

  filaDisponible.cells[5].textContent = stockActual;
  filaDisponible.cells[6].textContent = parseFloat(precioVenta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });

  calcularTotal();

  const botonEliminar = filaDisponible.cells[7].querySelector("button");
  if (botonEliminar) {
    botonEliminar.style.display = "block";
    botonEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    botonEliminar.addEventListener("click", function () {
      filaDisponible.cells[1].textContent = "";
      filaDisponible.cells[2].textContent = "";
      if (inputPrecio) { inputPrecio.value = ""; inputPrecio.disabled = true; }
      filaDisponible.cells[4].innerHTML = `<input type="number" min="1" value="0" class="facturas-tabla__input facturas-tabla__input--qty" disabled />`;
      filaDisponible.cells[5].textContent = "";
      filaDisponible.cells[6].textContent = "";
      if (imgElement) imgElement.style.display = "none";
      botonEliminar.style.display = "none";
      calcularTotal();
    });
  }
}

// ── Todo lo que toca el DOM va dentro de DOMContentLoaded ──────────────────

document.addEventListener('DOMContentLoaded', function () {

  // Fecha actual
  const fechaPresupuestoInput = document.getElementById('fecha-presupuesto');
  if (fechaPresupuestoInput && !fechaPresupuestoInput.value) {
    fechaPresupuestoInput.value = fechaHoyYYYYMMDD();
  }

  // Prevenir Enter en el formulario
  document.getElementById('invoice-form').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      return false;
    }
  });

  // Submit con confirmación
  document.getElementById('invoice-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const metodosPagoSeleccionados = document.querySelector('input[name="metodosPago"]:checked');
    if (!metodosPagoSeleccionados) {
      Swal.fire({ title: 'Error', text: 'Debe seleccionar un método de pago antes de continuar.', icon: 'warning', confirmButtonText: 'Entendido' });
      return;
    }

    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    const invoiceItems = [];
    let totalSinInteres = 0;

    for (let i = 0; i < filasFactura.length; i++) {
      const codigo = filasFactura[i].cells[1].textContent.trim();
      const descripcion = filasFactura[i].cells[2].textContent.trim();
      const precioInput = filasFactura[i].cells[3].querySelector('input').value;
      let precio_unitario = parseFloat(precioInput.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim());
      let cantidad = parseInt(filasFactura[i].cells[4].querySelector('input').value);
      const stock = parseInt(filasFactura[i].cells[5].textContent.trim());

      precio_unitario = !isNaN(precio_unitario) ? precio_unitario : 0;
      cantidad = !isNaN(cantidad) ? cantidad : 1;

      if (cantidad > stock) {
        Swal.fire({ title: 'Stock insuficiente', text: `No hay stock suficiente para el producto en la fila ${i + 1}. Tiene ${stock}, y desea facturar ${cantidad}.`, icon: 'error', confirmButtonText: 'Entendido' });
        return;
      }

      const subtotal = precio_unitario * cantidad;
      if (codigo !== '' && descripcion !== '' && precio_unitario > 0 && cantidad > 0) {
        invoiceItems.push({ producto_id: codigo, descripcion, precio_unitario, cantidad, subtotal });
        totalSinInteres += subtotal;
      }
    }

    if (invoiceItems.length === 0) {
      Swal.fire({ title: 'Error', text: 'Debe agregar al menos un producto válido antes de continuar.', icon: 'error', confirmButtonText: 'Entendido' });
      return;
    }

    const totalFacturaElement = document.getElementById('total-amount');
    let totalFactura = '0';
    if (totalFacturaElement) {
      totalFactura = totalFacturaElement.value.replace(/\./g, '').replace(',', '.').replace('$', '').trim();
    }

    const fechaFacturaElement = document.getElementById('fecha-presupuesto');
    const fechaFactura = fechaFacturaElement ? fechaFacturaElement.value.trim() : undefined;
    const nombreClienteInput = document.getElementById('nombre-cliente');
    const nombreCliente = nombreClienteInput ? nombreClienteInput.value.trim() : '';

    let interesCalculado = 0;
    if (metodosPagoSeleccionados.value === 'CREDITO') interesCalculado = totalSinInteres * 0.15;
    const totalConInteres = totalSinInteres + interesCalculado;

    const filasHTML = invoiceItems.map((item, index) => `
      <tr>
        <td>${index + 1}</td><td>${item.producto_id}</td><td>${item.descripcion}</td>
        <td>${formatCurrencyCL(item.precio_unitario)}</td><td>${item.cantidad}</td>
        <td>${formatCurrencyCL(item.subtotal)}</td>
      </tr>`).join('');

    const resumenHTML = `
      <div class="resumen-factura-modal">
        <p><strong>Vendedor:</strong> ${nombreCliente || '-'}</p>
        <p><strong>Fecha:</strong> ${fechaFactura || fechaHoyYYYYMMDD()}</p>
        <p><strong>Método de pago:</strong> ${metodosPagoSeleccionados.value}</p>
        <hr>
        <div style="max-height:300px;overflow:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
            <thead><tr>
              <th style="border-bottom:1px solid #ccc;padding:4px;">#</th>
              <th style="border-bottom:1px solid #ccc;padding:4px;">Código</th>
              <th style="border-bottom:1px solid #ccc;padding:4px;">Descripción</th>
              <th style="border-bottom:1px solid #ccc;padding:4px;">P. Unitario</th>
              <th style="border-bottom:1px solid #ccc;padding:4px;">Cant.</th>
              <th style="border-bottom:1px solid #ccc;padding:4px;">Subtotal</th>
            </tr></thead>
            <tbody>${filasHTML}</tbody>
          </table>
        </div>
        <hr>
        <p><strong>Total sin interés:</strong> ${formatCurrencyCL(totalSinInteres)}</p>
        <p><strong>Interés:</strong> ${formatCurrencyCL(interesCalculado)}</p>
        <p><strong>Total a cobrar:</strong> ${formatCurrencyCL(totalConInteres)}</p>
        <p style="margin-top:8px;font-size:0.85rem;color:#666;">Revise los datos antes de guardar. Si algo está mal, presione "Revisar".</p>
      </div>`;

    const { isConfirmed } = await Swal.fire({
      title: 'Confirmar datos de la factura',
      html: resumenHTML,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Revisar',
      reverseButtons: true,
      width: '80%',
      allowOutsideClick: false,
      allowEscapeKey: false
    });

    if (!isConfirmed) return;

    try {
      const response = await fetch('/productos/procesarFormularioFacturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreCliente,
          fechaPresupuesto: fechaFactura,
          totalPresupuesto: totalFactura,
          invoiceItems,
          metodosPago: metodosPagoSeleccionados.value
        })
      });

      // Leer como texto primero para detectar si el servidor devolvió HTML (error 500)
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (_) {
        console.error('[Factura] Respuesta no-JSON del servidor:', rawText.substring(0, 500));
        Swal.fire({
          title: 'Error del servidor',
          html: `<p>El servidor devolvió una respuesta inesperada.</p>
                 <pre style="text-align:left;font-size:11px;max-height:200px;overflow:auto;background:#111c30;color:#f0f4ff;padding:10px;border-radius:8px;">${rawText.substring(0, 600)}</pre>`,
          icon: 'error',
          confirmButtonText: 'Entendido'
        });
        return;
      }
      if (response.ok) {
        const facturaId = data.facturaId;
        await mostrarModalARCA(facturaId, totalConInteres);
      } else {
        throw new Error(data.error || 'Error al procesar el formulario');
      }
    } catch (error) {
      console.error('Error al enviar el formulario:', error);
      Swal.fire({ title: 'Error', text: 'Error al enviar formulario: ' + error.message, icon: 'error', confirmButtonText: 'Entendido' });
    }
  });

  // Buscador de productos
  const entradaBusqueda = document.getElementById('entradaBusqueda');
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  let timeoutId;

  entradaBusqueda.addEventListener('keyup', async (e) => {
    const busqueda = e.target.value;
    resultadosBusqueda.innerHTML = '';

    if (!busqueda.trim()) {
      resultadosBusqueda.style.display = 'none';
      return;
    }

    const respuesta = await fetch('/productos/api/buscar?q=' + encodeURIComponent(busqueda));
    const productos = await respuesta.json();

    productos.forEach((producto) => {
      const resultado = document.createElement('div');
      resultado.classList.add('resultado-busqueda');
      resultado.dataset.codigo = producto.codigo;
      resultado.dataset.nombre = producto.nombre;
      resultado.dataset.precio_venta = producto.precio_venta;
      resultado.dataset.stock_actual = producto.stock_actual;

      if (producto.imagenes && producto.imagenes.length > 0) {
        resultado.dataset.imagen = '/uploads/productos/' + producto.imagenes[0].imagen;
      }

      const contenedor = document.createElement('div');
      contenedor.classList.add('resultado-contenedor');

      if (producto.imagenes && producto.imagenes.length > 0) {
        const imagen = document.createElement('img');
        imagen.src = '/uploads/productos/' + producto.imagenes[0].imagen;
        imagen.classList.add('miniatura');
        contenedor.appendChild(imagen);
      }

      const nombreProducto = document.createElement('span');
      nombreProducto.textContent = producto.nombre;
      contenedor.appendChild(nombreProducto);
      resultado.appendChild(contenedor);

      resultado.addEventListener('mouseenter', function () {
        document.querySelectorAll('.resultado-busqueda').forEach(r => r.classList.remove('hover-activo'));
        this.classList.add('hover-activo');
      });

      resultado.addEventListener('mouseleave', function () {
        this.classList.remove('hover-activo');
      });

      resultado.addEventListener('click', function () {
        agregarProductoATabla(
          this.dataset.codigo,
          this.dataset.nombre,
          this.dataset.precio_venta,
          this.dataset.stock_actual,
          this.dataset.imagen
        );
        resultadosBusqueda.style.display = 'none';
        entradaBusqueda.value = '';
      });

      resultadosBusqueda.appendChild(resultado);
      resultadosBusqueda.style.display = 'block';
    });
  });

  resultadosBusqueda.addEventListener('mouseleave', () => {
    timeoutId = setTimeout(() => { resultadosBusqueda.style.display = 'none'; }, 300);
  });

  resultadosBusqueda.addEventListener('mouseenter', () => {
    clearTimeout(timeoutId);
    resultadosBusqueda.style.display = 'block';
  });

  // Eventos de inputs de tabla
  document.querySelectorAll('#tabla-factura tbody tr').forEach(row => {
    const inputCantidad = row.cells[4].querySelector('input');
    const inputPrecio = row.cells[3].querySelector('input');
    if (inputCantidad) inputCantidad.addEventListener('input', function () { updateSubtotal(row); });
    if (inputPrecio) inputPrecio.addEventListener('input', function () { updateSubtotal(row, false); });
  });

  // Métodos de pago → recalcular total
  document.querySelectorAll('input[name="metodosPago"]').forEach(checkbox => {
    checkbox.addEventListener('change', calcularTotal);
  });

  // Prevenir Enter en todos los inputs
  document.querySelectorAll('input:not(#entradaBusqueda):not(#headerEntradaBusqueda)').forEach(input => {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); return false; }
    });
  });

}); // ── END DOMContentLoaded


/* ═══════════════════════════════════════════════════════════
   ARCA — Emisión desde factura mostrador
   Se llama después de guardar exitosamente la factura interna.
   No toca stock, no toca el backend de facturas.
═══════════════════════════════════════════════════════════ */

async function mostrarModalARCA(facturaId, totalConInteres) {

  // ── Paso 1: elegir tipo de emisión ──────────────────────
  const htmlPaso1 = `
    <div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">

      <button id="arca-btn-cf" type="button" style="
        display:flex;align-items:center;gap:14px;
        padding:16px 20px;border-radius:14px;
        background:rgba(31,72,126,.15);border:1.5px solid rgba(31,72,126,.4);
        color:#f0f4ff;font-size:1rem;font-weight:700;cursor:pointer;
        transition:background .15s;text-align:left;width:100%">
        <i class="fa-solid fa-receipt" style="font-size:1.4rem;color:#7aaee8;flex-shrink:0"></i>
        <div>
          <div style="font-size:.95rem;font-weight:800">Factura B — Consumidor Final</div>
          <div style="font-size:.78rem;color:#8fa3c0;margin-top:3px">Sin CUIT · Emisión en un click</div>
        </div>
      </button>

      <button id="arca-btn-cuit" type="button" style="
        display:flex;align-items:center;gap:14px;
        padding:16px 20px;border-radius:14px;
        background:rgba(99,102,241,.1);border:1.5px solid rgba(99,102,241,.3);
        color:#f0f4ff;font-size:1rem;font-weight:700;cursor:pointer;
        transition:background .15s;text-align:left;width:100%">
        <i class="fa-solid fa-building" style="font-size:1.4rem;color:#a5b4fc;flex-shrink:0"></i>
        <div>
          <div style="font-size:.95rem;font-weight:800">Factura B/A — Con CUIT</div>
          <div style="font-size:.78rem;color:#8fa3c0;margin-top:3px">Responsable Inscripto · ingresar CUIT</div>
        </div>
      </button>

      <button id="arca-btn-saltar" type="button" style="
        display:flex;align-items:center;gap:10px;
        padding:12px 20px;border-radius:10px;
        background:transparent;border:1px solid rgba(255,255,255,.08);
        color:#4d6380;font-size:.85rem;cursor:pointer;
        transition:color .15s;text-align:left;width:100%">
        <i class="fa-solid fa-forward" style="flex-shrink:0"></i>
        Solo guardar, emitir ARCA más tarde
      </button>
    </div>`;

  const paso1 = await Swal.fire({
    title: '<span style="font-size:1rem;letter-spacing:.08em;text-transform:uppercase;color:#7aaee8">Factura #' + facturaId + ' guardada</span>',
    html: htmlPaso1,
    background: '#111c30',
    color: '#f0f4ff',
    showConfirmButton: false,
    showCloseButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    width: '460px',
    didOpen: () => {
      document.getElementById('arca-btn-cf').addEventListener('click', () => Swal.clickConfirm());
      document.getElementById('arca-btn-cuit').addEventListener('click', () => Swal.close({ isDenied: true, value: 'cuit' }));
      document.getElementById('arca-btn-saltar').addEventListener('click', () => Swal.close({ isDismissed: true }));
    },
    preConfirm: () => 'cf'
  });

  // Saltar → ir directo a productos
  if (paso1.isDismissed) {
    window.location.href = '/productos';
    return;
  }

  const modoCuit = paso1.isDenied || paso1.value === 'cuit';

  // ── Paso 2a: Consumidor Final (datos opcionales para seguros) ─────────────
  if (!modoCuit) {
    const htmlCF = `
      <div style="display:flex;flex-direction:column;gap:14px;padding:4px 0;text-align:left">
        <p style="color:#8fa3c0;font-size:.82rem;margin:0">
          <i class="fa-solid fa-circle-info" style="margin-right:6px;color:#7aaee8"></i>
          Opcional — completar solo si el cliente necesita sus datos en la factura (seguros, devoluciones).
        </p>
        <div>
          <label style="font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4d6380;display:block;margin-bottom:6px">
            Nombre / Razón Social
          </label>
          <input id="cf-nombre" type="text" maxlength="100" placeholder="Ej: Juan García"
            style="width:100%;padding:11px 14px;border-radius:10px;
                   background:rgba(255,255,255,.06);border:1.5px solid rgba(31,72,126,.4);
                   color:#f0f4ff;font-size:.95rem;outline:none;font-family:inherit" />
        </div>
        <div style="display:flex;gap:10px">
          <div style="flex:0 0 150px">
            <label style="font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4d6380;display:block;margin-bottom:6px">
              Tipo doc.
            </label>
            <select id="cf-doc-tipo" style="width:100%;padding:11px 10px;border-radius:10px;
              background:rgba(255,255,255,.06);border:1.5px solid rgba(31,72,126,.4);
              color:#f0f4ff;font-size:.88rem;outline:none;font-family:inherit;cursor:pointer">
              <option value="96" style="background:#111c30">DNI (96)</option>
              <option value="94" style="background:#111c30">Pasaporte (94)</option>
              <option value="89" style="background:#111c30">Cédula (89)</option>
            </select>
          </div>
          <div style="flex:1">
            <label style="font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4d6380;display:block;margin-bottom:6px">
              Nro. de documento
            </label>
            <input id="cf-doc-nro" type="text" inputmode="numeric" maxlength="12"
              placeholder="Ej: 30123456"
              style="width:100%;padding:11px 14px;border-radius:10px;
                     background:rgba(255,255,255,.06);border:1.5px solid rgba(31,72,126,.4);
                     color:#f0f4ff;font-size:.95rem;outline:none;font-family:inherit" />
          </div>
        </div>
        <div id="cf-error" style="color:#f87171;font-size:.78rem;display:none"></div>
      </div>`;

    const pasoCF = await Swal.fire({
      title: '<span style="font-size:1rem;letter-spacing:.08em;text-transform:uppercase;color:#7aaee8">Factura B — Consumidor Final</span>',
      html: htmlCF,
      background: '#111c30',
      color: '#f0f4ff',
      showConfirmButton: true,
      confirmButtonText: 'Emitir',
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
      allowEscapeKey: false,
      width: '460px',
      customClass: { confirmButton: 'af-apps-confirm' },
      preConfirm: () => {
        const nombre    = (document.getElementById('cf-nombre').value || '').trim();
        const docTipo   = Number(document.getElementById('cf-doc-tipo').value);
        const docNroRaw = document.getElementById('cf-doc-nro').value.replace(/\D/g, '');
        const docNro    = docNroRaw ? Number(docNroRaw) : 0;
        const errEl     = document.getElementById('cf-error');
        if (nombre && !docNro) {
          errEl.textContent = 'Si ingresás nombre, también ingresá el número de documento.';
          errEl.style.display = 'block';
          return false;
        }
        if (docNro && !nombre) {
          errEl.textContent = 'Si ingresás número de documento, también ingresá el nombre.';
          errEl.style.display = 'block';
          return false;
        }
        errEl.style.display = 'none';
        return { nombre, docTipo, docNro };
      }
    });

    if (!pasoCF.isConfirmed) { window.location.href = '/productos'; return; }

    const { nombre: cfNombre, docTipo: cfDocTipo, docNro: cfDocNro } = pasoCF.value;

    const cfPayload = (cfNombre && cfDocNro) ? {
      cbte_tipo: 6, doc_tipo: cfDocTipo, doc_nro: cfDocNro,
      receptor_cond_iva_id: 5, receptor_nombre: cfNombre
    } : {
      cbte_tipo: 6, doc_tipo: 99, doc_nro: 0, receptor_cond_iva_id: 5
    };

    await _emitirARCA(facturaId, cfPayload);
    return;
  }

  // ── Paso 2b: Con CUIT ────────────────────────────────────
  const htmlCuit = `
    <div style="display:flex;flex-direction:column;gap:14px;padding:4px 0;text-align:left">

      <div>
        <label style="font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4d6380;display:block;margin-bottom:6px">
          CUIT del receptor (11 dígitos, sin guiones)
        </label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="arca-cuit-input" type="text" inputmode="numeric" maxlength="11"
            placeholder="Ej: 20123456789"
            style="flex:1;padding:12px 14px;border-radius:10px;
                   background:rgba(255,255,255,.06);border:1.5px solid rgba(31,72,126,.4);
                   color:#f0f4ff;font-size:1rem;outline:none;font-family:inherit" />
          <button id="arca-cuit-buscar" type="button"
            style="padding:11px 14px;border-radius:10px;flex-shrink:0;
                   background:rgba(31,72,126,.25);border:1.5px solid rgba(31,72,126,.5);
                   color:#c0d8f8;font-size:.82rem;font-weight:700;cursor:pointer;white-space:nowrap">
            <i class="fa-solid fa-magnifying-glass"></i> Buscar
          </button>
        </div>
        <div id="arca-cuit-buscando" style="color:#7aaee8;font-size:.78rem;margin-top:5px;display:none">
          <i class="fa-solid fa-spinner fa-spin"></i> Consultando padrón AFIP…
        </div>
        <div id="arca-cuit-error" style="color:#f87171;font-size:.78rem;margin-top:5px;display:none"></div>
      </div>

      <div>
        <label style="font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4d6380;display:block;margin-bottom:6px">
          Razón Social / Nombre
        </label>
        <input id="arca-receptor-nombre" type="text" maxlength="100"
          placeholder="Se completa automáticamente al buscar"
          style="width:100%;padding:11px 14px;border-radius:10px;
                 background:rgba(255,255,255,.06);border:1.5px solid rgba(31,72,126,.35);
                 color:#f0f4ff;font-size:.95rem;outline:none;font-family:inherit" />
      </div>

      <div id="arca-domicilio-row" style="display:none">
        <label style="font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4d6380;display:block;margin-bottom:6px">
          Domicilio
        </label>
        <input id="arca-receptor-domicilio" type="text" maxlength="200" readonly
          style="width:100%;padding:11px 14px;border-radius:10px;
                 background:rgba(255,255,255,.03);border:1.5px solid rgba(31,72,126,.2);
                 color:#8fa3c0;font-size:.9rem;outline:none;font-family:inherit" />
      </div>

      <div>
        <label style="font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4d6380;display:block;margin-bottom:6px">
          Tipo de comprobante
        </label>
        <div style="display:flex;gap:10px">
          <label style="flex:1;cursor:pointer">
            <input type="radio" name="arca-cbte" value="6" checked style="display:none">
            <div id="arca-radio-b" style="padding:10px 14px;border-radius:10px;border:1.5px solid rgba(31,72,126,.4);background:rgba(31,72,126,.2);text-align:center;font-size:.85rem;font-weight:700;color:#7aaee8;transition:.15s">
              Factura B
            </div>
          </label>
          <label style="flex:1;cursor:pointer">
            <input type="radio" name="arca-cbte" value="1" style="display:none">
            <div id="arca-radio-a" style="padding:10px 14px;border-radius:10px;border:1.5px solid rgba(99,102,241,.25);background:rgba(99,102,241,.07);text-align:center;font-size:.85rem;font-weight:700;color:#8fa3c0;transition:.15s">
              Factura A
            </div>
          </label>
        </div>
      </div>

      <div>
        <label style="font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4d6380;display:block;margin-bottom:6px">
          Condición IVA del receptor
        </label>
        <select id="arca-cond-iva" style="width:100%;padding:12px 14px;border-radius:10px;
          background:rgba(255,255,255,.06);border:1.5px solid rgba(31,72,126,.4);
          color:#f0f4ff;font-size:.9rem;outline:none;font-family:inherit;cursor:pointer">
          <option value="5" style="background:#111c30">Consumidor Final (5)</option>
          <option value="4" style="background:#111c30">Exento (4)</option>
          <option value="6" style="background:#111c30">Responsable Monotributo (6)</option>
          <option value="1" style="background:#111c30">Responsable Inscripto (1) — solo Fact. A</option>
        </select>
      </div>

    </div>`;

  const paso2 = await Swal.fire({
    title: '<span style="font-size:1rem;letter-spacing:.08em;text-transform:uppercase;color:#a5b4fc">Datos del receptor</span>',
    html: htmlCuit,
    background: '#111c30',
    color: '#f0f4ff',
    showConfirmButton: true,
    confirmButtonText: 'Emitir ARCA',
    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    allowOutsideClick: false,
    allowEscapeKey: false,
    width: '480px',
    customClass: { confirmButton: 'af-apps-confirm' },
    didOpen: () => {
      // Highlight visual radios
      document.querySelectorAll('input[name="arca-cbte"]').forEach(radio => {
        radio.addEventListener('change', () => {
          const isA = document.querySelector('input[name="arca-cbte"]:checked').value === '1';
          document.getElementById('arca-radio-b').style.background    = isA ? 'rgba(31,72,126,.07)' : 'rgba(31,72,126,.2)';
          document.getElementById('arca-radio-b').style.color          = isA ? '#4d6380' : '#7aaee8';
          document.getElementById('arca-radio-b').style.borderColor    = isA ? 'rgba(31,72,126,.25)' : 'rgba(31,72,126,.4)';
          document.getElementById('arca-radio-a').style.background    = isA ? 'rgba(99,102,241,.18)' : 'rgba(99,102,241,.07)';
          document.getElementById('arca-radio-a').style.color          = isA ? '#c7d2fe' : '#8fa3c0';
          document.getElementById('arca-radio-a').style.borderColor    = isA ? 'rgba(99,102,241,.5)' : 'rgba(99,102,241,.25)';
          if (isA) document.getElementById('arca-cond-iva').value = '1';
        });
      });

      // Autocomplete padrón AFIP
      async function buscarCuit() {
        const cuitVal = (document.getElementById('arca-cuit-input').value || '').replace(/\D/g, '');
        const errEl   = document.getElementById('arca-cuit-error');
        const busEl   = document.getElementById('arca-cuit-buscando');
        errEl.style.display = 'none';
        if (cuitVal.length !== 11) {
          errEl.textContent = 'El CUIT debe tener exactamente 11 dígitos.';
          errEl.style.display = 'block';
          return;
        }
        busEl.style.display = 'block';
        try {
          const r = await fetch(`/arca/receptor?doc_tipo=80&doc_nro=${cuitVal}&resolve=1`);
          const d = await r.json();
          busEl.style.display = 'none';
          if (d.razon_social || d.nombre) {
            document.getElementById('arca-receptor-nombre').value = (d.razon_social || d.nombre || '').trim();
            if (d.domicilio) {
              document.getElementById('arca-receptor-domicilio').value = d.domicilio;
              document.getElementById('arca-domicilio-row').style.display = 'block';
            }
            // Autoseleccionar condición IVA
            if (d.cond_iva_id) {
              const sel = document.getElementById('arca-cond-iva');
              if (sel.querySelector(`option[value="${d.cond_iva_id}"]`)) {
                sel.value = String(d.cond_iva_id);
                if (Number(d.cond_iva_id) === 1) {
                  document.querySelector('input[name="arca-cbte"][value="1"]').checked = true;
                  document.querySelector('input[name="arca-cbte"][value="1"]').dispatchEvent(new Event('change'));
                }
              }
            }
          } else {
            errEl.textContent = d.error || 'CUIT no encontrado en el padrón. Podés ingresar el nombre manualmente.';
            errEl.style.display = 'block';
          }
        } catch(e) {
          busEl.style.display = 'none';
          errEl.textContent = 'Error al consultar padrón. Ingresá el nombre manualmente.';
          errEl.style.display = 'block';
        }
      }

      document.getElementById('arca-cuit-buscar').addEventListener('click', buscarCuit);
      document.getElementById('arca-cuit-input').addEventListener('input', function() {
        if (this.value.replace(/\D/g, '').length === 11) buscarCuit();
      });
    },
    preConfirm: () => {
      const cuitVal        = (document.getElementById('arca-cuit-input').value || '').replace(/\D/g, '');
      const errEl          = document.getElementById('arca-cuit-error');
      const receptorNombre = (document.getElementById('arca-receptor-nombre').value || '').trim();
      const receptorDom    = (document.getElementById('arca-receptor-domicilio')?.value || '').trim();

      if (cuitVal.length !== 11) {
        errEl.textContent = 'El CUIT debe tener exactamente 11 dígitos.';
        errEl.style.display = 'block';
        return false;
      }
      errEl.style.display = 'none';

      const cbte_tipo = Number(document.querySelector('input[name="arca-cbte"]:checked').value);
      const cond_iva  = Number(document.getElementById('arca-cond-iva').value);

      if (cbte_tipo === 1 && cond_iva !== 1) {
        errEl.textContent = 'Factura A requiere condición IVA: Responsable Inscripto (1).';
        errEl.style.display = 'block';
        return false;
      }
      if (cbte_tipo === 6 && cond_iva === 1) {
        errEl.textContent = 'Factura B no acepta condición IVA Responsable Inscripto. Usá Factura A.';
        errEl.style.display = 'block';
        return false;
      }

      return { cbte_tipo, doc_nro: Number(cuitVal), cond_iva, receptorNombre, receptorDom };
    }
  });

  if (!paso2.isConfirmed) { window.location.href = '/productos'; return; }

  const { cbte_tipo, doc_nro, cond_iva, receptorNombre, receptorDom } = paso2.value;

  const cuitPayload = { cbte_tipo, doc_tipo: 80, doc_nro, receptor_cond_iva_id: cond_iva };
  if (receptorNombre) cuitPayload.receptor_nombre    = receptorNombre;
  if (receptorDom)    cuitPayload.receptor_domicilio = receptorDom;

  // Solo pasar resolve_receptor si no tenemos nombre (para no pisar lo que ya completó el admin)
  await _emitirARCA(facturaId, cuitPayload, !receptorNombre);
}


/* ── Llamada real al endpoint ARCA ── */
async function _emitirARCA(facturaId, payload, resolveReceptor = false) {

  // Spinner mientras emite
  Swal.fire({
    title: 'Emitiendo comprobante ARCA…',
    html: '<p style="color:#8fa3c0;font-size:.9rem">Conectando con WSFE · no cerrar esta ventana</p>',
    background: '#111c30',
    color: '#f0f4ff',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const qs = resolveReceptor ? '?resolve_receptor=1' : '';
    const resp = await fetch(`/arca/emitir-desde-factura/${facturaId}${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    // ── EMITIDO ─────────────────────────────────────────────
    if (resp.ok && data.estado === 'EMITIDO') {
      const tipoLabel = (data.cbte_tipo === 1 || data.cbte_tipo === 51) ? 'Factura A' : 'Factura B';
      const pdfUrl   = `/arca/pdf/${data.arca_id}`;

      await Swal.fire({
        icon: 'success',
        title: '<span style="color:#4ade80">✓ Comprobante emitido</span>',
        html: `
          <div style="text-align:left;display:flex;flex-direction:column;gap:8px;margin-top:8px">
            <div style="display:flex;justify-content:space-between;padding:10px 14px;background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.2);border-radius:10px">
              <span style="color:#4d6380;font-size:.82rem;font-weight:700">CAE</span>
              <strong style="color:#f0f4ff;font-family:monospace;font-size:.9rem">${data.cae || '-'}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 14px;background:rgba(31,72,126,.1);border-radius:10px">
              <span style="color:#4d6380;font-size:.82rem;font-weight:700">Comprobante N°</span>
              <strong style="color:#f0f4ff">${String(data.cbte_nro || '-').padStart(8,'0')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 14px;background:rgba(31,72,126,.1);border-radius:10px">
              <span style="color:#4d6380;font-size:.82rem;font-weight:700">Tipo</span>
              <strong style="color:#f0f4ff">${tipoLabel}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 14px;background:rgba(31,72,126,.1);border-radius:10px">
              <span style="color:#4d6380;font-size:.82rem;font-weight:700">Vto. CAE</span>
              <strong style="color:#f0f4ff">${_formatFecha8(data.cae_vto)}</strong>
            </div>

            <a href="${pdfUrl}" target="_blank" rel="noopener"
               style="display:flex;align-items:center;justify-content:center;gap:10px;
                      margin-top:6px;padding:13px 20px;border-radius:12px;
                      background:rgba(31,72,126,.25);border:1.5px solid rgba(31,72,126,.5);
                      color:#c0d8f8;font-size:.9rem;font-weight:800;
                      text-decoration:none;letter-spacing:.04em">
              <i class="fa-solid fa-print"></i>
              Imprimir / Ver PDF
            </a>
          </div>`,
        background: '#111c30',
        color: '#f0f4ff',
        confirmButtonText: 'Ir a productos',
        customClass: { confirmButton: 'af-apps-confirm' },
        allowOutsideClick: false
      });
      window.location.href = '/productos';
      return;
    }

    // ── PENDIENTE (WSFE no confirmó) ─────────────────────────
    if (resp.status === 202 || data.estado === 'PENDIENTE') {
      await Swal.fire({
        icon: 'warning',
        title: '<span style="color:#fbbf24">⚠ Pendiente de confirmación</span>',
        html: `
          <p style="color:#8fa3c0;font-size:.88rem;margin-bottom:12px">
            WSFE no confirmó el comprobante en este momento. La factura interna quedó guardada.
            Verificá el estado en el panel ARCA antes de reimprimir o reemitir.
          </p>
          <div style="padding:10px 14px;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);border-radius:10px;font-size:.82rem;color:#fbbf24">
            ${data.obs_msg || data.error || 'Sin detalle disponible'}
          </div>`,
        background: '#111c30',
        color: '#f0f4ff',
        confirmButtonText: 'Entendido',
        customClass: { confirmButton: 'af-apps-confirm' },
        allowOutsideClick: false
      });
      window.location.href = '/productos';
      return;
    }

    // ── DUPLICADO (409) ───────────────────────────────────────
    if (resp.status === 409) {
      await Swal.fire({
        icon: 'info',
        title: 'Ya existe un comprobante ARCA',
        html: `<p style="color:#8fa3c0;font-size:.88rem">
          Esta factura ya tiene un comprobante ARCA en estado <strong style="color:#f0f4ff">${data.estado}</strong>.
          ${data.cae ? `<br>CAE: <code style="color:#7aaee8">${data.cae}</code>` : ''}
          </p>`,
        background: '#111c30',
        color: '#f0f4ff',
        confirmButtonText: 'Ir a productos',
        customClass: { confirmButton: 'af-apps-confirm' }
      });
      window.location.href = '/productos';
      return;
    }

    // ── RECHAZADO u otro error ────────────────────────────────
    const detalle = data.error || data.obs_msg || JSON.stringify(data);
    await Swal.fire({
      icon: 'error',
      title: '<span style="color:#f87171">Error al emitir en ARCA</span>',
      html: `
        <p style="color:#8fa3c0;font-size:.85rem;margin-bottom:10px">
          La factura interna quedó guardada. Podés reintentar la emisión desde el panel ARCA.
        </p>
        <pre style="text-align:left;font-size:.75rem;max-height:180px;overflow:auto;
                    background:rgba(217,4,41,.05);border:1px solid rgba(217,4,41,.2);
                    color:#fca5a5;padding:10px;border-radius:8px;white-space:pre-wrap">${String(detalle).substring(0, 600)}</pre>`,
      background: '#111c30',
      color: '#f0f4ff',
      confirmButtonText: 'Ir a productos',
      customClass: { confirmButton: 'af-apps-confirm' },
      allowOutsideClick: false
    });
    window.location.href = '/productos';

  } catch (err) {
    // Error de red / respuesta no-JSON
    await Swal.fire({
      icon: 'error',
      title: 'Error de conexión con ARCA',
      html: `<p style="color:#8fa3c0;font-size:.85rem">
        No se pudo conectar con el servicio ARCA. La factura interna quedó guardada correctamente.
        Podés reintentar la emisión desde el panel ARCA.
        </p>
        <code style="font-size:.78rem;color:#f87171">${err.message || String(err)}</code>`,
      background: '#111c30',
      color: '#f0f4ff',
      confirmButtonText: 'Ir a productos',
      customClass: { confirmButton: 'af-apps-confirm' },
      allowOutsideClick: false
    });
    window.location.href = '/productos';
  }
}

/* ── Helper: formatea fecha YYYYMMDD → DD/MM/YYYY ── */
function _formatFecha8(f) {
  if (!f || String(f).length !== 8) return f || '-';
  return `${f.slice(6,8)}/${f.slice(4,6)}/${f.slice(0,4)}`;
}