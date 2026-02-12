// scripts/db_check_facturas.js
require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "walter",
    password: process.env.DB_PASS || "123456",
    database: process.env.DB_NAME || "autofaros",
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });

  const [rows] = await pool.query(`
    SELECT fm.id, fm.fecha, fm.total, COUNT(fi.id) AS items
    FROM facturas_mostrador fm
    JOIN factura_items fi ON fi.factura_id = fm.id
    GROUP BY fm.id
    ORDER BY fm.id DESC
    LIMIT 10;
  `);

  console.table(rows);
  await pool.end();
})().catch((e) => {
  console.error("DB error:", e.message);
  process.exit(1);
});
