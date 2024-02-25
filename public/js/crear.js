var datos = {
    "RENAULT": ["R18", "R19", "MEGANE","KANGOO","LOGAN","SANDERO","DUSTER","KWID"],
    "FORD": ["ESCORT", "KA", "FIESTA","FOCUS","ECOSPORT","RANGER","EXPLORER","MONDEO"],
    "CHEVROLET": ["CORSA", "AVEO", "SPARK","CRUZE","ONIX","SAIL","CAPTIVA","TRAILBLAZER"],
    "VOLKSWAGEN": ["GOL", "POLO", "VENTO","SURAN","AMAROK","TIGUAN","TOUAREG","SAVEIRO"],
    "FIAT": ["UNO", "PALIO", "SIENA","STRADA","TORO","MOBI","ARGO","CRONOS"],
    "PEUGEOT": ["206", "207", "208","306","307","308","408","508"],
    "TOYOTA": ["COROLLA", "YARIS", "ETIOS","RAV4","HILUX","SW4","FORTUNER","CAMRY"],
    "NISSAN": ["MARCH", "VERSA", "SENTRA","ALTIMA","KICKS","X-TRAIL","FRONTIER","NP300"],
    "HONDA": ["CIVIC", "ACCORD", "FIT","CR-V","HR-V","PILOT","ODYSSEY","RIDGELINE"],
    "SUZUKI": ["FUN", "SWIFT", "CELERIO","VITARA","JIMNY","GRAND VITARA","SX4","XL7"],
    "MAZDA": ["2", "3", "6","CX-3","CX-5","CX-9","MX-5","BT-50"],
    "KIA": ["PICANTO", "RIO", "CERATO","FORTE","OPTIMA","STINGER","SPORTAGE","SOUL"],
    "HYUNDAI": ["ACCENT", "ELANTRA", "SONATA","TUCSON","SANTA FE","GRAND SANTA FE","GRAND I10","GRAND I30"],
    "MERCEDES BENZ": ["CLASE A", "CLASE B", "CLASE C","CLASE E","CLASE S","GLA","GLC","GLE"],
    "BMW": ["SERIE 1", "SERIE 2", "SERIE 3","SERIE 4","SERIE 5","SERIE 6","SERIE 7","X1"],
    "AUDI": ["A1", "A3", "A4","A5","A6","A7","A8","Q2"],
    "VOLVO": ["S40", "S60", "S80","V40","V60","V90","XC40","XC60"],
    "JEEP": ["COMPASS", "WRANGLER", "GRAND CHEROKEE","RENEGADE","PATRIOT","LIBERTY","COMMANDER","GLADIATOR"],
 
};

// Escucha el evento de cambio en el selector de marca
document.getElementById('marca').addEventListener('change', function() {
    // Obtiene los modelos para la marca seleccionada
    var modelos = datos[this.value];

    // Obtiene el selector de modelo
    var selectModelo = document.getElementById('modelo');

    // Limpia el selector de modelo
    selectModelo.innerHTML = "";

    // Llena el selector de modelo con los modelos de la marca seleccionada
    for (var i = 0; i < modelos.length; i++) {
        var option = document.createElement('option');
        option.value = modelos[i];
        option.text = modelos[i];
        selectModelo.appendChild(option);
    }
});