document.addEventListener('DOMContentLoaded', function () {
  // Función para cargar provincias
  async function cargarProvincias() {
    try {
      const response = await fetch('https://apis.datos.gob.ar/georef/api/provincias');
      const data = await response.json();
      const provincias = data.provincias;

      const provinciaSelect = document.getElementById('provincia');
      provincias.sort((a, b) => a.nombre.localeCompare(b.nombre));

      provincias.forEach(provincia => {
        const option = document.createElement('option');
        option.value = provincia.nombre; // Valor será el nombre
        option.dataset.id = provincia.id; // ID como atributo adicional
        option.textContent = provincia.nombre;
        provinciaSelect.appendChild(option);
      });

      provinciaSelect.addEventListener('change', cargarLocalidades); // Asigna evento al select
    } catch (error) {
      console.error('Error al cargar provincias:', error);
    }
  }

  // Función para cargar localidades
  async function cargarLocalidades() {
    const provinciaId = document.getElementById('provincia').selectedOptions[0]?.dataset.id; // Obtener ID de provincia
    const localidadSelect = document.getElementById('localidad');

    if (provinciaId) {
      try {
        const response = await fetch(`https://apis.datos.gob.ar/georef/api/localidades?provincia=${provinciaId}&max=5000`);
        const data = await response.json();
        const localidades = data.localidades || [];

        localidadSelect.innerHTML = '<option value="">Selecciona una localidad</option>';
        localidades.sort((a, b) => a.nombre.localeCompare(b.nombre));

        localidades.forEach(localidad => {
          const option = document.createElement('option');
          option.value = localidad.nombre; // Valor será el nombre
          option.dataset.id = localidad.id; // ID como atributo adicional
          option.textContent = localidad.nombre;
          localidadSelect.appendChild(option);
        });
      } catch (error) {
        console.error('Error al cargar localidades:', error);
      }
    } else {
      localidadSelect.innerHTML = '<option value="">Selecciona una localidad</option>';
    }
  }

  // Validar formulario
  function validarFormulario() {
    const nombre = document.querySelector('input[name="nombre"]').value.trim();
    const email = document.querySelector('input[name="email"]').value.trim();
    const password = document.querySelector('input[name="password"]').value;
    const confirmarPassword = document.querySelector('input[name="confirmar_password"]').value;

    if (!nombre || !email || !password || !confirmarPassword) {
      Swal.fire({ icon: 'error', title: 'Campos incompletos', text: 'Por favor, completa todos los campos obligatorios.' });
      return false;
    }

    if (password !== confirmarPassword) {
      Swal.fire({ icon: 'error', title: 'Contraseñas no coinciden', text: 'Las contraseñas ingresadas no coinciden.' });
      return false;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      Swal.fire({ icon: 'error', title: 'Contraseña no válida', text: 'Debe tener al menos 8 caracteres, 1 mayúscula y 1 número.' });
      return false;
    }

    return true;
  }

  // Mostrar/ocultar contraseña
  const eyeIcon = document.getElementById('eye-icon');
  const passwordInput = document.getElementById('password-input');

  if (eyeIcon && passwordInput) {
    eyeIcon.addEventListener('click', function () {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
      } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
      }
    });
  } else {
    console.error('No se encontró el input de contraseña o el icono del ojo.');
  }

  // Inicializar carga de provincias
  cargarProvincias();
});
