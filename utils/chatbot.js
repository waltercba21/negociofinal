const db = require('../config/conexion');

async function buscarProductoPorNombre(texto) {
  return new Promise((resolve) => {
    const sql = `
      SELECT id, nombre, precio_venta 
      FROM productos 
      WHERE nombre LIKE ? 
      LIMIT 3
    `;
    const clave = `%${texto}%`;
    db.query(sql, [clave], (err, resultados) => {
      if (err || resultados.length === 0) {
        return resolve("🔍 No encontré ese producto. ¿Podés ser más específico?");
      }

      const respuesta = resultados.map(p => (
        `📦 ${p.nombre}\n💲$${p.precio_venta}\n🔗 https://www.autofaros.com.ar/productos/${p.id}`
      )).join('\n\n');

      resolve(respuesta);
    });
  });
}

module.exports = { buscarProductoPorNombre };
