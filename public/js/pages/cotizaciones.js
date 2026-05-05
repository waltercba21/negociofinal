function fechaHoyYYYYMMDD(timeZone = 'America/Argentina/Cordoba') {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

function formatCurrencyAR(valor) {
  const num = Number(valor) || 0;
  return num.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  });
}

function parseMoney(valor) {
  if (valor === null || valor === undefined) return 0;

  let txt = String(valor)
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();

  const n = Number(txt);
  return Number.isFinite(n) ? n : 0;
}

function calcularTotal() {
  const tabla = document.getElementById('tabla-cotizacion');
  if (!tabla) return;

  const filas = tabla.getElementsByTagName('tbody')[0].rows;
  let total = 0;

  for (let i = 0; i < filas.length; i++) {
    const subtotalTxt = filas[i].cells[6].textContent;
    const subtotal = parseMoney(subtotalTxt);
    total += subtotal;
  }

  const totalInput = document.getElementById('total-amount');
  if (totalInput) totalInput.value = formatCurrencyAR(total);
}

function updateSubtotal(row) {
  const inputPrecio = row.cells[3].querySelector('input');
  const inputCantidad = row.cells[4].querySelector('input');

  if (!inputPrecio || !inputCantidad) return;

  const precio = parseMoney(inputPrecio.value);
  const cantidad = parseInt(inputCantidad.value, 10) || 1;
  const subtotal = precio * cantidad;

  row.cells[6].textContent = formatCurrencyAR(subtotal);
  calcularTotal();
}

let _productosEnBusqueda = [];

function obtenerIdsEnTabla() {
  const mapa = {};
  const filas = document.getElementById('tabla-cotizacion').getElementsByTagName('tbody')[0].rows;

  for (let i = 0; i < filas.length; i++) {
    const id = filas[i].dataset.productoId;
    if (id) {
      const qty = parseInt(filas[i].cells[4].querySelector('input')?.value, 10) || 1;
      mapa[id] = { cantidad: qty, filaIndex: i };
    }
  }

  return mapa;
}

