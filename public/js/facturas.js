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