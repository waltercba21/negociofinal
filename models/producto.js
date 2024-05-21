const conexion = require('../config/conexion')
const util = require('util');
const path = require('path');

module.exports ={
    obtener : function(conexion, pagina, callback) {
        const offset = (pagina - 1) * 20;
        const consulta = `
            SELECT productos.*, imagenes_producto.imagen 
            FROM productos 
            LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id 
            LIMIT 20 OFFSET ?`;
        conexion.query(consulta, [offset], (error, resultados) => {
            if (error) {
                callback(error);
                return;
            }
            // Agrupar las imágenes por producto
            const productos = [];
            const mapaProductos = {};
            resultados.forEach(resultado => {
                if (!mapaProductos[resultado.id]) {
                    mapaProductos[resultado.id] = {
                        ...resultado,
                        imagenes: resultado.imagen ? [resultado.imagen] : []
                    };
                    productos.push(mapaProductos[resultado.id]);
                } else if (resultado.imagen) {
                    mapaProductos[resultado.id].imagenes.push(resultado.imagen);
                }
            });
            callback(null, productos);
        });
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
  insertarProducto: function(conexion, producto) {
    return new Promise((resolve, reject) => {
        conexion.query('INSERT INTO productos SET ?', producto, function(error, result) {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
},
insertarProductoProveedor: function(conexion, productoProveedor) {
    return new Promise((resolve, reject) => {
        const fila = [productoProveedor.producto_id, productoProveedor.proveedor_id, productoProveedor.precio_lista, productoProveedor.codigo];

        conexion.query('INSERT INTO producto_proveedor (producto_id, proveedor_id, precio_lista, codigo) VALUES (?, ?, ?, ?)', fila, function(error, result) {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
},
  insertarDescuentos:function(conexion, proveedor_id, descuento, funcion) {
    conexion.query('INSERT INTO descuentos_proveedor (proveedor_id, descuento) VALUES (?, ?)',
    [proveedor_id, descuento], funcion);
  },
  eliminar : async (idOrIds) => {
    return new Promise((resolve, reject) => {
        // Si se pasó un solo ID, convertirlo en una lista de un solo elemento
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
        // Convertir la lista de IDs en una cadena de texto separada por comas
        const idList = ids.join(',');
        conexion.query(`DELETE FROM producto_proveedor WHERE producto_id IN (${idList})`, (error, results) => {
            if (error) {
                reject(error);
            } else {
                conexion.query(`DELETE FROM productos WHERE id IN (${idList})`, (error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(results);
                    }
                });
            }
        });
    });
},
actualizar: function (conexion, datos, archivo) {
    return new Promise((resolve, reject) => {
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
    if (datos.precio_venta) {
        query += first ? "precio_venta=?" : ", precio_venta=?";
        params.push(datos.precio_venta);
        first = false;
    }
    if (datos.utilidad) {
        query += first ? "utilidad=?" : ", utilidad=?";
        params.push(datos.utilidad);
        first = false;
    }
    if (datos.descuentos_proveedor_id) {
        query += first ? "descuentos_proveedor_id=?" : ", descuentos_proveedor_id=?";
        params.push(datos.descuentos_proveedor_id);
        first = false;
    }
    if (datos.costo_neto) {
        query += first ? "costo_neto=?" : ", costo_neto=?";
        params.push(datos.costo_neto);
        first = false;
    }
    if (datos.IVA) {
        query += first ? "IVA=?" : ", IVA=?";
        params.push(datos.IVA);
        first = false;
    }
    if (datos.costo_iva) {
        query += first ? "costo_iva=?" : ", costo_iva=?";
        params.push(datos.costo_iva);
        first = false;
    }
    if (datos.estado) {
        query += first ? "estado=?" : ", estado=?";
        params.push(datos.estado);
        first = false;
    }
    if (archivo) {
        query += first ? "imagen=?" : ", imagen=?";
        params.push(archivo.filename);
    }
    if (!datos.id) {
        reject(new Error('Los datos del producto deben incluir un ID'));
    }
    query += " WHERE id=?";
    params.push(datos.id);

    conexion.query(query, params, (error, results) => {
        if (error) {
            reject(error);
        } else {
            resolve(results);
        }
    });
});
},
actualizarProductoProveedor: function(conexion, datosProductoProveedor) {
    return new Promise((resolve, reject) => {
        // Primero, verifica si ya existe una entrada para este producto y proveedor
        const query = 'SELECT * FROM producto_proveedor WHERE producto_id = ? AND proveedor_id = ?';
        conexion.query(query, [datosProductoProveedor.producto_id, datosProductoProveedor.proveedor_id], (error, results) => {
            if (error) {
                reject(error);
                return;
            }
            if (results.length > 0) {
                // Si ya existe una entrada, actualízala
                const query = 'UPDATE producto_proveedor SET precio_lista = ?, codigo = ? WHERE producto_id = ? AND proveedor_id = ?';
                conexion.query(query, [datosProductoProveedor.precio_lista, datosProductoProveedor.codigo, datosProductoProveedor.producto_id, datosProductoProveedor.proveedor_id], (error, results) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            } else {
                // Si no existe una entrada, crea una nueva
                const query = 'INSERT INTO producto_proveedor (producto_id, proveedor_id, precio_lista, codigo) VALUES (?, ?, ?, ?)';
                conexion.query(query, [datosProductoProveedor.producto_id, datosProductoProveedor.proveedor_id, datosProductoProveedor.precio_lista, datosProductoProveedor.codigo], (error, results) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            }
        });
    });
},
actualizarArchivo: function(conexion, datosProducto, archivo) {
    return new Promise((resolve, reject) => {
        const query = 'INSERT INTO imagenes_producto (imagen, producto_id) VALUES (?, ?)';
        const params = [archivo.filename, datosProducto.id]; // Asume que 'archivo' es un objeto con una propiedad 'filename'

        conexion.query(query, params, (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
},
obtenerUltimos: function (conexion, cantidad, funcion) {
    conexion.query(`
      SELECT productos.*, categorias.nombre AS categoria_nombre, GROUP_CONCAT(imagenes_producto.imagen) AS imagenes 
      FROM productos 
      INNER JOIN categorias ON productos.categoria_id = categorias.id 
      LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id 
      GROUP BY productos.id 
      ORDER BY productos.id DESC LIMIT ?`, 
      [cantidad], 
      function(err, rows) {
        if (err) {
          return funcion(err);
        }
  
        // Convertir las imágenes en un array
        const productos = rows.map(row => ({
          ...row,
          imagenes: row.imagenes ? row.imagenes.split(',') : [],
        }));
  
        funcion(null, productos);
      }
    );
  },
actualizarPreciosPorProveedor: function (proveedorId, porcentajeCambio, callback) {
        proveedorId = Number(proveedorId);
        porcentajeCambio = Number(porcentajeCambio);
    
        // Agrega ROUND() a tu consulta para redondear el precio
        let query = "UPDATE productos SET precio_venta = ROUND((precio_venta + precio_venta * ?) / 100) * 100 WHERE proveedor_id = ?";
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
        let query = "UPDATE productos SET precio_venta = ? WHERE id = ?";
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
        const sql = 'SELECT productos.*, categorias.nombre AS categoria, imagenes_producto.imagen as imagen FROM productos' +
                    ' INNER JOIN categorias ON productos.categoria_id = categorias.id' +
                    ' LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id' +
                    ' WHERE productos.nombre LIKE ?';
        conexion.query(sql, [`%${nombre}%`], (error, productos) => {
          if (error) {
            funcion(error, null);
          } else {
            // Agrupar las imágenes por producto
            const productosAgrupados = productos.reduce((acc, producto) => {
              const productoExistente = acc.find(p => p.id === producto.id);
              if (productoExistente) {
                productoExistente.imagenes.push({ imagen: producto.imagen });
              } else {
                producto.imagenes = [{ imagen: producto.imagen }];
                acc.push(producto);
              }
              return acc;
            }, []);
            funcion(null, productosAgrupados);
          }
        });    
      },
      obtenerPosicion: function(conexion, idProducto) {
        return new Promise((resolve, reject) => {
            const consulta = 'SELECT COUNT(*) AS posicion FROM productos WHERE id <= ? ORDER BY id';
            conexion.query(consulta, [idProducto], (error, resultados) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(resultados[0].posicion);
                }
            });
        });
    },
      obtenerTodos: function(conexion, saltar, productosPorPagina, categoriaSeleccionada) {
        return new Promise((resolve, reject) => {
            let consulta = 'SELECT productos.*, categorias.nombre AS categoria, GROUP_CONCAT(imagenes_producto.imagen) AS imagenes FROM productos LEFT JOIN categorias ON productos.categoria_id = categorias.id LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id';
            let parametros = [saltar, productosPorPagina];
            if (categoriaSeleccionada) {
                consulta += ' WHERE categoria_id = ?';
                parametros.unshift(categoriaSeleccionada);
            }
            consulta += ' GROUP BY productos.id ORDER BY id DESC LIMIT ?, ?';
            conexion.query(consulta, parametros, function(error, resultados) {
                if (error) {
                    reject(error);
                } else {
                    // Divide las imágenes en un array
                    resultados.forEach(producto => {
                        producto.imagenes = producto.imagenes ? producto.imagenes.split(',') : [];
                    });
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
        const query = 'SELECT proveedores.id, proveedores.nombre, descuentos_proveedor.descuento FROM proveedores LEFT JOIN descuentos_proveedor ON proveedores.id = descuentos_proveedor.proveedor_id';
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
        let sql = 'SELECT productos.*, categorias.nombre as categoria_nombre, imagenes_producto.imagen as imagen FROM productos';
        sql += ' LEFT JOIN categorias ON productos.categoria_id = categorias.id';
        sql += ' LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id';
        sql += ' WHERE 1=1';
        const parametros = [];
  
        if (categoria) {
            sql += ' AND categoria_id = ?';
            parametros.push(categoria);
        }
  
        if (marca) {
            sql += ' AND marca_id = ?';
            parametros.push(marca);
        }
  
        if (modelo) {
            sql += ' AND modelo_id = ?';
            parametros.push(modelo);
        }
  
        conexion.query(sql, parametros, (error, productos) => {
            if (error) {
                reject(error);
            } else {
                // Agrupar las imágenes por producto
                const productosAgrupados = productos.reduce((acc, producto) => {
                    const productoExistente = acc.find(p => p.id === producto.id);
                    if (productoExistente) {
                        productoExistente.imagenes.push({ imagen: producto.imagen });
                    } else {
                        producto.imagenes = [{ imagen: producto.imagen }];
                        acc.push(producto);
                    }
                    return acc;
                }, []);
                resolve(productosAgrupados);
            }
        });
    });
  },
  obtenerPorCategoriaMarcaModelo: function(conexion, categoria, marca, modelo, callback) {
  var query = "SELECT id, nombre, codigo, imagen, descripcion, precio_venta, modelo, categoria_id, marca_id, proveedor_id, modelo_id FROM productos WHERE categoria_id = ? AND marca_id = ? AND modelo_id = ?";
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
        conexion.query('SELECT productos.*, imagenes_producto.id AS imagen_id, imagenes_producto.imagen FROM productos LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id WHERE productos.id = ?', [id], function(error, results, fields) {
            if (error) {
                console.log("Error en la consulta:", error);
                reject(error);
            } else {
                if (results.length > 0) {
                    let producto = results[0];
                    producto.imagenes = results.map(result => {
                        let imagenRuta = result.imagen ? path.join('/uploads/productos', result.imagen) : '/ruta/a/imagen/por/defecto';
                        return {
                            id: result.imagen_id,
                            imagen: imagenRuta
                        };
                    });
                    console.log("Producto obtenido:", producto);
                    resolve(producto);
                } else {
                    console.log("No se encontró el producto con id:", id);
                    resolve(null);
                }
            }
        });
    });
},
obtenerImagenesProducto: function(conexion, id) {
    return new Promise((resolve, reject) => {
        conexion.query(`
            SELECT imagen, producto_id
            FROM imagenes_producto
            WHERE producto_id = ?
        `, [id], function(error, resultados) {
            if (error) {
                console.error('Error al obtener las imágenes del producto:', error);
                reject(error);
            } else {
                console.log('Imágenes del producto obtenidas:', resultados);
                resolve(resultados);
            }
        });
    });
},
  obtenerProveedoresProducto: function(conexion, id) {
    return new Promise((resolve, reject) => {
        conexion.query(`
            SELECT pp.proveedor_id, pp.codigo, pp.precio_lista, dp.descuento
            FROM producto_proveedor pp
            LEFT JOIN descuentos_proveedor dp ON pp.proveedor_id = dp.proveedor_id
            WHERE pp.producto_id = ?
        `, [id], function(error, resultados) {
            if (error) {
                console.error('Error al obtener los proveedores del producto:', error);
                reject(error);
            } else {
                console.log('Resultados de la consulta:', resultados);
                resolve(resultados);
            }
        });
    });
},
obtenerDescuentosProveedor: function(conexion) {
  return new Promise((resolve, reject) => {
      conexion.query('SELECT proveedor_id, descuento FROM descuentos_proveedor', function(error, results, fields) {
          if (error) reject(error);
          resolve(results);
      });
  });
},
retornarDatosProveedores: function(conexion, productoId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT pp.proveedor_id, pp.codigo, pp.precio_lista, dp.descuento, pp.costo_neto, pp.costo_iva, pp.utilidad, pp.precio_venta
            FROM producto_proveedor AS pp
            LEFT JOIN descuentos_proveedor AS dp ON pp.proveedor_id = dp.proveedor_id
            WHERE pp.producto_id = ?
        `;
        conexion.query(query, [productoId], (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
},
eliminarProveedor: function(conexion, proveedorId) {
    return new Promise((resolve, reject) => {
        conexion.query('DELETE FROM producto_proveedor WHERE proveedor_id = ?', [proveedorId], function(error, results, fields) {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
},
insertarImagenProducto: function(conexion, datosImagen) {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO imagenes_producto (producto_id, imagen) VALUES (?, ?)';
        conexion.query(sql, [datosImagen.producto_id, datosImagen.imagen], (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
},
eliminarImagen : function(id) {
    return new Promise((resolve, reject) => {
        console.log('Eliminar imagen llamado con id:', id); // Imprime el id con el que se llamó la función
        const sql = 'DELETE FROM imagenes_producto WHERE id = ?';
        conexion.query(sql, [id], function(err, results) {
            if (err) {
                console.log('Error al ejecutar la consulta SQL:', err); // Imprime el error si hay uno
                return reject(err);
            }
            console.log('Resultados de la consulta SQL:', results); // Imprime los resultados de la consulta SQL
            resolve(results);
        });
    });
}
}