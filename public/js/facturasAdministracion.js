document.getElementById('mostrarFormulario').addEventListener('click', function() {
  var formulario = document.getElementById('formularioFacturas');
  var fondoOscuro = document.getElementById('fondoOscuro');
  if (formulario.style.display === 'none') {
      formulario.style.display = 'block';
      fondoOscuro.style.display = 'block';
  } else {
      formulario.style.display = 'none';
      fondoOscuro.style.display = 'none';
  }
});

document.querySelector('.btn-facturas-guardar button[type="reset"]').addEventListener('click', function(e) {
  e.preventDefault();
  document.getElementById('formularioFacturas').style.display = 'none';
  document.getElementById('fondoOscuro').style.display = 'none';
});

// Evento de escucha para el fondo oscuro
document.getElementById('fondoOscuro').addEventListener('click', function() {
  document.getElementById('formularioFacturas').style.display = 'none';
  this.style.display = 'none';
});