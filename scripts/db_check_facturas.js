// scripts/db_check_facturas.js
require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 5,
  });

  const [rows] = await pool.query(`
    SELECT fm.id, fm.fecha, fm.total, COUNT(fi.id) AS items
    FROM facturas_mostrador fm
    JOIN factura_items fi ON fi.factura_id = fm.id
    GROUP BY fm.id
    ORDER BY fm.id DESC
    LIMIT 10
  `);

  console.table(rows);
  await pool.end();
})().catch((e) => {
  console.error("DB error:", e.message);
  process.exit(1);
});
