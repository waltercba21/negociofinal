const pool = require('../config/conexion'); // Se asume que tienes el pool configurado en 'conexion.js'

module.exports = {
  // Crear un carrito nuevo para un usuario
  crearCarrito: function(usuario_id, callback) {
    const query = 'INSERT INTO carritos (usuario_id) VALUES (?)';
    pool.query(query, [usuario_id])
      .then(resultados => {
        console.log('🛒 Carrito creado con ID:', resultados[0].insertId);
        callback(null, resultados[0].insertId); // Retorna el ID del carrito creado
      })
      .catch(error => {
        console.error('❌ Error al crear el carrito:', error);
        callback(error, null);
      });
  },

  // Obtener el carrito activo de un usuario
  obtenerCarritoActivo: function(usuario_id, callback) {
    const query = 'SELECT * FROM carritos WHERE usuario_id = ?';
    pool.query(query, [usuario_id])
      .then(resultados => {
        if (resultados.length === 0) {
          console.log('ℹ️ No se encontró un carrito activo para el usuario:', usuario_id);
          return callback(null, null);
        }
        console.log('✅ Carrito activo encontrado:', resultados[0]);
        callback(null, resultados[0]);
      })
      .catch(error => {
        console.error('❌ Error al obtener el carrito activo:', error);
        callback(error, null);
      });
  },

  // Obtener los productos dentro del carrito
  obtenerProductosCarrito: function(carrito_id, callback) {
    const query = `
      SELECT p.nombre, pc.cantidad, (pc.cantidad * p.precio) AS total
      FROM productos_carrito pc
      JOIN productos p ON pc.producto_id = p.id
      WHERE pc.carrito_id = ?`;
    pool.query(query, [carrito_id])
      .then(resultados => {
        console.log('📦 Productos en el carrito:', resultados);
        callback(null, resultados);
      })
      .catch(error => {
        console.error('❌ Error al obtener productos del carrito:', error);
        callback(error, null);
      });
  },

  // Agregar un producto al carrito (actualiza si ya existe)
  agregarProductoCarrito: function(carrito_id, producto_id, cantidad, callback) {
    // Verificar si el producto ya está en el carrito
    const verificarQuery = 'SELECT * FROM productos_carrito WHERE carrito_id = ? AND producto_id = ?';
    pool.query(verificarQuery, [carrito_id, producto_id])
      .then(resultados => {
        if (resultados.length > 0) {
          // Si el producto ya está, actualizar la cantidad
          const nuevaCantidad = resultados[0].cantidad + cantidad;
          const actualizarQuery = 'UPDATE productos_carrito SET cantidad = ? WHERE carrito_id = ? AND producto_id = ?';
          pool.query(actualizarQuery, [nuevaCantidad, carrito_id, producto_id])
            .then(() => {
              console.log('🔄 Cantidad actualizada del producto:', producto_id);
              callback(null, resultados[0].id);
            })
            .catch(error => {
              console.error('❌ Error al actualizar cantidad del producto en el carrito:', error);
              callback(error, null);
            });
        } else {
          // Si no está, insertarlo
          const insertarQuery = 'INSERT INTO productos_carrito (carrito_id, producto_id, cantidad) VALUES (?, ?, ?)';
          pool.query(insertarQuery, [carrito_id, producto_id, cantidad])
            .then(resultados => {
              console.log('🛍️ Producto agregado al carrito con ID:', resultados[0].insertId);
              callback(null, resultados[0].insertId);
            })
            .catch(error => {
              console.error('❌ Error al agregar producto al carrito:', error);
              callback(error, null);
            });
        }
      })
      .catch(error => {
        console.error('❌ Error al verificar producto en el carrito:', error);
        callback(error, null);
      });
  },

  // Finalizar compra (puede marcar el carrito como completado si lo deseas)
  finalizarCompra: function(carrito_id, callback) {
    const query = 'UPDATE carritos SET actualizado_en = CURRENT_TIMESTAMP WHERE id = ?';
    pool.query(query, [carrito_id])
      .then(resultados => {
        console.log('✅ Compra finalizada para el carrito ID:', carrito_id);
        callback(null, resultados);
      })
      .catch(error => {
        console.error('❌ Error al finalizar el carrito:', error);
        callback(error, null);
      });
  },
};
