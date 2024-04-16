document.getElementById('mostrarFormulario').addEventListener('click', function() {
    var formulario = document.getElementById('formularioFacturas');
    if (formulario.style.display === 'none') {
      formulario.style.display = 'block';
    } else {
      formulario.style.display = 'none';
    }
  });