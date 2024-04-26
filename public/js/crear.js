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
       
       
    // Escucha el evento de cambio en el selector de proveedores
document.getElementById('proveedores').addEventListener('change', function() {
    // Obtiene los proveedores seleccionados
    var proveedoresSeleccionados = Array.from(this.selectedOptions).map(function(option) {
        return { id: option.value, nombre: option.text };
    });

    // Obtiene el contenedor de precios
    var contenedorPrecios = document.getElementById('precios');

    // Para cada proveedor seleccionado, verifica si ya existe un campo de entrada para el precio
    proveedoresSeleccionados.forEach(function(proveedor) {
        // Si no existe un campo de entrada para este proveedor, crea uno
        if (!document.getElementById("precio_" + proveedor.id)) {
            var div = document.createElement('div');
            div.className = "form-group-crear";

            var label = document.createElement('label');
            label.for = "precio_" + proveedor.id;
            label.textContent = "Precio para " + proveedor.nombre + ":";

            var input = document.createElement('input');
            input.id = "precio_" + proveedor.id;
            input.className = "form-control";
            input.type = "number";
            input.step = "0.01";
            input.name = "precio_" + proveedor.id;

            div.appendChild(label);
            div.appendChild(input);

            contenedorPrecios.appendChild(div);
        }
    });
});