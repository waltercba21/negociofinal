const mysql = require('mysql2');
require('dotenv').config();

const requiredEnvVars = ['DB_USER', 'DB_PASS', 'DB_NAME'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`❌ Variable de entorno faltante: ${key}`);
  }
}

const pool = mysql.createPool({
  host:               process.env.DB_HOST || '127.0.0.1',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASS,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           'local',
});

// Verificación al arrancar
pool.getConnection((error, connection) => {
  if (error) {
    console.error('❌ Error de conexión:', error.message);
    process.exit(1);
  }
  console.log('✅ Conexión establecida a la base de datos');
  connection.release();
});

// Manejo de errores inesperados en el pool
pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool MySQL:', err.message);
});

// ⚠️ Exportamos el pool RAW (con callbacks)
// para mantener compatibilidad con todos los modelos actuales
module.exports = pool;