function agregarProductoATabla(productoId, codigoProducto, nombreProducto, precioVenta, stockActual, imagenProducto, cantidadInicial) {
  const tabla = document.getElementById('tabla-cotizacion').getElementsByTagName('tbody')[0];
  const filas = tabla.rows;
  const cantAgregar = parseInt(cantidadInicial, 10) || 1;

  for (let i = 0; i < filas.length; i++) {
    if (filas[i].dataset.productoId && String(filas[i].dataset.productoId) === String(productoId)) {
      const inputQty = filas[i].cells[4].querySelector('input');
      if (inputQty) {
        inputQty.value = cantAgregar;
        updateSubtotal(filas[i]);
        filas[i].classList.add('row-flash');
        setTimeout(() => filas[i].classList.remove('row-flash'), 600);
      }
      return;
    }
  }

  let filaDisponible = null;

  for (let i = 0; i < filas.length; i++) {
    if (!filas[i].dataset.productoId) {
      filaDisponible = filas[i];
      break;
    }
  }

  if (!filaDisponible) {
    Swal.fire('Límite alcanzado', 'Solo se pueden agregar hasta 15 productos.', 'warning');
    return;
  }

  filaDisponible.dataset.productoId = String(productoId);

  const imgElement = filaDisponible.cells[0].querySelector('img');
  if (imagenProducto && imgElement) {
    imgElement.src = imagenProducto;
    imgElement.style.display = 'block';
  }

  filaDisponible.cells[1].textContent = codigoProducto || productoId;

  const esPrueba = String(nombreProducto || '').trim().toUpperCase() === 'PRODUCTO PRUEBA';

  if (esPrueba) {
    filaDisponible.cells[2].innerHTML = `
      <input type="text" class="facturas-tabla__desc-input" placeholder="Escribir nombre del producto..." value="" autocomplete="off" />
    `;
  } else {
    filaDisponible.cells[2].textContent = nombreProducto || '';
  }

  const inputPrecio = filaDisponible.cells[3].querySelector('input');
  if (inputPrecio) {
    inputPrecio.value = formatCurrencyAR(precioVenta);
    inputPrecio.disabled = false;
    inputPrecio.addEventListener('input', () => updateSubtotal(filaDisponible));
  }

  filaDisponible.cells[4].innerHTML = `
    <div class="qty-control">
      <button type="button" class="qty-btn qty-btn--minus" tabindex="-1">
        <i class="fa-solid fa-minus"></i>
      </button>
      <input type="number" min="1" value="${cantAgregar}" class="facturas-tabla__input facturas-tabla__input--qty" />
      <button type="button" class="qty-btn qty-btn--plus" tabindex="-1">
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>
  `;

  const inputCantidad = filaDisponible.cells[4].querySelector('input');
  const btnMinus = filaDisponible.cells[4].querySelector('.qty-btn--minus');
  const btnPlus = filaDisponible.cells[4].querySelector('.qty-btn--plus');

  btnMinus.addEventListener('click', () => {
    const val = parseInt(inputCantidad.value, 10) || 1;
    if (val > 1) {
      inputCantidad.value = val - 1;
      updateSubtotal(filaDisponible);
    }
  });

  btnPlus.addEventListener('click', () => {
    const val = parseInt(inputCantidad.value, 10) || 1;
    inputCantidad.value = val + 1;
    updateSubtotal(filaDisponible);
  });

  inputCantidad.addEventListener('input', () => updateSubtotal(filaDisponible));

  filaDisponible.cells[5].textContent = Number(stockActual) || 0;
  filaDisponible.cells[6].textContent = formatCurrencyAR(Number(precioVenta || 0) * cantAgregar);

  const botonEliminar = filaDisponible.cells[7].querySelector('button');
  if (botonEliminar) {
    botonEliminar.style.display = 'block';
    botonEliminar.innerHTML = '<i class="fas fa-trash"></i>';
    botonEliminar.onclick = function () {
      delete filaDisponible.dataset.productoId;

      filaDisponible.cells[1].textContent = '';
      filaDisponible.cells[2].innerHTML = '';

      if (inputPrecio) {
        inputPrecio.value = '';
        inputPrecio.disabled = true;
      }

      filaDisponible.cells[4].innerHTML = `
        <input type="number" min="1" value="0" class="facturas-tabla__input facturas-tabla__input--qty" disabled />
      `;

      filaDisponible.cells[5].textContent = '';
      filaDisponible.cells[6].textContent = '';

      if (imgElement) {
        imgElement.src = '';
        imgElement.style.display = 'none';
      }

      botonEliminar.style.display = 'none';

      calcularTotal();
      renderResultados(_productosEnBusqueda);
    };
  }

  calcularTotal();

  filaDisponible.classList.add('row-new');
  setTimeout(() => filaDisponible.classList.remove('row-new'), 500);
}

function quitarDeTabla(id) {
  const filas = document.getElementById('tabla-cotizacion').getElementsByTagName('tbody')[0].rows;

  for (let i = 0; i < filas.length; i++) {
    if (String(filas[i].dataset.productoId) === String(id)) {
      const boton = filas[i].cells[7].querySelector('button');
      if (boton) boton.click();
      break;
    }
  }
}

