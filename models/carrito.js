const pool = require('../config/conexion');

module.exports = {
    obtenerCarritoActivo: (usuario_id, callback) => {
        const query = 'SELECT * FROM carritos WHERE usuario_id = ?';
        pool.query(query, [usuario_id], (error, resultados) => {
            if (error) {
                return callback(error);
            }
            callback(null, resultados);
        });
    },

    crearCarrito: (usuario_id, callback) => {
        const query = 'INSERT INTO carritos (usuario_id) VALUES (?)';
        pool.query(query, [usuario_id], (error, resultados) => {
            if (error) {
                return callback(error);
            }
            callback(null, resultados.insertId);
        });
    },
    agregarProductoCarrito: (id_carrito, id_producto, cantidad, callback) => {
      // Primero obtenemos el precio del producto
      const queryPrecio = 'SELECT precio_venta FROM productos WHERE id = ?';
      
      pool.query(queryPrecio, [id_producto], (error, resultados) => {
          if (error) {
              return callback(error);
          }
          // Verificamos si encontramos el precio
          if (resultados.length > 0) {
              const precio = resultados[0].precio_venta;  // Precio obtenido del producto
              // Ahora agregamos el producto al carrito con el precio
              const query = 'INSERT INTO productos_carrito (carrito_id, producto_id, cantidad, precio) VALUES (?, ?, ?, ?)';
              pool.query(query, [id_carrito, id_producto, cantidad, precio], (error, resultados) => {
                  if (error) {
                      return callback(error);
                  }
                  callback(null, resultados);
              });
          } else {
              // Si no se encuentra el producto, regresamos un error
              callback(new Error('Producto no encontrado'));
          }
      });
  },
  obtenerProductosCarrito: (id_carrito, callback) => {
    const query = `
        SELECT p.nombre, pc.cantidad, (pc.cantidad * p.precio_venta) AS total
        FROM productos_carrito pc
        JOIN productos p ON pc.producto_id = p.id
        WHERE pc.carrito_id = ?`;
    
    pool.query(query, [id_carrito], (error, resultados) => {
        if (error) {
            return callback(error);
        }
        callback(null, resultados);
    });
},


    finalizarCompra: (id_carrito, callback) => {
        const query = 'UPDATE carritos SET actualizado_en = CURRENT_TIMESTAMP WHERE id = ?';
        pool.query(query, [id_carrito], (error, resultados) => {
            if (error) {
                return callback(error);
            }
            callback(null, resultados);
        });
    },
};
