document.getElementById('marca_id').addEventListener('change', function() {
  const marcaId = this.value;
  fetch('/productos/modelos/' + marcaId)
      .then(response => response.json())
      .then(modelos => {
          const modeloSelect = document.getElementById('modelo_id');
          modeloSelect.innerHTML = '';

          // Agrega la opción "Selecciona un modelo"
          const defaultOption = document.createElement('option');
          defaultOption.value = '';
          defaultOption.text = 'Selecciona un modelo';
          modeloSelect.appendChild(defaultOption);

          modelos.forEach(modelo => {
              const option = document.createElement('option');
              option.value = modelo.id;
              option.text = modelo.nombre;
              modeloSelect.appendChild(option);
          });
      })
      .catch(error => console.error('Error:', error));
});

const categoriaSelect = document.getElementById('categoria_id');
const marcaSelect = document.getElementById('marca_id');
const modeloSelect = document.getElementById('modelo_id');

// Función para actualizar los productos
function actualizarProductos() {
  const categoria = categoriaSelect.value;
  const marca = marcaSelect.value;
  const modelo = modeloSelect.value;

  // Construye la URL con los parámetros de consulta
  let url = '/productos?';
  if (categoria) url += 'categoria=' + categoria + '&';
  if (marca) url += 'marca=' + marca + '&';
  if (modelo) url += 'modelo=' + modelo;

  fetch(url)
    .then(response => response.text())
    .then(html => {
      document.getElementById('contenedor-productos').innerHTML = html;
    })
    .catch(error => console.error('Error:', error));
}
categoriaSelect.addEventListener('change', actualizarProductos);
marcaSelect.addEventListener('change', actualizarProductos);
modeloSelect.addEventListener('change', actualizarProductos);