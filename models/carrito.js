const conexion = require('../config/conexion');

module.exports = {
  // Crear un carrito nuevo para un usuario
  crearCarrito: function(id_usuario, callback) {
    const query = 'INSERT INTO carritos (id_usuario) VALUES (?)';
    conexion.query(query, [id_usuario], function (error, resultados) {
      if (error) {
        return callback(error, null);
      }
      return callback(null, resultados.insertId); // Retorna el ID del carrito creado
    });
  },

  // Obtener el carrito activo de un usuario
  obtenerCarritoActivo: function(id_usuario, callback) {
    const query = 'SELECT * FROM carritos WHERE id_usuario = ?';
    conexion.query(query, [id_usuario], function (error, resultados) {
      if (error) {
        return callback(error, null);
      }
      return callback(null, resultados);
    });
  },

  // Obtener los productos dentro del carrito
  obtenerProductosCarrito: function(id_carritos, callback) {
    const query = `
      SELECT p.nombre, pc.cantidad, pc.precio, (pc.cantidad * pc.precio) AS total
      FROM productos_carrito pc
      JOIN productos p ON pc.id_producto = p.id
      WHERE pc.id_carritos = ?`;
    conexion.query(query, [id_carritos], function (error, resultados) {
      if (error) {
        return callback(error, null);
      }
      return callback(null, resultados);
    });
  },

  // Agregar un producto al carrito
  agregarProductoCarrito: function(id_carritos, id_producto, cantidad, precio, callback) {
    const query = 'INSERT INTO productos_carrito (id_carritos, id_producto, cantidad, precio) VALUES (?, ?, ?, ?)';
    conexion.query(query, [id_carritos, id_producto, cantidad, precio], function (error, resultados) {
      if (error) {
        return callback(error, null);
      }
      return callback(null, resultados.insertId); // Retorna el ID del producto agregado al carrito
    });
  },

  // Finalizar compra (cambiar estado del carrito)
  finalizarCompra: function(id_carritos, callback) {
    const query = 'UPDATE carritos SET estado = "finalizado" WHERE id = ?';
    conexion.query(query, [id_carritos], function (error, resultados) {
      if (error) {
        return callback(error, null);
      }
      return callback(null, resultados);
    });
  }
};
