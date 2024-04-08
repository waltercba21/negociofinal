fetch('https://apis.datos.gob.ar/georef/api/provincias')
  .then(response => response.json())
  .then(data => {
    console.log('Datos de provincias:', data);
    const provincias = data.provincias;
    const selectProvincia = document.getElementById('provincia');
    provincias.forEach(provincia => {
      const option = document.createElement('option');
      option.value = provincia.id;
      option.text = provincia.nombre;
      selectProvincia.appendChild(option);
    });
    console.log('Valor de usuario.provincia:', "<%= usuario.provincia %>");
    selectProvincia.value = "<%= usuario.provincia %>";
    if (selectProvincia.selectedIndex !== -1) {
      document.getElementById('nombreProvincia').value = selectProvincia.options[selectProvincia.selectedIndex].text;
    }
    selectProvincia.addEventListener('change', function() {
      const provinciaSeleccionada = this.value;
      const nombreProvincia = this.options[this.selectedIndex].text;
      document.getElementById('nombreProvincia').value = nombreProvincia;

      // Guardar la provincia seleccionada en la base de datos del usuario
      fetch('/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provincia: provinciaSeleccionada,
          nombreProvincia: nombreProvincia,
        }),
      });

      fetch(`https://apis.datos.gob.ar/georef/api/municipios?provincia=${provinciaSeleccionada}&campos=id,nombre&max=5000`)
        .then(response => response.json())
        .then(data => {
          const localidades = data.municipios;
          const selectLocalidad = document.getElementById('localidad');
          selectLocalidad.innerHTML = ''; // Limpiar las opciones existentes
          localidades.forEach(localidad => {
            const option = document.createElement('option');
            option.value = localidad.id;
            option.text = localidad.nombre;
            selectLocalidad.appendChild(option);
          });
          selectLocalidad.value = "<%= usuario.localidad %>";
          if (selectLocalidad.selectedIndex !== -1) {
            document.getElementById('nombreLocalidad').value = selectLocalidad.options[selectLocalidad.selectedIndex].text;
          }
        });
    });
  });