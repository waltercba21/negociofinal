const db = require('../config/conexion');

async function buscarProductoPorNombre(texto) {
  return new Promise((resolve) => {
    const entrada = texto.toLowerCase().trim();

    // 🟢 Detectar saludos simples
    const saludos = ['hola', 'buenas', 'buen dia', 'buenas tardes', 'buenas noches', 'saludos'];
    if (saludos.some(s => entrada.includes(s))) {
      return resolve(
        `👋 ¡Hola! Bienvenido a *Autofaros*.\n\nPodés enviarnos el nombre o una descripción del repuesto que necesitás (por ejemplo: _faro agile trasero 2012_ o _óptica renault kangoo izquierda_).\n\n🔎 Te voy a mostrar los productos más similares automáticamente.\n\nSi no encontrás lo que buscás, también podés escribir *"humano"* para que un asesor te atienda directamente.`
      );
    }

    // 🔍 Búsqueda de palabras clave
    const palabras = entrada
      .split(' ')
      .filter(p => p.length > 1);

    if (palabras.length === 0) {
      return resolve("⚠️ Por favor escribí el nombre del producto que buscás.");
    }

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
        return resolve("❌ Hubo un error buscando el producto. Intentá de nuevo más tarde.");
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
