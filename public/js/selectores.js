document.addEventListener('DOMContentLoaded', function() {
    let marcaSelect = document.querySelector('#id_marca');
    let modeloSelect = document.querySelector('#modelo_id');
  
    if (!marcaSelect || !modeloSelect) {
      console.error('No se encontraron los elementos necesarios en el DOM');
      return;
    }
  
    marcaSelect.addEventListener('change', function() {
      // Limpia el select de modelos
      modeloSelect.innerHTML = '';
  
      // Obtiene los modelos para la marca seleccionada
      fetch(`/productos/modelos/${marcaSelect.value}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Error HTTP: ' + response.status);
          }
          return response.json();
        })
        .then(modelos => {
          // Añade los modelos al select
          modelos.forEach(modelo => {
            let option = document.createElement('option');
            option.value = modelo.id;
            option.text = modelo.nombre;
            modeloSelect.appendChild(option);
          });
  
          // Realiza la búsqueda
          buscarProductos();
        })
        .catch(error => {
          console.error('Hubo un problema con la solicitud: ' + error);
        });
    });
});