const mysql = require('mysql2');
const conexion = mysql.createConnection({
    host: '127.0.0.1', 
    port:'3306',
    user: 'walter',
    password: '123456',
    database: 'autofaros'
});

conexion.connect((error) => {
    if (!error) {
        console.log('Conexion establecida a la base de datos');
    } else {
        console.error('Error de conexion:', error);
    }
});

module.exports = conexion;
