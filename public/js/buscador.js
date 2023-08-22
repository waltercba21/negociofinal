document.addEventListener('DOMContentLoaded', () => {
    const inputBusqueda = document.getElementById('busqueda');
    const resultadosBusqueda = document.getElementById('resultados-busqueda');
  
    inputBusqueda.addEventListener('input', async (e) => {
      const busqueda = e.target.value.trim();
      if (busqueda.length === 0) {
        resultadosBusqueda.innerHTML = '';
        return;
      }
  
      try {
        const response = await fetch(`/api/buscar?query=${busqueda}`);
        const data = await response.json();
  
        if (data.length > 0) {
          resultadosBusqueda.innerHTML = '';
          data.forEach((producto) => {
            resultadosBusqueda.innerHTML += `
              <a href="/productos/${producto.id}" class="resultado-busqueda">
                ${producto.nombre}
              </a>
            `;
          });
        } else {
          resultadosBusqueda.innerHTML = 'No se encontraron resultados.';
        }
      } catch (error) {
        console.error('Error al buscar productos:', error);
      }
    });
  });