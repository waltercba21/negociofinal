const mysql = require('mysql');
const conexion = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'productos'
})

conexion.connect (
    (error) => {
        if (!error) {
            console.log('Conexion establecida a la base de datos')
        }else{
            console.log('Error de conexion');
        }
    }
);

module.exports = conexion;