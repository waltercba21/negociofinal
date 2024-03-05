module.exports ={
  obtener: function (conexion, saltar, funcion) {
    if (typeof funcion !== 'function') {
      throw new Error('funcion debe ser una función');
    }
    conexion.query('SELECT * FROM productos LIMIT ?,20', [saltar], funcion);
  },
  contar: function (conexion, funcion) {
    if (typeof funcion !== 'function') {
      throw new Error('funcion debe ser una función');
    }
    conexion.query('SELECT COUNT(*) AS total FROM productos', funcion);
  },
  contarPorProveedor: function (conexion, proveedor, funcion) {
    if (typeof funcion !== 'function') {
        throw new Error('funcion debe ser una función');
    }
    conexion.query('SELECT COUNT(*) AS total FROM productos WHERE proveedor = ?', [proveedor], funcion);
},
insertar: function(conexion, datos, archivo, funcion){
  if (!archivo) {
    // manejar el error aquí, por ejemplo, puedes llamar a la función de callback con un error
    return funcion(new Error('No se proporcionó un archivo'));
  }
  
  // Primero, obtenemos el ID de la categoría
  conexion.query('SELECT id FROM categorias WHERE nombre = ?', [datos.categoria], (error, resultados) => {
    if (error) {
      return funcion(error);
    }

    // Comprobamos si la consulta devolvió al menos un resultado
    if (resultados.length === 0) {
      return funcion(new Error('No se encontró ninguna categoría con el nombre proporcionado'));
    }

    // Usamos el ID de la categoría en la consulta de inserción
    const categoria_id = resultados[0].id;

    // Luego, obtenemos el ID de la marca
    conexion.query('SELECT id FROM marcas WHERE nombre = ?', [datos.marca], (error, resultados) => {
      if (error) {
        return funcion(error);
      }

      // Comprobamos si la consulta devolvió al menos un resultado
      if (resultados.length === 0) {
        return funcion(new Error('No se encontró ninguna marca con el nombre proporcionado'));
      }

      // Usamos el ID de la marca en la consulta de inserción
      const marca_id = resultados[0].id;

      // Finalmente, obtenemos el ID del proveedor
      conexion.query('SELECT id FROM proveedores WHERE nombre = ?', [datos.proveedor], (error, resultados) => {
        if (error) {
          return funcion(error);
        }

        // Comprobamos si la consulta devolvió al menos un resultado
        if (resultados.length === 0) {
          return funcion(new Error('No se encontró ningún proveedor con el nombre proporcionado'));
        }

        // Usamos el ID del proveedor en la consulta de inserción
        const proveedor_id = resultados[0].id;
        conexion.query
        ('INSERT INTO productos (nombre,codigo,descripcion,proveedor_id,precio,categoria_id,marca_id,imagen) VALUES (?,?,?,?,?,?,?,?)',
        [datos.nombre,datos.codigo,datos.descripcion,proveedor_id,datos.precio,categoria_id,marca_id, archivo.filename], (error, resultados) => {
          if (error) {
            return funcion(error);
          }
          funcion(null, resultados);
        });
      });
    });
  });
},
    retornarDatosId: function (conexion,id,funcion){
        conexion.query('SELECT * FROM productos WHERE id = ? ',[id],funcion);
    },
    borrar: function (conexion,id,funcion){ 
        conexion.query('DELETE FROM productos WHERE id=?', [id],funcion)
    },
    actualizar: function (conexion, datos, archivos, funcion) {
      conexion.query("UPDATE productos SET nombre=?,codigo=?, descripcion=?, precio=?, proveedor=?, categoria=?, marca=? WHERE id=?",
      [datos.nombre,datos.codigo,datos.descripcion,datos.precio,datos.proveedor,datos.categoria,datos.marca, datos.id], funcion);
  },
    actualizarArchivo: function(conexion,datos,archivo,funcion){
        
        conexion.query('UPDATE productos SET imagen=? WHERE id =?',[archivo.filename, datos.id ],funcion);
    },
insertarImagen: function(conexion, productoId, imagen, callback) {
  const query = 'INSERT INTO imagenes_producto (producto_id, ruta_imagen) VALUES (?, ?)';
  conexion.query(query, [productoId, imagen], callback);
},
obtenerUltimos: function (conexion, cantidad, funcion) {
  conexion.query('SELECT * FROM productos ORDER BY id DESC LIMIT ?', [cantidad], funcion);
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
},
obtenerProveedores: function (conexion, callback) {
  const query = 'SELECT DISTINCT proveedor_id FROM productos';
  conexion.query(query, function (error, resultados) {
    if (error) {
      callback(error, null);
    } else {
      callback(null, resultados);
    }
  });
},
obtenerMarcas: function(conexion, callback) {
  conexion.query('SELECT * FROM marcas', function(error, resultados) {
      if (error) {
          console.log('Error al obtener marcas:', error);
          callback(error, null);
          return;
      }
      callback(null, resultados);
  });
},
obtenerModelosPorMarca: function(conexion, idMarca, callback) {
  conexion.query('SELECT * FROM modelos WHERE id_marca = ?', [idMarca], function(error, resultados) {
      if (error) {
          console.log('Error al obtener modelos:', error);
          callback(error, null);
          return;
      }
      callback(null, resultados);
  });
}
}