
  // Obtén los selectores
  const categoriaSelector = document.getElementById('categoria_id');
  const marcaSelector = document.getElementById('id_marca');
  const modeloSelector = document.getElementById('modelo_id');

  // Agrega un evento de cambio al selector de marca
  marcaSelector.addEventListener('change', function() {
    // Obtén el id de la marca seleccionada
    const marcaId = this.value;

    // Haz una solicitud AJAX para obtener los modelos de esta marca
    fetch(`/modelos/${marcaId}`)
      .then(response => response.json())
      .then(data => {
        // Limpia el selector de modelos
        modeloSelector.innerHTML = '<option value="" selected>Selecciona un modelo...</option>';

        // Llena el selector de modelos con los nuevos modelos
        data.forEach(modelo => {
          const option = document.createElement('option');
          option.value = modelo.id;
          option.text = modelo.nombre;
          modeloSelector.appendChild(option);
        });
      });
  });

  // Agrega un evento de cambio a los selectores de categoría, marca y modelo
  [categoriaSelector, marcaSelector, modeloSelector].forEach(selector => {
    selector.addEventListener('change', function() {
      // Obtén los valores seleccionados
      const categoriaId = categoriaSelector.value;
      const marcaId = marcaSelector.value;
      const modeloId = modeloSelector.value;

      // Haz una solicitud AJAX para obtener los productos que coinciden con los criterios seleccionados
      fetch(`/api/buscar?categoria_id=${categoriaId}&id_marca=${marcaId}&modelo_id=${modeloId}`)
        .then(response => response.json())
        .then(data => {
          // Aquí puedes actualizar la interfaz de usuario con los productos obtenidos
          console.log(data);
        });
    });
  });