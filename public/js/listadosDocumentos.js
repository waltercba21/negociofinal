document.addEventListener('DOMContentLoaded', () => {
  const btnBuscar = document.getElementById('btnBuscarListados');
  const resultados = document.getElementById('resultadosListado');
  const modal = new bootstrap.Modal(document.getElementById('modalDetalleDocumento'));
  const contenido = document.getElementById('contenidoDetalleDocumento');

  btnBuscar.addEventListener('click', () => {
    // Simulación de resultados
    resultados.innerHTML = `
      <div class="card p-3 mb-3 shadow-sm">
        <h6>LIDERCAR</h6>
        <p><strong>FACTURA:</strong> 123456</p>
        <p><strong>Fecha:</strong> 2025-05-12</p>
        <p><strong>Condición:</strong> pendiente</p>
        <button class="btn btn-sm btn-primary" id="btnVerDetalle">Ver</button>
      </div>
    `;

    // Asociar evento a botón "Ver"
    document.getElementById('btnVerDetalle').addEventListener('click', () => {
      contenido.innerHTML = `
        <p><strong>Proveedor:</strong> LIDERCAR</p>
        <p><strong>Factura:</strong> 123456</p>
        <p><strong>Fecha:</strong> 2025-05-12</p>
        <p><strong>Importe:</strong> $45.000</p>
        <p><strong>Condición:</strong> Pendiente</p>
      `;
      modal.show();
    });
  });
});