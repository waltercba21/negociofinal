const conexion = require('../config/conexion');

module.exports = {
  // Crear un carrito nuevo para un usuario
  crearCarrito: function(usuario_id, callback) {
    const query = 'INSERT INTO carritos (usuario_id) VALUES (?)';
    conexion.query(query, [usuario_id], function (error, resultados) {
      if (error) {
        console.error('❌ Error al crear el carrito:', error);
        return callback(error, null);
      }
      console.log('🛒 Carrito creado con ID:', resultados.insertId);
      return callback(null, resultados.insertId); // Retorna el ID del carrito creado
    });
  },

  // Obtener el carrito activo de un usuario
  obtenerCarritoActivo: function(usuario_id, callback) {
    const query = 'SELECT * FROM carritos WHERE usuario_id = ?';
    conexion.query(query, [usuario_id], function (error, resultados) {
      if (error) {
        console.error('❌ Error al obtener el carrito activo:', error);
        return callback(error, null);
      }
      if (resultados.length === 0) {
        console.log('ℹ️ No se encontró un carrito activo para el usuario:', usuario_id);
        return callback(null, null);
      }
      console.log('✅ Carrito activo encontrado:', resultados[0]);
      return callback(null, resultados[0]);
    });
  },

  // Obtener los productos dentro del carrito
  obtenerProductosCarrito: function(carrito_id, callback) {
    const query = `
      SELECT p.nombre, pc.cantidad, (pc.cantidad * p.precio) AS total
      FROM productos_carrito pc
      JOIN productos p ON pc.producto_id = p.id
      WHERE pc.carrito_id = ?`;
    conexion.query(query, [carrito_id], function (error, resultados) {
      if (error) {
        console.error('❌ Error al obtener productos del carrito:', error);
        return callback(error, null);
      }
      console.log('📦 Productos en el carrito:', resultados);
      return callback(null, resultados);
    });
  },

  // Agregar un producto al carrito (actualiza si ya existe)
  agregarProductoCarrito: function(carrito_id, producto_id, cantidad, callback) {
    // Verificar si el producto ya está en el carrito
    const verificarQuery = 'SELECT * FROM productos_carrito WHERE carrito_id = ? AND producto_id = ?';
    conexion.query(verificarQuery, [carrito_id, producto_id], function (error, resultados) {
      if (error) {
        console.error('❌ Error al verificar producto en el carrito:', error);
        return callback(error, null);
      }

      if (resultados.length > 0) {
        // Si el producto ya está, actualizar la cantidad
        const nuevaCantidad = resultados[0].cantidad + cantidad;
        const actualizarQuery = 'UPDATE productos_carrito SET cantidad = ? WHERE carrito_id = ? AND producto_id = ?';
        conexion.query(actualizarQuery, [nuevaCantidad, carrito_id, producto_id], function (error) {
          if (error) {
            console.error('❌ Error al actualizar cantidad del producto en el carrito:', error);
            return callback(error, null);
          }
          console.log('🔄 Cantidad actualizada del producto:', producto_id);
          return callback(null, resultados[0].id);
        });
      } else {
        // Si no está, insertarlo
        const insertarQuery = 'INSERT INTO productos_carrito (carrito_id, producto_id, cantidad) VALUES (?, ?, ?)';
        conexion.query(insertarQuery, [carrito_id, producto_id, cantidad], function (error, resultados) {
          if (error) {
            console.error('❌ Error al agregar producto al carrito:', error);
            return callback(error, null);
          }
          console.log('🛍️ Producto agregado al carrito con ID:', resultados.insertId);
          return callback(null, resultados.insertId);
        });
      }
    });
  },

  // Finalizar compra (puede marcar el carrito como completado si lo deseas)
  finalizarCompra: function(carrito_id, callback) {
    const query = 'UPDATE carritos SET actualizado_en = CURRENT_TIMESTAMP WHERE id = ?';
    conexion.query(query, [carrito_id], function (error, resultados) {
      if (error) {
        console.error('❌ Error al finalizar el carrito:', error);
        return callback(error, null);
      }
      console.log('✅ Compra finalizada para el carrito ID:', carrito_id);
      return callback(null, resultados);
    });
  },
};
