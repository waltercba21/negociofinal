const mysql = require('mysql2');

const pool = mysql.createPool({
  host: '127.0.0.1',
  port: '3306',
  user: 'walter',
  password: '123456',
  database: 'autofaros',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const getConexion = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) {
        reject(error);
      } else {
        resolve(connection.promise()); // Devuelve la conexión con promesas
      }
    });
  });
};

module.exports = { getConexion, pool };