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
  actualizarPreciosPorProveedor: function (pool, proveedorId, porcentajeCambio, callback) {
        proveedorId = Number(proveedorId);
        porcentajeCambio = Number(porcentajeCambio);
    
        let query = "UPDATE productos SET precio = precio + precio * ? WHERE proveedor_id = ?";
        let params = [porcentajeCambio, proveedorId];
    
        pool.getConnection((err, conexion) => {
            if (err) {
                console.error('Error al obtener la conexión:', err);
                callback(err);
            } else {
                conexion.query(query, params, function (error, results) {
                    conexion.release();
                    if (error) {
                        console.error('Error al ejecutar la consulta:', error);
                        callback(error);
                    } else {
                        console.log('Filas actualizadas:', results.affectedRows);
                        callback(null);
                    }
                });
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
  conexion.query('SELECT productos.*, categorias.nombre AS categoria_nombre FROM productos INNER JOIN categorias ON productos.categoria_id = categorias.id WHERE productos.nombre LIKE ?', [`%${nombre}%`], funcion);
},
      obtenerTodos: function (conexion, saltar, parametro, funcion) {
        if (typeof funcion !== 'function') {
            throw new Error('funcion debe ser una función');
        }
        if (parametro === undefined) {
            parametro = saltar;
            saltar = 0; 
        }
        if (parametro !== null) {
            conexion.query('SELECT productos.*, categorias.nombre AS categoria_nombre FROM productos INNER JOIN categorias ON productos.categoria_id = categorias.id WHERE categoria_id = ? LIMIT ?,20', [parametro, saltar], funcion);
        } else {
            conexion.query('SELECT productos.*, categorias.nombre AS categoria_nombre FROM productos INNER JOIN categorias ON productos.categoria_id = categorias.id LIMIT ?,20', [saltar], funcion);
        }
    },
    obtenerProductosPorProveedor: function (conexion, proveedor, callback) {
      const query = 'SELECT * FROM productos WHERE proveedor_id = ?';
      conexion.query(query, [proveedor], function (error, resultados) {
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
  var consulta = 'SELECT * FROM modelos WHERE id_marca = ?';
  
  conexion.query(consulta, [marcaId], function(error, resultados) {
      if (error) {
          console.log('Error al obtener modelos:', error);
          callback(error, null);
          return;
      }
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
obtenerProductosPorProveedorYCategoría: function(conexion, proveedor, categoria, callback) {
  var query = "SELECT * FROM productos WHERE proveedor_id = ? AND categoria_id = ?";
  conexion.query(query, [proveedor, categoria], function(error, resultados) {
      if (error) {
          callback(error, null);
      } else {
          callback(null, resultados);
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
},
  obtenerPorFiltros: function(conexion, categoria, marca, modelo, callback) {
  // Consulta SQL para obtener los productos por filtros
  var consulta = 'SELECT * FROM productos WHERE 1=1';
  var parametros = [];

  if (categoria) {
      consulta += ' AND categoria_id = ?';
      parametros.push(categoria);
  }

  // Verifica si marca es NaN
  if (marca && !isNaN(marca)) {
      consulta += ' AND marca_id = ?';
      parametros.push(marca);
  }

  // Verifica si modelo es NaN
  if (modelo && !isNaN(modelo)) {
      consulta += ' AND modelo_id = ?';
      parametros.push(modelo);
  }

  // Imprime la consulta y los parámetros
  console.log('Consulta SQL:', consulta);
  console.log('Parámetros:', parametros);

  // Ejecuta la consulta
  conexion.query(consulta, parametros, function(error, resultados) {
      if (error) {
          console.log('Error al obtener productos:', error);
          callback(error, null);
          return;
      }
      callback(null, resultados);
  });
},
  obtenerIdCategoriaPorNombre: function(conexion, nombre, callback) {
  const consulta = 'SELECT id FROM categorias WHERE nombre = ?';
  conexion.query(consulta, [nombre], function(error, resultados) {
      
  });
},
  obtenerPorCategoriaMarcaModelo: function(conexion, categoria, marca, modelo, callback) {
  var query = "SELECT id, nombre, codigo, imagen, descripcion, precio, modelo, categoria_id, marca_id, proveedor_id, modelo_id FROM productos WHERE categoria_id = ? AND marca_id = ? AND modelo_id = ?";
  conexion.query(query, [categoria, marca, modelo], function(error, resultados) {
      if (error) {
          callback(error, null);
      } else {
          callback(null, resultados);
      }
  });
},
}