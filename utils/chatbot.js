const db = require('../config/conexion');

async function buscarProductoPorNombre(texto) {
  return new Promise((resolve) => {
    console.log("🧠 Texto recibido para búsqueda:", texto); // NUEVO LOG

    const palabras = texto
      .toLowerCase()
      .split(' ')
      .filter(p => p.length > 1);

    if (palabras.length === 0) {
      console.log("⚠️ No hay palabras válidas");
      return resolve("⚠️ Por favor escribí el nombre del producto que buscás.");
    }

    const condiciones = palabras.map(() => `LOWER(nombre) LIKE ?`).join(' AND ');
    const valores = palabras.map(p => `%${p}%`);

    console.log("🔍 Condiciones SQL:", condiciones);
    console.log("🔍 Valores SQL:", valores);

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
        console.log("🔍 No se encontraron coincidencias");
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
