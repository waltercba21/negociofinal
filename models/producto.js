module.exports ={
    obtener : function(conexion,funcion){
        conexion.query('SELECT * FROM productos',funcion);
    },
    insertar: function(conexion, datos, archivos, funcion){
      if (!archivos || archivos.length === 0) {
        // manejar el error aquí, por ejemplo, puedes llamar a la función de callback con un error
        return funcion(new Error('No se proporcionó un archivo'));
      }
      conexion.query
      ('INSERT INTO productos (nombre,codigo,descripcion,proveedor,precio,categoria) VALUES (?,?,?,?,?,?)',
      [datos.nombre,datos.codigo,datos.descripcion,datos.proveedor,datos.precio,datos.categoria], (error, resultados) => {
        if (error) {
          return funcion(error);
        }
        const productoId = resultados.insertId;
        const imagenes = archivos.map(archivo => [productoId, archivo.filename]);
        conexion.query('INSERT INTO imagenes_producto (producto_id, imagen) VALUES ?', [imagenes], funcion);
      });
    },
    retornarDatosId: function (conexion,id,funcion){
        conexion.query('SELECT * FROM productos WHERE id = ? ',[id],funcion);
    },
    borrar: function (conexion,id,funcion){ 
        conexion.query('DELETE FROM productos WHERE id=?', [id],funcion)
    },
    actualizar: function (conexion, datos, archivos, funcion) {
      conexion.query("UPDATE productos SET nombre=?,codigo=?, descripcion=?, precio=?, proveedor=?, categoria=? WHERE id=?",
      [datos.nombre,datos.codigo,datos.descripcion,datos.precio,datos.proveedor,datos.categoria, datos.id], (error, resultados) => {
        if (error) {
          return funcion(error);
        }
        const productoId = datos.id;
        conexion.query('DELETE FROM imagenes_producto WHERE producto_id = ?', [productoId], (error, resultados) => {
          if (error) {
            return funcion(error);
          }
          const imagenes = archivos.map(archivo => [productoId, archivo.filename]);
          conexion.query('INSERT INTO imagenes_producto (producto_id, imagen) VALUES ?', [imagenes], funcion);
        });
      });
    },  
    actualizarArchivo: function(conexion,datos,archivo,funcion){
        
        conexion.query('UPDATE productos SET imagen=? WHERE id =?',[archivo.filename, datos.id ],funcion);
    },
    // Insertar una nueva imagen de producto
insertarImagen: function(conexion, productoId, imagen, callback) {
  const query = 'INSERT INTO imagenes_producto (producto_id, ruta_imagen) VALUES (?, ?)';
  conexion.query(query, [productoId, imagen], callback);
},

// Obtener todas las imágenes de un producto
obtenerImagenes: function(conexion, productoId, callback) {
  const query = 'SELECT * FROM imagenes_producto WHERE producto_id = ?';
  conexion.query(query, [productoId], callback);
},

// Borrar todas las imágenes de un producto
borrarImagenes: function(conexion, productoId, callback) {
  const query = 'DELETE FROM imagenes_producto WHERE producto_id = ?';
  conexion.query(query, [productoId], callback);
},
    obtenerPorCategoria: function (conexion, categoria, funcion) {
      conexion.query('SELECT * FROM productos WHERE categoria = ?', [categoria], funcion);
  },
    obtenerPorNombre: function (conexion, nombre, funcion) {
        conexion.query('SELECT * FROM productos WHERE nombre LIKE ?', [`%${nombre}%`], funcion);
      },
      obtenerCarrito: function (conexion, usuarioId, funcion) {
        const query = `
            SELECT carritos.*, productos.nombre AS nombre
            FROM carritos 
            JOIN productos ON carritos.producto_id = producto.id 
            WHERE carritos.usuario_id = ?
        `;
        conexion.query(query, [usuarioId], funcion);
    },
      obtenerTodos: function (conexion, funcion) {
        conexion.query('SELECT * FROM productos', funcion);
    },
      agregarAlCarrito: function (usuarioId, productoId, cantidad, imagen, callback) {
        const query = "INSERT INTO carritos (usuario_id, producto_id, cantidad, imagen) VALUES ( ?, ?, ?, ?)";
        const values = [usuarioId, productoId, cantidad, imagen];
      
        conexion.query(query, values, function (error, resultados) {
          if (error) {
            return callback(error, null);
          }
      
          return callback(null, resultados);
        });
      },
    
      eliminarDelCarrito: function (usuarioId, productoId, callback) {
        const query = "DELETE FROM carritos WHERE usuario_id = ? AND producto_id = ?";
        const values = [usuarioId, productoId];
    
        conexion.query(query, values, function (error, resultados) {
          if (error) {
            return callback(error, null);
          }
    
          return callback(null, resultados);
        });
      },
      obtenerProductosPorProveedor: function (conexion, proveedor, callback) {
        const query = 'SELECT * FROM productos WHERE proveedor = ?';
        conexion.query(query, [proveedor], function (error, resultados) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, resultados);
            }
        });
    },
    actualizarPreciosPorProveedor: function (conexion, proveedor, porcentajeAumento, callback) {
      const query = 'UPDATE productos SET precio = precio + precio * ? WHERE proveedor = ?';
      conexion.query(query, [porcentajeAumento, proveedor], function (error, resultados) {
          if (error) {
              callback(error, null);
          } else {
              callback(null, resultados);
          }
      });
  },
  obtenerImagenes: function (conexion, productoId, funcion) {
    const query = 'SELECT * FROM imagenes WHERE producto_id = ?';
    conexion.query(query, [productoId], function (error, resultados) {
        if (error) {
            funcion(error, null);
        } else {
            funcion(null, resultados);
        }
    });
}
}