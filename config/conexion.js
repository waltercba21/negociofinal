const mysql = require('mysql2');

const pool = mysql.createPool({
    host: '127.0.0.1', 
    port:'3306',
    user: 'walter',
    password: '123456',
    database: 'autofaros',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((error, connection) => {
    if (error) {
        console.error('Error de conexion:', error);
    } else {
        connection.release();
    }
});

module.exports = pool;
