         // Escucha el evento de cambio en el selector de marca
      document.getElementById('marca').addEventListener('change', function() {
        console.log('Cambio detectado en el selector de marca.');
    
        // Obtiene el ID de la marca seleccionada
        var marcaId = this.value;
    
        // Hace una solicitud AJAX para obtener los modelos para la marca seleccionada
        $.ajax({
            url: '/productos/modelos/' + marcaId, 
            method: 'GET',
            success: function(data) {
                console.log('Modelos para la marca seleccionada:', data);
    
                // Obtiene el selector de modelo
                var selectModelo = document.getElementById('modelo_id'); // Cambiado aquí
    
                // Limpia el selector de modelo
                selectModelo.innerHTML = "";
                console.log('Selector de modelo limpiado.');
    
                // Llena el selector de modelo con los modelos de la marca seleccionada
                for (var i = 0; i < data.length; i++) {
                    var option = document.createElement('option');
                    option.value = data[i].id;
                    option.text = data[i].nombre;
                    selectModelo.appendChild(option);
                    console.log('Agregado modelo al selector:', data[i].nombre);
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error('Error al obtener los modelos:', textStatus, errorThrown);
                alert('Hubo un problema al obtener los modelos para la marca seleccionada. Por favor, inténtalo de nuevo.');
            }
        });
    });
       
    document.addEventListener('DOMContentLoaded', function() {
        // Escucha el evento de cambio en el selector de proveedores
        document.getElementById('proveedores').addEventListener('change', function() {
            // Obtiene los proveedores seleccionados
            var proveedoresSeleccionados = Array.from(this.selectedOptions).map(function(option) {
                return { 
                    id: option.value, 
                    nombre: option.text, 
                    descuento: option.dataset.descuento // Cambiado aquí
                };
            });
    
            // Obtiene el contenedor de precios
            var contenedorPrecios = document.getElementById('precio-lista');
    
            // Para cada proveedor seleccionado, verifica si ya existe un campo de entrada para el precio y el código
            proveedoresSeleccionados.forEach(function(proveedor) {
                // Si no existe un campo de entrada para este proveedor, crea uno
                if (!document.getElementById("precio_" + proveedor.id)) {
                    var divPrecio = document.createElement('div');
                    divPrecio.className = "form-group-crear";
    
                    var labelPrecio = document.createElement('label');
                    labelPrecio.for = "precio_" + proveedor.id;
                    labelPrecio.textContent = "Precio para " + proveedor.nombre + ":";
    
                    var inputPrecio = document.createElement('input');
                    inputPrecio.id = "precio_" + proveedor.id;
                    inputPrecio.className = "form-control";
                    inputPrecio.type = "number";
                    inputPrecio.step = "0.01";
                    inputPrecio.name = "precio_" + proveedor.id;
    
                    // Agrega un campo de entrada oculto para el ID del proveedor
                    var inputProveedorId = document.createElement('input');
                    inputProveedorId.type = "hidden";
                    inputProveedorId.name = "proveedor_id";
                    inputProveedorId.value = proveedor.id;
    
                    divPrecio.appendChild(labelPrecio);
                    divPrecio.appendChild(inputPrecio);
                    divPrecio.appendChild(inputProveedorId); // Agrega el campo de entrada oculto al div
    
                    contenedorPrecios.appendChild(divPrecio);
                }
            
                if (!document.getElementById("codigo_" + proveedor.id)) {
                    var divCodigo = document.createElement('div');
                    divCodigo.className = "form-group-crear";
    
                    var labelCodigo = document.createElement('label');
                    labelCodigo.for = "codigo_" + proveedor.id;
                    labelCodigo.textContent = "Código para " + proveedor.nombre + ":";
    
                    var inputCodigo = document.createElement('input');
                    inputCodigo.id = "codigo_" + proveedor.id;
                    inputCodigo.className = "form-control";
                    inputCodigo.type = "text";
                    inputCodigo.name = "codigo_" + proveedor.id;
    
                    divCodigo.appendChild(labelCodigo);
                    divCodigo.appendChild(inputCodigo);
    
                    contenedorPrecios.appendChild(divCodigo);
                }
            });
        });
    
      // Escucha el evento de cambio en el campo de entrada de utilidad
document.getElementById('utilidad').addEventListener('change', function() {
    // Obtiene el precio de costo y la utilidad
    var precioCosto = parseFloat(document.getElementById('costo').value);
    var utilidad = parseFloat(this.value);

    // Calcula el precio final
    var precio = precioCosto * (1 + utilidad / 100);

    // Muestra el precio final en el campo de entrada de precio
    document.getElementById('precio').value = precio.toFixed(2);
});
    });