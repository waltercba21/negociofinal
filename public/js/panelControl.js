document.getElementById('check-all').addEventListener('change', function() {
    var checks = document.querySelectorAll('.product-check');
    for (var i = 0; i < checks.length; i++) {
        checks[i].checked = this.checked;
    }
});
document.getElementById('delete-selected').addEventListener('click', function() {
    var checks = document.querySelectorAll('.product-check');
    var ids = [];
    for (var i = 0; i < checks.length; i++) {
        if (checks[i].checked) {
            ids.push(checks[i].value);
        }
    }
    fetch('/productos/eliminarSeleccionados', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: ids }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            location.reload();
        } else {
            console.error('Error al eliminar los productos:', data.error);
        }
    })
    .catch((error) => {
        console.error('Error:', error);
    });
});
let editUrl = `editar.ejs?paginaActual=${paginaActual}`;
window.location.href = editUrl;