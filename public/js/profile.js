document.addEventListener('DOMContentLoaded', function () {
  const selectProvincia = document.getElementById('provincia');
  const nombreProvinciaUsuario = document.getElementById('nombreProvincia').value;

  const selectLocalidad = document.getElementById('localidad');
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
        // Buscar el índice de la provincia en el array de provincias
        const provinciaSeleccionada = provincias.find(p => p.nombre === nombreProvinciaUsuario);
        if (provinciaSeleccionada) {
          selectProvincia.value = provinciaSeleccionada.nombre;
          cargarLocalidades(provinciaSeleccionada.id); // Cargar localidades al seleccionar la provincia
        }
      }

      selectProvincia.addEventListener('change', function() {
        const provinciaId = provincias.find(p => p.nombre === selectProvincia.value)?.id;
        cargarLocalidades(provinciaId);
      });
    } catch (error) {
      console.error('Error al cargar provincias:', error);
    }
  }

  // Función para cargar localidades
  async function cargarLocalidades(provinciaId) {
    if (provinciaId) {
      try {
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
