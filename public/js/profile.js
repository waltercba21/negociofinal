document.addEventListener('DOMContentLoaded', (event) => {
  const selectProvincia = document.getElementById('provincia');
  const provinciaUsuario = selectProvincia.dataset.provincia;

  const selectLocalidad = document.getElementById('localidad');
  const localidadUsuario = selectLocalidad.dataset.localidad;

  fetch('https://apis.datos.gob.ar/georef/api/provincias')
  .then(response => response.json())
  .then(data => {
    const provincias = data.provincias;
    provincias.forEach(provincia => {
      const option = document.createElement('option');
      option.value = provincia.id;
      option.text = provincia.nombre;
      selectProvincia.appendChild(option);
    });
    selectProvincia.value = provinciaUsuario;
    if (selectProvincia.selectedIndex !== -1) { 
      document.getElementById('nombreProvincia').value = selectProvincia.options[selectProvincia.selectedIndex].text;
    }
    selectProvincia.addEventListener('change', function() {
      const provinciaSeleccionada = this.value;
      const nombreProvincia = this.options[this.selectedIndex].text;
      document.getElementById('nombreProvincia').value = nombreProvincia;
      fetch(`https://apis.datos.gob.ar/georef/api/municipios?provincia=${provinciaSeleccionada}&campos=id,nombre&max=5000`)
      .then(response => response.json())
      .then(data => {
        const localidades = data.municipios;
        selectLocalidad.innerHTML = '';
        localidades.forEach(localidad => {
          const option = document.createElement('option');
          option.value = localidad.id;
          option.text = localidad.nombre;
          selectLocalidad.appendChild(option);
        });
        if (localidadUsuario !== "") {
          selectLocalidad.value = localidadUsuario;
          document.getElementById('nombreLocalidad').value = selectLocalidad.options[selectLocalidad.selectedIndex].text;
        }
        selectLocalidad.addEventListener('change', function() {
          const nombreLocalidad = this.options[this.selectedIndex].text;
          document.getElementById('nombreLocalidad').value = nombreLocalidad;
        });
      });
    });
    selectProvincia.dispatchEvent(new Event('change'));
  });
});