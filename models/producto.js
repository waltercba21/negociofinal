const conexion = require('../config/conexion')
const util = require('util');

module.exports ={
obtener: function (conexion, pagina, funcion) {
  if (typeof funcion !== 'function') {
      throw new Error('funcion debe ser una función');
  }
  const saltar = (pagina - 1) * 30;
  conexion.query('SELECT * FROM productos LIMIT ?,30', [saltar], funcion);  
},
obtenerTotal: function (conexion, funcion) {
  if (typeof funcion !== 'function') {
      throw new Error('funcion debe ser una función');
  }
  conexion.query('SELECT COUNT(*) as total FROM productos', funcion);
},
  obtenerPorId: function (conexion, id, funcion) {
    conexion.query('SELECT productos.*, categorias.nombre AS categoria_nombre FROM productos INNER JOIN categorias ON productos.categoria_id = categorias.id WHERE productos.id = ?', [id], funcion);
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
          conexion.query('INSERT INTO productos (nombre,codigo,descripcion,proveedor_id,precio,categoria_id,marca_id,modelo_id,imagen,costo,utilidad) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [datos.nombre,datos.codigo,datos.descripcion,proveedor_id,datos.precio,categoria_id,marca_id,datos.modelo_id, archivo.filename, datos.costo, datos.utilidad], (error, resultados) => {
            if (error) {
              return funcion(error);
            }
            funcion(null, resultados);
          });
        });
      });
    });
  },
 insertarProductoProveedor: function(conexion, producto_id, proveedor_id, precio, codigo, funcion) {
  conexion.query('INSERT INTO producto_proveedor (producto_id, proveedor_id, precio, codigo) VALUES (?, ?, ?, ?)',
  [producto_id, proveedor_id, precio, codigo], (error, resultados) => {
    if (error) {
      return funcion(error);
    }
    funcion(null, resultados);
  });
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
obtenerUltimos: function (conexion, cantidad, funcion) {
  conexion.query('SELECT productos.*, categorias.nombre AS categoria_nombre FROM productos INNER JOIN categorias ON productos.categoria_id = categorias.id ORDER BY productos.id DESC LIMIT ?', [cantidad], funcion);
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
      actualizarPreciosPorProveedor: function (proveedorId, porcentajeCambio, callback) {
        proveedorId = Number(proveedorId);
        porcentajeCambio = Number(porcentajeCambio);
    
        // Agrega ROUND() a tu consulta para redondear el precio
        let query = "UPDATE productos SET precio = ROUND((precio + precio * ?) / 100) * 100 WHERE proveedor_id = ?";
        let params = [porcentajeCambio, proveedorId];
    
        conexion.getConnection((err, conexion) => {
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
    
    actualizarPrecio: function (idProducto, nuevoPrecio, callback) {
        let query = "UPDATE productos SET precio = ? WHERE id = ?";
        let params = [nuevoPrecio, idProducto];
    
        conexion.getConnection((err, conexion) => {
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
    obtenerPorNombre: function (conexion, nombre, funcion) {
      conexion.query('SELECT productos.*, categorias.nombre AS categoria FROM productos INNER JOIN categorias ON productos.categoria_id = categorias.id WHERE productos.nombre LIKE ?', [`%${nombre}%`], funcion);
    },
    obtenerTodos: function(conexion, saltar, categoriaSeleccionada) {
      return new Promise((resolve, reject) => {
          let consulta = 'SELECT productos.*, categorias.nombre AS categoria FROM productos LEFT JOIN categorias ON productos.categoria_id = categorias.id';
          let parametros = [saltar];
          if (categoriaSeleccionada) {
              consulta += ' WHERE categoria_id = ?';
              parametros.unshift(categoriaSeleccionada);
          }
          consulta += ' ORDER BY id DESC LIMIT 20 OFFSET ?';
          conexion.query(consulta, parametros, function(error, resultados) {
              if (error) {
                  reject(error);
              } else {
                  resolve(resultados);
              }
          });
      });
    },
    obtenerProductosPorProveedor: function (conexion, proveedor) {
      const query = 'SELECT * FROM productos WHERE proveedor_id = ?';
      const queryPromise = util.promisify(conexion.query).bind(conexion);
      return queryPromise(query, [proveedor]);
  },
  obtenerProveedores: function(conexion) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT id, nombre FROM proveedores';
        conexion.query(query, function(error, resultados) {
            if (error) {
                reject(error);
            } else {
                console.log('Resultados de la consulta:', resultados);
                resolve(resultados);
            }
        });
    });
},
obtenerMarcas: function(conexion) {
  return new Promise((resolve, reject) => {
      conexion.query('SELECT * FROM marcas', function(error, resultados) {
          if (error) {
              console.log('Error al obtener marcas:', error);
              reject(error);
          } else {
              resolve(resultados);
          }
      });
  });
},
obtenerModelosPorMarca: function(conexion, marcaId) {
  return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM modelos';
      let params = [];

      if (marcaId) {
          query += ' WHERE id_marca = ?';
          params.push(marcaId);
      }

      conexion.query(query, params, function(error, resultados) {
          if (error) {
              reject(error);
          } else {
              console.log('Resultados de la consulta:', resultados);
              resolve(resultados);
          }
      });
  });
},
obtenerModeloPorId: function (conexion, id, callback) {
  console.log('id:', id); // Verificar el valor de id
  conexion.query('SELECT * FROM modelos WHERE id = ?', [id], function (error, resultados) {
      if (error) {
          callback(error, null);
      } else {
          console.log('resultados:', resultados); // Verificar los resultados de la consulta
          callback(null, resultados);
      }
  });
},

contarPorProveedor: function(conexion, proveedor, callback) {
  var query = "SELECT COUNT(*) as total FROM productos WHERE proveedor_id = ?";
  conexion.query(query, [proveedor], function(error, resultado) {
      if (error) {
          callback(error, null);
      } else {
          callback(null, resultado);
      }
  });
}, 
obtenerCategorias: function(conexion) {
  return new Promise((resolve, reject) => {
      conexion.query('SELECT * FROM categorias', function(error, resultados) {
          if (error) {
              console.error('Error al obtener categorías:', error);
              reject(error);
          } else {
              console.log('Resultados de la consulta:', resultados);
              resolve(resultados);
          }
      });
  });
},
obtenerProductos: function(conexion, saltar, productosPorPagina, callback) {
  var query = "SELECT * FROM productos LIMIT ?, ?";
  conexion.query(query, [saltar, productosPorPagina], function(error, resultados) {
      if (error) {
          callback(error, null);
      } else {
          callback(null, resultados);
      }
  });
},
obtenerProductosPorCategoria: function(conexion, categoriaId, callback) {
  var query = "SELECT * FROM productos WHERE categoria_id = ?";
  conexion.query(query, [categoriaId], function(error, resultados) {
      if (error) {
          callback(error, null);
      } else {
          callback(null, resultados);
      }
  });
},
contarProductos: function(conexion, callback) {
  var query = "SELECT COUNT(*) as total FROM productos";
  conexion.query(query, function(error, resultado) {
      if (error) {
          callback(error, null);
      } else {
          callback(null, resultado);
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
obtenerPorFiltros: function(conexion, categoria, marca, modelo) {
  return new Promise((resolve, reject) => {
    var consulta = 'SELECT productos.*, categorias.nombre AS categoria FROM productos LEFT JOIN categorias ON productos.categoria_id = categorias.id WHERE 1=1';
    var parametros = [];

    if (categoria) {
        consulta += ' AND categoria_id = ?';
        parametros.push(categoria);
    }

    if (marca && !isNaN(marca)) {
        consulta += ' AND marca_id = ?';
        parametros.push(marca);
    }

    if (modelo && !isNaN(modelo)) {
        consulta += ' AND modelo_id = ?';
        parametros.push(modelo);
    }

    conexion.query(consulta, parametros, function(error, resultados) {
        if (error) {
            console.log('Error al obtener productos:', error);
            reject(error);
        } else {
            resolve(resultados);
        }
    });   
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
retornarDatosId: function(conexion, id) {
  return new Promise((resolve, reject) => {
      conexion.query('SELECT * FROM productos WHERE id = ?', [id], function(error, resultados) {
          if (error) {
              console.error('Error al obtener el producto:', error);
              reject(error);
          } else {
              console.log('Resultados de la consulta:', resultados);
              resolve(resultados);
          }
      });
  });
}
}