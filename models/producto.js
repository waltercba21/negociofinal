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
insertar: function(conexion, datos, archivo, funcion){
  if (!archivo) {
    return funcion(new Error('No se proporcionó un archivo'));
  }
  conexion.query('SELECT id FROM categorias WHERE nombre = ?', [datos.categoria], (error, resultados) => {
    if (error) {
      return funcion(error);
    }
    if (resultados.length === 0) {
      return funcion(new Error('No se encontró ninguna categoría con el nombre proporcionado'));
    }
    const categoria_id = resultados[0].id;
    conexion.query('SELECT id FROM marcas WHERE id = ?', [datos.marca], (error, resultados) => {
      if (error) {
        return funcion(error);
      }
      if (resultados.length === 0) {
        return funcion(new Error('No se encontró ninguna marca con el ID proporcionado'));
      }
      const marca_id = resultados[0].id;
      conexion.query('SELECT id FROM proveedores WHERE id = ?', [datos.proveedor], (error, resultados) => {
        if (error) {
          return funcion(error);
        }
        if (resultados.length === 0) {
          return funcion(new Error('No se encontró ningún proveedor con el ID proporcionado'));
        }
        const proveedor_id = resultados[0].id;
        conexion.query('INSERT INTO productos (nombre,codigo,descripcion,proveedor_id,precio,categoria_id,marca_id,modelo_id,imagen) VALUES (?,?,?,?,?,?,?,?,?)',
        [datos.nombre,datos.codigo,datos.descripcion,proveedor_id,datos.precio,categoria_id,marca_id,datos.modelo_id, archivo.filename], (error, resultados) => {
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
    actualizar: function (conexion, datos, archivo, funcion) {
      let query = "UPDATE productos SET ";
      let params = [];
      let first = true;
  
      if (datos.nombre) {
          query += first ? "nombre=?" : ", nombre=?";
          params.push(datos.nombre);
          first = false;
      }
      if (datos.codigo) {
          query += first ? "codigo=?" : ", codigo=?";
          params.push(datos.codigo);
          first = false;
      }
      if (datos.categoria_id) {
          query += first ? "categoria_id=?" : ", categoria_id=?";
          params.push(datos.categoria_id);
          first = false;
      }
      if (datos.marca_id) {
          query += first ? "marca_id=?" : ", marca_id=?";
          params.push(datos.marca_id);
          first = false;
      }
      if (datos.proveedor_id) {
          query += first ? "proveedor_id=?" : ", proveedor_id=?";
          params.push(datos.proveedor_id);
          first = false;
      }
      if (datos.modelo_id) {
          query += first ? "modelo_id=?" : ", modelo_id=?";
          params.push(datos.modelo_id);
          first = false;
      }
      if (datos.precio) {
        query += first ? "precio=?" : ", precio=?";
        params.push(datos.precio);
        first = false;
    }
      // Repite este patrón para cada campo
  
      if (archivo) {
          query += first ? "imagen=?" : ", imagen=?";
          params.push(archivo.filename);
      }
  
      if (!datos.id) {
          return funcion(new Error('Los datos del producto deben incluir un ID'));
      }
      query += " WHERE id=?";
      params.push(datos.id);
  
      conexion.query(query, params, funcion);
  },
    
    actualizarArchivo: function(conexion,datos,archivo,funcion){
      if (archivo) {
        conexion.query('UPDATE productos SET imagen=? WHERE id =?',[archivo.filename, datos.id ],funcion);
      } else {
        funcion();
      }
    },
insertarImagen: function(conexion, productoId, imagen, callback) {
  const query = 'INSERT INTO imagenes_producto (producto_id, ruta_imagen) VALUES (?, ?)';
  conexion.query(query, [productoId, imagen], callback);
},
obtenerUltimos: function (conexion, cantidad, funcion) {
  conexion.query('SELECT * FROM productos ORDER BY id DESC LIMIT ?', [cantidad], funcion);
},
obtenerImagenes: function(conexion, productoId, callback) {
  const query = 'SELECT * FROM imagenes_producto WHERE producto_id = ?';
  conexion.query(query, [productoId], callback);
},

// Borrar todas las imágenes de un producto
borrarImagenes: function(conexion, productoId, callback) {
  const query = 'DELETE FROM imagenes_producto WHERE producto_id = ?';
  conexion.query(query, [productoId], callback);
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
      actualizarPreciosPorProveedor: function (conexion, proveedor, porcentajeAumento, callback) {
        if (proveedor === undefined || proveedor === null || porcentajeAumento === undefined || porcentajeAumento === null) {
            callback(new Error('Proveedor o porcentajeAumento no definidos'), null);
            return;
        }
        // Convertir porcentajeAumento a un número y dividirlo por 100 para obtener un porcentaje
        porcentajeAumento = Number(porcentajeAumento) / 100;
        const query = 'UPDATE productos SET precio = precio + precio * ? WHERE proveedor_id = ?';
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
    obtenerPorNombre: function (conexion, nombre, funcion) {
        conexion.query('SELECT * FROM productos WHERE nombre LIKE ?', [`%${nombre}%`], funcion);
      },
      obtenerTodos: function (conexion, saltar, parametro, funcion) {
        if (typeof funcion !== 'function') {
            throw new Error('funcion debe ser una función');
        }
        if (parametro === undefined) {
            // Si no se proporcionó un parámetro, asumir que el parámetro es la función de callback
            funcion = parametro;
            parametro = null;
        }
        if (parametro !== null) {
            // Si se proporcionó un parámetro, usarlo en la consulta
            conexion.query('SELECT * FROM productos WHERE categoria = ? LIMIT ?,20', [parametro, saltar], funcion);
        } else {
            // Si no se proporcionó un parámetro, no usarlo en la consulta
            conexion.query('SELECT * FROM productos LIMIT ?,20', [saltar], funcion);
        }
    },
 obtenerProductosPorProveedor: function (conexion, proveedor, saltar, callback) {
        const query = 'SELECT * FROM productos WHERE proveedor_id = ? LIMIT ?, 20';
        conexion.query(query, [proveedor, saltar], function (error, resultados) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, resultados);
            }
        });
    },
obtenerProveedores: function (conexion, callback) {
  const query = 'SELECT id, nombre FROM proveedores';
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
obtenerModelosPorMarca: function(conexion, marcaId, callback) {
  // Consulta SQL para obtener los modelos por marca
  var consulta = 'SELECT * FROM modelos WHERE id_marca = ?';
  
  // Ejecuta la consulta
  conexion.query(consulta, [marcaId], function(error, resultados) {
      if (error) {
          console.log('Error al obtener modelos:', error);
          callback(error, null);
          return;
      }
      
      // Devuelve los modelos
      callback(null, resultados);
  });
},
obtenerCategorias: function(conexion, funcion) {
  conexion.query('SELECT * FROM categorias', function(error, resultados) {
      if (error) {
          return funcion(error);
      }
      funcion(null, resultados);
  });
},
obtenerPorCategoria: function(conexion, categoria, callback) {
  var query = "SELECT * FROM productos WHERE categoria_id = ?";
  conexion.query(query, [categoria], function(error, resultados) {
      if (error) {
          callback(error, null);
      } else {
          callback(null, resultados);
      }
  });
},
obtenerIdPorCategoria: function(conexion, categoria, callback) {
  var query = "SELECT id FROM categorias WHERE nombre = ?";
  conexion.query(query, [categoria], function(error, resultados) {
    if (error) {
      callback(error, null);
    } else {
      if (resultados.length > 0) {
        callback(null, resultados[0].id);
      } else {
        callback(new Error('No se encontró la categoría'), null);
      }
    }
  });
},
contarPorProveedor: function (conexion, proveedor, callback) {
  const query = 'SELECT COUNT(*) AS total FROM productos WHERE proveedor_id = ?';
  conexion.query(query, [proveedor], function (error, resultados) {
      if (error) {
          callback(error, null);
      } else {
          callback(null, resultados);
      }
  });
},
contarTodos: function (conexion, parametro, callback) {
  const query = 'SELECT COUNT(*) AS total FROM productos';
  conexion.query(query, function (error, resultados) {
      if (error) {
          callback(error, null);
      } else {
          callback(null, resultados);
      }
  });
},
contarPorCategoria: function(conexion, categoria, callback) {
  conexion.query('SELECT COUNT(*) as total FROM productos WHERE categoria_id = ?', [categoria], callback);
},
obtenerTodosLosProductos: function (conexion, saltar, callback) {
  const query = 'SELECT * FROM productos LIMIT ?, 20';
  conexion.query(query, [saltar], function (error, resultados) {
      if (error) {
          callback(error, null);
      } else {
          callback(null, resultados);
      }
  });
},
contarTodosLosProductos: function (conexion, callback) {
  const query = 'SELECT COUNT(*) AS total FROM productos';
  conexion.query(query, function (error, resultados) {
      if (error) {
          callback(error, null);
      } else {
          callback(null, resultados[0].total);
      } 
  });
}
}