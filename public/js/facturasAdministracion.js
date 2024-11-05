document.getElementById('mostrarFormulario').addEventListener('click', function() {
  var formulario = document.getElementById('formularioFacturas');
  var fondoOscuro = document.getElementById('fondoOscuro');
  formulario.style.display = 'block';
  fondoOscuro.style.display = 'block';
});

document.getElementById('cerrarFormulario').addEventListener('click', function() {
  document.getElementById('formularioFacturas').style.display = 'none';
  document.getElementById('fondoOscuro').style.display = 'none';
});

document.getElementById('entradaBusqueda').addEventListener('input', async (e) => {
  const busqueda = e.target.value;
  const resultadosBusqueda = document.getElementById('resultadosBusqueda');
  resultadosBusqueda.innerHTML = '';

  if (!busqueda.trim()) {
      return;
  }

  const url = '/productos/api/buscar?q=' + busqueda;
  const respuesta = await fetch(url);
  const productos = await respuesta.json();

  productos.forEach((producto) => {
      const resultado = document.createElement('div');
      resultado.textContent = producto.nombre;
      resultado.classList.add('resultado-busqueda');
      resultado.addEventListener('click', () => {
          resultadosBusqueda.innerHTML = '';
          const tablaFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0];
          const filaFactura = tablaFactura.insertRow();
          filaFactura.insertCell(0).textContent = producto.codigo;
          filaFactura.insertCell(1).textContent = producto.nombre;

          // Columna de cantidad (input)
          const cellCantidad = filaFactura.insertCell(2);
          const inputCantidad = document.createElement('input');
          inputCantidad.type = 'number';
          inputCantidad.min = 1;
          inputCantidad.value = 1;
          cellCantidad.appendChild(inputCantidad);

          // Columna de eliminar (botón)
          const cellEliminar = filaFactura.insertCell(3);
          const botonEliminar = document.createElement('button');
          botonEliminar.textContent = '✖';
          botonEliminar.className = 'boton-eliminar';
          botonEliminar.addEventListener('click', function () {
              tablaFactura.deleteRow(filaFactura.rowIndex - 1);
          });
          cellEliminar.appendChild(botonEliminar);
      });
      resultadosBusqueda.appendChild(resultado);
  });
});

document.getElementById('formularioFacturas').addEventListener('submit', async function (e) {
    e.preventDefault();
    const invoiceItems = [];
    const filasFactura = document.getElementById('tabla-factura').getElementsByTagName('tbody')[0].rows;
    
    for (let i = 0; i < filasFactura.length; i++) {
        const codigo = filasFactura[i].cells[0].textContent.trim();
        const descripcion = filasFactura[i].cells[1].textContent.trim();
        const cantidad = parseInt(filasFactura[i].cells[2].querySelector('input').value);

        // Verificar que los campos no estén vacíos o mal formados
        if (codigo && descripcion && !isNaN(cantidad)) {
            invoiceItems.push({
                id: codigo, // Asegúrate de que `codigo` sea el identificador del producto.
                descripcion: descripcion,
                cantidad: cantidad
            });
        }
    }

    // Log para verificar el contenido de `invoiceItems`
    console.log("Contenido de invoiceItems antes de enviar:", invoiceItems);

    const formData = new FormData(this);
    formData.append('invoiceItems', JSON.stringify(invoiceItems));
    
    try {
        const response = await fetch('/administracion/facturas', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        // Log para verificar la respuesta del servidor
        console.log("Respuesta del servidor:", data);
        
        if (response.ok) {
            Swal.fire({
                title: '¡Éxito!',
                text: data.message,
                icon: 'success',
                confirmButtonText: 'Entendido'
            }).then(() => {
                window.location.reload(); 
            });
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error("Error al enviar el formulario:", error);
        Swal.fire({
            title: 'Error',
            text: error.message || 'Hubo un problema al procesar la solicitud',
            icon: 'error',
            confirmButtonText: 'Reintentar'
        });
    }
});
