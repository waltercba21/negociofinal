document.getElementById('marca_id').addEventListener('change', function() {
  const marcaId = this.value;
  fetch('/productos/modelos/' + marcaId)
      .then(response => response.json())
      .then(modelos => {
          modelos.sort(function(a, b) {
              return a.nombre.localeCompare(b.nombre);
          });
          const modeloSelect = document.getElementById('modelo_id');
          modeloSelect.innerHTML = '';
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
let productosOriginales = [];
let timer;
const productosPorPagina = 20; // Número de productos a mostrar por página
let paginaActual = 1; // Página inicial

window.onload = async () => {
  const respuesta = await fetch('/productos/api/buscar');
  productosOriginales = await respuesta.json();
  mostrarProductos(productosOriginales.slice(0, 12));
};

// Manejo de la entrada de búsqueda
document.getElementById('entradaBusqueda').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const busqueda = e.target.value;
    const contenedorProductos = document.getElementById('contenedor-productos');
    contenedorProductos.innerHTML = '';
    let productos = [];
    if (!busqueda.trim()) {
      productos = productosOriginales.slice(0, 12);
    } else {
      let url = '/productos/api/buscar?q=' + busqueda;
      const respuesta = await fetch(url);
      productos = await respuesta.json();
    }
    
    mostrarProductos(productos);
  }, 300); 
});

// Función para mostrar productos
function mostrarProductos(productos) {
  const contenedorProductos = document.getElementById('contenedor-productos');
  
  if (productos.length === 0) {
    contenedorProductos.innerHTML = '<p>No se encontraron productos. Refinar la búsqueda.</p>';
    return;
  }

  productos.forEach((producto) => {
    let imagenes = '';
    if (producto.imagenes && producto.imagenes.length > 0) {
      producto.imagenes.forEach((imagenObj, i) => {
        const imagen = imagenObj.imagen;
        imagenes += `<img class="carousel__image ${i !== 0 ? 'hidden' : ''}" src="/uploads/productos/${imagen}" alt="Imagen de ${producto.nombre}">`;
      });
      imagenes = `
        <div class="cover__card">
          <div class="carousel">
            ${imagenes}
          </div>
        </div>
        <div class="carousel__buttons">
          <button class="carousel__button carousel__button--left">
            <i class="fas fa-chevron-left"></i>
          </button>
          <button class="carousel__button carousel__button--right">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      `;
    } else {
      imagenes = '<img src="/ruta/valida/a/imagen/por/defecto.jpg" alt="Imagen no disponible">';
    }

    const precio_venta = producto.precio_venta ? `$${Math.floor(producto.precio_venta).toLocaleString('de-DE')}` : 'Precio no disponible';
    const tarjetaProducto = document.createElement('div');
    tarjetaProducto.classList.add('card');

    if (producto.calidad_original) {
      tarjetaProducto.classList.add('calidad-original-fitam');
    }
    if (producto.calidad_vic) {
      tarjetaProducto.classList.add('calidad_vic');
    }

    const isAdminUser = document.body.dataset.isAdminUser === 'true';
    let html = `
      ${imagenes}
      <div class="titulo-producto">
        <h3 class="nombre">${producto.nombre}</h3>
      </div>
      <hr>
      <div class="precio-producto">
        <p class="precio">${precio_venta}</p>
      </div>
    `;
    
    if (isAdminUser) {
      html += `
        <div class="stock-producto ${producto.stock_actual < producto.stock_minimo ? 'bajo-stock' : 'suficiente-stock'}">
          <p>Stock Disponible: ${producto.stock_actual}</p>
        </div>
      `;
    }
    
    html += `
      <div class="cantidad-producto">
        <a href="/productos/${producto.id}" class="card-link">Ver detalles</a>
      </div>
    `;
    
    tarjetaProducto.innerHTML = html;
    contenedorProductos.appendChild(tarjetaProducto);
    
    // Control de carrusel
    const leftButton = tarjetaProducto.querySelector('.carousel__button--left');
    const rightButton = tarjetaProducto.querySelector('.carousel__button--right');
    const images = tarjetaProducto.querySelectorAll('.carousel__image');
    let currentIndex = 0;

    leftButton.addEventListener('click', () => {
      images[currentIndex].classList.add('hidden');
      currentIndex = (currentIndex === 0) ? images.length - 1 : currentIndex - 1;
      images[currentIndex].classList.remove('hidden');
    });

    rightButton.addEventListener('click', () => {
      images[currentIndex].classList.add('hidden');
      currentIndex = (currentIndex === images.length - 1) ? 0 : currentIndex + 1;
      images[currentIndex].classList.remove('hidden');
    });
  });
}

// Manejo de categorías y marcas
document.addEventListener('DOMContentLoaded', function() {
  const contenedorProductos = document.getElementById('contenedor-productos');
  const categoriaSelect = document.getElementById('categoria_id');
  const marcaSelect = document.getElementById('marca_id');
  const modeloSelect = document.getElementById('modelo_id');

  categoriaSelect.addEventListener('change', realizarBusqueda);
  marcaSelect.addEventListener('change', function() {
    const marcaId = this.value;

    if (marcaId) {
      fetch(`/productos/modelos/${marcaId}`)
        .then(response => response.json())
        .then(modelos => {
          modelos.sort((a, b) => a.nombre.localeCompare(b.nombre));
          modeloSelect.innerHTML = '<option value="">Selecciona un modelo</option>';
          modelos.forEach(modelo => {
            const option = document.createElement('option');
            option.value = modelo.id;
            option.text = modelo.nombre;
            modeloSelect.appendChild(option);
          });
          realizarBusqueda(); // Ejecuta la búsqueda en caso de que ya haya datos seleccionados
        })
        .catch(error => console.error('Error:', error));
    } else {
      modeloSelect.innerHTML = '<option value="">Selecciona un modelo</option>';
      realizarBusqueda(); // Realiza la búsqueda si no hay marca seleccionada
    }
  });

  modeloSelect.addEventListener('change', realizarBusqueda);

  function realizarBusqueda() {
    const categoria_id = categoriaSelect.value;
    const marca_id = marcaSelect.value;
    const modelo_id = modeloSelect.value;

    // Construir la URL con los parámetros y la paginación
    let url = `/productos/api/buscar?limite=${productosPorPagina}&pagina=${paginaActual}&`;
    if (categoria_id) url += `categoria_id=${categoria_id}&`;
    if (marca_id) url += `marca_id=${marca_id}&`;
    if (modelo_id) url += `modelo_id=${modelo_id}`;
    url = url.replace(/&$/, ''); // Remueve '&' extra al final de la URL

    if (categoria_id || marca_id || modelo_id) {
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error('Error en la red');
          return response.json();
        })
        .then(data => {
          const productos = data.productos || [];
          mostrarProductos(productos); // Usar la función para mostrar productos
        })
        .catch(error => console.error('Error:', error));
    } else {
      contenedorProductos.innerHTML = "<p>Seleccione al menos una categoría, marca o modelo para realizar la búsqueda.</p>";
    }
  }
});
