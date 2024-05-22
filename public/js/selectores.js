// Obtén los selectores
const categoriaSelector = document.getElementById('categoria_id');
const marcaSelector = document.getElementById('marca_id'); // Cambiado de id_marca a marca_id
const modeloSelector = document.getElementById('modelo_id');

// Agrega un evento de cambio al selector de marca
marcaSelector.addEventListener('change', function() {
  // Obtén el id de la marca seleccionada
  const marcaId = this.value;
  console.log(`Marca seleccionada: ${marcaId}`); // Agrega un console.log aquí

  // Haz una solicitud AJAX para obtener los modelos de esta marca
  fetch(`/modelos/${marcaId}`)
    .then(response => response.json())
    .then(data => {
      console.log('Modelos recibidos:', data); // Agrega un console.log aquí

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

    console.log(`Categoría seleccionada: ${categoriaId}, Marca seleccionada: ${marcaId}, Modelo seleccionado: ${modeloId}`); // Agrega un console.log aquí

    // Haz una solicitud AJAX para obtener los productos que coinciden con los criterios seleccionados
    fetch(`/productos/api/buscar?q=&categoria_id=${categoriaId}&marca_id=${marcaId}&modelo_id=${modeloId}`)
      .then(response => response.json())
      .then(data => {
        console.log('Productos recibidos:', data); // Agrega un console.log aquí

        // Aquí puedes actualizar la interfaz de usuario con los productos obtenidos
        console.log(data);
      });
  });
});