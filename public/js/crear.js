var datos = {
    "CHEVROLET": ["CORSA","CLASSIC","CELTA/FUN", "AVEO", "SPARK","CRUZE","ONIX","SAIL","CAPTIVA","TRAILBLAZER"],
    "CITROEN": ["C1", "C3", "C4","C5","C6","C8","BERLINGO","XSARA"],
    "FIAT": ["UNO", "PALIO", "SIENA","STRADA","TORO","MOBI","ARGO","CRONOS","REGATTA","SPAZIO","SUPER EUROPA"],
    "FORD": ["FALCON","F-100","ESCORT", "KA", "FIESTA","FOCUS","ECOSPORT","RANGER","EXPLORER","MONDEO"],
    "MERCEDES BENZ": ["CLASE A", "CLASE B", "CLASE C","CLASE E","CLASE S","GLA","GLC","GLE"],
    "PEUGEOT": ["206", "207", "208","306","307","308","408","508"],
    "RENAULT": ["R9","R18", "R19", "MEGANE","KANGOO","LOGAN","SANDERO","TRAFIC","DUSTER","KWID"],
    "TOYOTA": ["COROLLA", "YARIS", "ETIOS","RAV4","HILUX","SW4","FORTUNER","CAMRY"],
    "VOLKSWAGEN": ["GOL", "POLO", "VENTO","SURAN","AMAROK","TIGUAN","TOUAREG","SAVEIRO"],
    "NISSAN": ["MARCH", "VERSA", "SENTRA","ALTIMA","KICKS","X-TRAIL","FRONTIER","NP300"],
    "UNIVERSAL": ["VM1", "VM2", "VM3","VM4","VM5","VM6","VM7","VM8"],
    "LED": ["FAROS TRASEROS","FAROS DELANTEROS","BALIZAS","LAMPARAS","OPTICAS","PLAFON INTERIOR","AUXILIARES"]
};
// Escucha el evento de cambio en el selector de marca
document.getElementById('marca').addEventListener('change', function() {
    console.log('Cambio detectado en el selector de marca.');

    // Obtiene los modelos para la marca seleccionada
    var modelos = datos[this.value];
    console.log('Modelos para la marca seleccionada:', modelos);

    // Obtiene el selector de modelo
    var selectModelo = document.getElementById('modelo');

    // Limpia el selector de modelo
    selectModelo.innerHTML = "";
    console.log('Selector de modelo limpiado.');

    // Llena el selector de modelo con los modelos de la marca seleccionada
    for (var i = 0; i < modelos.length; i++) {
        var option = document.createElement('option');
        option.value = modelos[i];
        option.text = modelos[i];
        selectModelo.appendChild(option);
        console.log('Agregado modelo al selector:', modelos[i]);
    }
});