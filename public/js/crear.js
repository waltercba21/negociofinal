//OBTENER LOS MODELOS POR MARCA 
$('#marca').change(function() {
    var marcaSeleccionada = $(this).val();
    $('#modelo_id').empty();
    $('#modelo_id').append('<option value="">Selecciona un modelo...</option>');
    modelos.forEach(function(modelo) {
        if (modelo.marca_id == marcaSeleccionada) {
            $('#modelo_id').append('<option value="' + modelo.id + '">' + modelo.nombre + '</option>');
        }
    });
});