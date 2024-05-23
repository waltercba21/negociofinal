document.getElementById('marca_id').addEventListener('change', function() {
  const marcaId = this.value;
  fetch('/productos/modelos/' + marcaId) // Cambia '/modelosPorMarca/' a '/modelos/'
      .then(response => response.json())
      .then(modelos => {
          const modeloSelect = document.getElementById('modelo_id');
          modeloSelect.innerHTML = '';
          modelos.forEach(modelo => {
              const option = document.createElement('option');
              option.value = modelo.id;
              option.text = modelo.nombre;
              modeloSelect.appendChild(option);
          });
      })
      .catch(error => console.error('Error:', error));
});