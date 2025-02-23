document.addEventListener("DOMContentLoaded", function() {
    const tipoEnvioRadios = document.querySelectorAll("input[name='tipo-envio']");
    const datosDelivery = document.getElementById("datos-delivery");
    
    tipoEnvioRadios.forEach(radio => {
        radio.addEventListener("change", function() {
            if (this.value === "delivery") {
                datosDelivery.classList.remove("hidden");
            } else {
                datosDelivery.classList.add("hidden");
            }
        });
    });
});