function crearElementoResultado(producto, enTabla) {
  const id = String(producto.id);
  const codigo = String(producto.codigo ?? producto.codigo_proveedor ?? producto.id ?? '').trim();
  const stock = parseInt(producto.stock_actual, 10) || 0;
  const info = enTabla[id] || null;

  const resultado = document.createElement('div');
  resultado.classList.add('resultado-busqueda');
  if (info) resultado.classList.add('en-tabla');

  resultado.dataset.id = id;
  resultado.dataset.codigo = codigo;
  resultado.dataset.nombre = producto.nombre || '';
  resultado.dataset.precio_venta = producto.precio_venta || 0;
  resultado.dataset.stock_actual = stock;

  let imagen = '';
  if (producto.imagenes && producto.imagenes.length > 0) {
    const imgRaw = producto.imagenes[0].imagen || producto.imagenes[0];
    imagen = '/uploads/productos/' + imgRaw;
    resultado.dataset.imagen = imagen;
  }

  const imgWrap = document.createElement('div');
  imgWrap.classList.add('srb-img-wrap');

  if (imagen) {
    const img = document.createElement('img');
    img.src = imagen;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.classList.add('srb-img');
    imgWrap.appendChild(img);
  } else {
    imgWrap.innerHTML = '<span class="srb-img-placeholder"><i class="fa-solid fa-image"></i></span>';
  }

  resultado.appendChild(imgWrap);

  const infoDiv = document.createElement('div');
  infoDiv.classList.add('srb-info');

  const nombreSpan = document.createElement('span');
  nombreSpan.classList.add('srb-nombre');
  nombreSpan.textContent = producto.nombre || 'Producto sin nombre';
  infoDiv.appendChild(nombreSpan);

  const precioSpan = document.createElement('span');
  precioSpan.classList.add('srb-precio');
  precioSpan.textContent = `${formatCurrencyAR(producto.precio_venta)} · Stock: ${stock}`;
  infoDiv.appendChild(precioSpan);

  resultado.appendChild(infoDiv);

  const badge = document.createElement('span');
  badge.classList.add('srb-badge');
  badge.textContent = info ? info.cantidad : '';
  badge.style.display = info ? 'inline-flex' : 'none';
  resultado.appendChild(badge);

  const controles = document.createElement('div');
  controles.classList.add('srb-controles');

  const btnMinus = document.createElement('button');
  btnMinus.type = 'button';
  btnMinus.classList.add('srb-qty-minus', 'srb-btn');
  btnMinus.innerHTML = '<i class="fa-solid fa-minus"></i>';

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.min = '1';
  qtyInput.value = info ? String(info.cantidad) : '1';
  qtyInput.tabIndex = -1;
  qtyInput.classList.add('srb-qty-input');

  const btnPlus = document.createElement('button');
  btnPlus.type = 'button';
  btnPlus.classList.add('srb-qty-plus', 'srb-btn');
  btnPlus.innerHTML = '<i class="fa-solid fa-plus"></i>';

  const btnAgregar = document.createElement('button');
  btnAgregar.type = 'button';
  btnAgregar.classList.add('srb-agregar', 'srb-btn');
  btnAgregar.innerHTML = '<i class="fa-solid fa-cart-plus"></i><span>Agregar</span>';
  btnAgregar.style.display = info ? 'none' : 'flex';

  const btnQuitar = document.createElement('button');
  btnQuitar.type = 'button';
  btnQuitar.classList.add('srb-delete', 'srb-btn');
  btnQuitar.innerHTML = '<i class="fa-solid fa-trash"></i><span>Quitar</span>';
  btnQuitar.style.display = info ? 'flex' : 'none';

  controles.appendChild(btnMinus);
  controles.appendChild(qtyInput);
  controles.appendChild(btnPlus);
  controles.appendChild(btnAgregar);
  controles.appendChild(btnQuitar);
  resultado.appendChild(controles);

  [btnMinus, btnPlus, btnAgregar, btnQuitar, qtyInput].forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopImmediatePropagation();
    });
  });

  btnMinus.addEventListener('click', e => {
    e.stopImmediatePropagation();
    const val = parseInt(qtyInput.value, 10) || 1;
    if (val > 1) qtyInput.value = val - 1;
  });

  btnPlus.addEventListener('click', e => {
    e.stopImmediatePropagation();
    const val = parseInt(qtyInput.value, 10) || 1;
    qtyInput.value = val + 1;
  });

  btnAgregar.addEventListener('click', e => {
    e.stopImmediatePropagation();

    const qty = parseInt(qtyInput.value, 10) || 1;

    agregarProductoATabla(
      id,
      codigo,
      producto.nombre || '',
      producto.precio_venta || 0,
      stock,
      imagen,
      qty
    );

    renderResultados(_productosEnBusqueda);

    const entrada = document.getElementById('entradaBusqueda');
    if (entrada) entrada.focus();
  });

  btnQuitar.addEventListener('click', e => {
    e.stopImmediatePropagation();
    quitarDeTabla(id);
    renderResultados(_productosEnBusqueda);
  });

  return resultado;
}

function renderResultados(productos) {
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  if (!resultadosBusqueda) return;

  _productosEnBusqueda = productos || [];
  resultadosBusqueda.innerHTML = '';

  if (!_productosEnBusqueda.length) {
    resultadosBusqueda.style.display = 'none';
    return;
  }

  const enTabla = obtenerIdsEnTabla();

  _productosEnBusqueda.forEach(p => {
    resultadosBusqueda.appendChild(crearElementoResultado(p, enTabla));
  });

  resultadosBusqueda.style.display = 'block';
}

function limpiarFormulario() {
  window.location.reload();
}

