const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'walter',
  password: process.env.DB_PASS || '123456',
  database: process.env.DB_NAME || 'autofaros',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection((error, connection) => {
  if (error) {
    console.error('Error de conexion:', error.message);
  } else {
    console.log('Conexion establecida a la base de datos');
    connection.release();
  }
});

module.exports = pool;
