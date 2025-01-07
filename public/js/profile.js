document.addEventListener('DOMContentLoaded', function () {
  const selectProvincia = document.getElementById('provincia');
  const provinciaUsuario = document.getElementById('provincia').dataset.provincia;
  const nombreProvinciaUsuario = document.getElementById('nombreProvincia').value;

  const selectLocalidad = document.getElementById('localidad');
  const localidadUsuario = document.getElementById('localidad').dataset.localidad;
  const nombreLocalidadUsuario = document.getElementById('nombreLocalidad').value;

  // Función para cargar provincias
  async function cargarProvincias() {
    try {
      const response = await fetch('https://apis.datos.gob.ar/georef/api/provincias');
      const data = await response.json();
      const provincias = data.provincias;

      provincias.sort((a, b) => a.nombre.localeCompare(b.nombre));

      provincias.forEach(provincia => {
        const option = document.createElement('option');
        option.value = provincia.nombre; // Usar el nombre como valor
        option.dataset.id = provincia.id;
        option.textContent = provincia.nombre;
        selectProvincia.appendChild(option);
      });

      // Seleccionar la provincia del usuario
      if (nombreProvinciaUsuario) {
        selectProvincia.value = nombreProvinciaUsuario;
        cargarLocalidades(); // Cargar localidades automáticamente
      }

      selectProvincia.addEventListener('change', cargarLocalidades);
    } catch (error) {
      console.error('Error al cargar provincias:', error);
    }
  }

  // Función para cargar localidades
  async function cargarLocalidades() {
    const provinciaSeleccionada = selectProvincia.value;

    if (provinciaSeleccionada) {
      try {
        const provinciaId = selectProvincia.selectedOptions[0]?.dataset.id;
        const response = await fetch(`https://apis.datos.gob.ar/georef/api/localidades?provincia=${provinciaId}&max=5000`);
        const data = await response.json();
        const localidades = data.localidades || [];

        selectLocalidad.innerHTML = '<option value="">Selecciona una localidad</option>';
        localidades.sort((a, b) => a.nombre.localeCompare(b.nombre));

        localidades.forEach(localidad => {
          const option = document.createElement('option');
          option.value = localidad.nombre; // Usar el nombre como valor
          option.dataset.id = localidad.id;
          option.textContent = localidad.nombre;
          selectLocalidad.appendChild(option);
        });

        // Seleccionar la localidad del usuario
        if (nombreLocalidadUsuario) {
          selectLocalidad.value = nombreLocalidadUsuario;
        }
      } catch (error) {
        console.error('Error al cargar localidades:', error);
      }
    } else {
      selectLocalidad.innerHTML = '<option value="">Selecciona una localidad</option>';
    }
  }

  // Inicializar carga de provincias
  cargarProvincias();
});