document.addEventListener('DOMContentLoaded', function () {
  const fechaInput = document.getElementById('fecha-cotizacion');
  if (fechaInput && !fechaInput.value) fechaInput.value = fechaHoyYYYYMMDD();

  const form = document.getElementById('cotizacion-form');
  const entradaBusqueda = document.getElementById('entradaBusqueda');
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  const limpiarBtn = document.getElementById('limpiar-button');

  if (limpiarBtn) {
    limpiarBtn.addEventListener('click', limpiarFormulario);
  }

  if (form) {
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        return false;
      }
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const filas = document.getElementById('tabla-cotizacion').getElementsByTagName('tbody')[0].rows;
      const cotizacionItems = [];
      let total = 0;

      for (let i = 0; i < filas.length; i++) {
        const productoId = filas[i].dataset.productoId || null;
        const codigo = filas[i].cells[1].textContent.trim();

        const descInput = filas[i].cells[2].querySelector('input.facturas-tabla__desc-input');
        const descripcion = descInput
          ? (descInput.value.trim() || 'PRODUCTO PRUEBA')
          : filas[i].cells[2].textContent.trim();

        const precioInput = filas[i].cells[3].querySelector('input');
        const cantidadInput = filas[i].cells[4].querySelector('input');

        const precio_unitario = precioInput ? parseMoney(precioInput.value) : 0;
        const cantidad = cantidadInput ? parseInt(cantidadInput.value, 10) || 1 : 1;
        const stock_informado = parseInt(filas[i].cells[5].textContent.trim(), 10) || 0;

        const subtotal = precio_unitario * cantidad;

        if (productoId && descripcion && precio_unitario > 0 && cantidad > 0) {
          cotizacionItems.push({
            producto_id: productoId,
            codigo,
            descripcion,
            cantidad,
            precio_unitario,
            subtotal,
            stock_informado
          });

          total += subtotal;
        }
      }

      if (!cotizacionItems.length) {
        Swal.fire({
          title: 'Error',
          text: 'Debe agregar al menos un producto válido.',
          icon: 'warning',
          confirmButtonText: 'Entendido'
        });
        return;
      }

      const clienteNombre = document.getElementById('cliente-nombre')?.value.trim();
      if (!clienteNombre) {
        Swal.fire({
          title: 'Falta cliente',
          text: 'Debe completar el nombre o razón social del cliente.',
          icon: 'warning',
          confirmButtonText: 'Entendido'
        });
        return;
      }

      const payload = {
        vendedor: document.getElementById('vendedor')?.value || '',
        fecha: document.getElementById('fecha-cotizacion')?.value || fechaHoyYYYYMMDD(),
        tipo_destinatario: document.getElementById('tipo-destinatario')?.value || 'PERSONA',

        cliente_nombre: clienteNombre,
        cliente_documento: document.getElementById('cliente-documento')?.value.trim() || '',
        cliente_cuit: document.getElementById('cliente-cuit')?.value.trim() || '',
        cliente_condicion_iva: document.getElementById('cliente-condicion-iva')?.value.trim() || '',
        cliente_domicilio: document.getElementById('cliente-domicilio')?.value.trim() || '',
        cliente_telefono: document.getElementById('cliente-telefono')?.value.trim() || '',
        cliente_email: document.getElementById('cliente-email')?.value.trim() || '',

        seguro_compania: document.getElementById('seguro-compania')?.value.trim() || '',
        seguro_siniestro: document.getElementById('seguro-siniestro')?.value.trim() || '',

        vehiculo_marca: document.getElementById('vehiculo-marca')?.value.trim() || '',
        vehiculo_modelo: document.getElementById('vehiculo-modelo')?.value.trim() || '',
        vehiculo_anio: document.getElementById('vehiculo-anio')?.value.trim() || '',
        vehiculo_dominio: document.getElementById('vehiculo-dominio')?.value.trim() || '',
        vehiculo_chasis: document.getElementById('vehiculo-chasis')?.value.trim() || '',

        observaciones: document.getElementById('observaciones')?.value.trim() || '',

        total,
        cotizacionItems
      };

      const filasHTML = cotizacionItems.map((item, idx) => `
        <tr>
          <td style="padding:4px 6px;text-align:center;">${idx + 1}</td>
          <td style="padding:4px 6px;">${item.codigo || item.producto_id}</td>
          <td style="padding:4px 6px;">${item.descripcion}</td>
          <td style="padding:4px 6px;text-align:right;">${formatCurrencyAR(item.precio_unitario)}</td>
          <td style="padding:4px 6px;text-align:center;">${item.cantidad}</td>
          <td style="padding:4px 6px;text-align:right;font-weight:600;">${formatCurrencyAR(item.subtotal)}</td>
        </tr>
      `).join('');

      const resumenHTML = `
        <div style="text-align:left;">
          <p><strong>Cliente:</strong> ${payload.cliente_nombre}</p>
          <p><strong>Fecha:</strong> ${payload.fecha}</p>
          <div style="max-height:260px;overflow:auto;border:1px solid #ddd;border-radius:6px;">
            <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
              <thead>
                <tr style="background:#f5f5f5;">
                  <th style="padding:6px;">#</th>
                  <th style="padding:6px;">Código</th>
                  <th style="padding:6px;">Descripción</th>
                  <th style="padding:6px;text-align:right;">P. Unitario</th>
                  <th style="padding:6px;text-align:center;">Cant.</th>
                  <th style="padding:6px;text-align:right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>${filasHTML}</tbody>
            </table>
          </div>
          <p style="font-size:1.05rem;font-weight:700;text-align:right;margin-top:12px;">
            Total: ${formatCurrencyAR(total)}
          </p>
          <p style="font-size:0.82rem;color:#777;">
            La cotización no descuenta stock y no emite comprobante ARCA.
          </p>
        </div>
      `;

      const { isConfirmed } = await Swal.fire({
        title: 'Confirmar cotización',
        html: resumenHTML,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Guardar cotización',
        cancelButtonText: 'Revisar',
        reverseButtons: true,
        width: '80%'
      });

      if (!isConfirmed) return;

      try {
        const response = await fetch('/productos/procesarCotizacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        let data;

        try {
          data = JSON.parse(rawText);
        } catch (_) {
          Swal.fire({
            title: 'Respuesta del servidor',
            html: `<pre style="text-align:left;font-size:11px;max-height:240px;overflow:auto;">${rawText.substring(0, 800)}</pre>`,
            icon: response.ok ? 'success' : 'error'
          });
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || 'No se pudo guardar la cotización.');
        }

        Swal.fire({
          title: 'Cotización guardada',
          text: 'La cotización fue guardada correctamente.',
          icon: 'success',
          confirmButtonText: 'Ver PDF'
        }).then(() => {
          if (data.cotizacionId) {
            window.open(`/productos/cotizacion/${data.cotizacionId}/pdf`, '_blank');
          }
        });

      } catch (error) {
        Swal.fire({
          title: 'Atención',
          text: error.message,
          icon: 'warning',
          confirmButtonText: 'Entendido'
        });
      }
    });
  }

  if (entradaBusqueda && resultadosBusqueda) {
    let searchTimer = null;
    let searchController = null;
    let blurTimer = null;

    entradaBusqueda.addEventListener('input', e => {
      const busqueda = e.target.value.trim();

      resultadosBusqueda.innerHTML = '';
      resultadosBusqueda.style.display = 'none';

      if (searchController) {
        searchController.abort();
        searchController = null;
      }

      clearTimeout(searchTimer);

      if (!busqueda) {
        _productosEnBusqueda = [];
        return;
      }

      const q = busqueda;

      searchTimer = setTimeout(async () => {
        searchController = new AbortController();

        try {
          const resp = await fetch('/productos/api/buscar?q=' + encodeURIComponent(q), {
            signal: searchController.signal
          });

          const productos = await resp.json();

          if (entradaBusqueda.value.trim() !== q) return;

          renderResultados(Array.isArray(productos) ? productos : []);

        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('[Cotizaciones][Buscador]', err);
          }
        }
      }, 300);
    });

    entradaBusqueda.addEventListener('blur', () => {
      blurTimer = setTimeout(() => {
        resultadosBusqueda.style.display = 'none';
      }, 250);
    });

    entradaBusqueda.addEventListener('focus', () => {
      clearTimeout(blurTimer);
      if (_productosEnBusqueda.length > 0 && entradaBusqueda.value.trim()) {
        renderResultados(_productosEnBusqueda);
      }
    });

    resultadosBusqueda.addEventListener('mousedown', e => {
      e.preventDefault();
    });
  }

  calcularTotal();
});