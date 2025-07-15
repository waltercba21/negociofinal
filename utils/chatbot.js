const db = require('../config/conexion');

async function buscarProductoPorNombre(texto) {
  return new Promise((resolve) => {
    const palabras = texto
      .toLowerCase()
      .split(' ')
      .filter(p => p.length > 1); // elimina espacios vacíos y palabras cortas

    if (palabras.length === 0) {
      return resolve("⚠️ Por favor escribí el nombre del producto que buscás.");
    }

    // Arma condiciones: nombre LIKE '%faro%' AND nombre LIKE '%agile%' ...
    const condiciones = palabras.map(() => `LOWER(nombre) LIKE ?`).join(' AND ');
    const valores = palabras.map(p => `%${p}%`);

    const sql = `
      SELECT id, nombre, precio_venta 
      FROM productos 
      WHERE ${condiciones}
      LIMIT 3
    `;

    db.query(sql, valores, (err, resultados) => {
      if (err) {
        console.error("❌ Error en consulta:", err);
        return resolve("❌ Error buscando el producto. Intentá más tarde.");
      }

      if (resultados.length === 0) {
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
