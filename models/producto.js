const conexion = require('../config/conexion')
const util = require('util');
const path = require('path');

module.exports ={
    
    obtener: function(conexion, pagina, callback) {
        const offset = (pagina - 1) * 20;
        const consulta = `
            SELECT productos.*, imagenes_producto.imagen 
            FROM productos 
            LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id 
            ORDER BY productos.id DESC
            LIMIT 20 OFFSET ?`;
        conexion.query(consulta, [offset], (error, resultados) => {
            if (error) {
                callback(error);
                return;
            }
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
    obtenerSiguienteID: function() {
        return new Promise((resolve, reject) => {
          conexion.query('SELECT MAX(id) AS max_id FROM presupuestos_mostrador', (error, resultado) => {
            if (error) {
              reject(error);
              return;
            }
            let siguienteID = resultado[0].max_id || 0;
            siguienteID++;
            resolve(siguienteID);
          });
        });
      },
      guardarPresupuesto : (presupuesto) => {
        return new Promise((resolve, reject) => {
          conexion.query('INSERT INTO presupuestos_mostrador SET ?', presupuesto, (error, resultado) => {
            if (error) {
              reject(error);
            } else {
              resolve(resultado.insertId);
            }
          });
        });
    },
    guardarItemsPresupuesto : (items) => {
        return new Promise((resolve, reject) => {
          const query = 'INSERT INTO items_presupuesto (presupuesto_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ?';
          conexion.query(query, [items], (error, resultado) => {
            if (error) {
              reject(error);
            } else {
              resolve(resultado);
            }
          });
        });
      },
      getAllPresupuestos: (fechaInicio, fechaFin) => {
        return new Promise((resolve, reject) => {
            conexion.query(`
                SELECT p.id, p.nombre_cliente, p.fecha, p.total
                FROM presupuestos_mostrador p
                WHERE DATE(p.fecha) BETWEEN ? AND ?
            `, [fechaInicio, fechaFin], (error, resultados) => {
                if (error) {
                    reject(new Error('Error al obtener presupuestos: ' + error.message));
                } else {
                    const presupuestosFormateados = resultados.map(presupuesto => {
                        return {
                            ...presupuesto,
                            fecha: new Date(presupuesto.fecha).toLocaleDateString('es-ES'),
                            total: new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0 }).format(presupuesto.total)
                        };
                    });
                    resolve(presupuestosFormateados);
                }
            });
        });
    },
    
       obtenerProductoIdPorCodigo : (codigo) => {
        return new Promise((resolve, reject) => {
          const query = `
            SELECT p.id 
            FROM productos p
            JOIN producto_proveedor pp ON p.id = pp.producto_id
            WHERE pp.codigo = ?
          `;
          conexion.query(query, [codigo], (error, resultados) => {
            if (error) {
              reject(error);
            } else {
              if (resultados.length > 0) {
                resolve(resultados[0].id);
              } else {
                reject(new Error('Producto no encontrado'));
              }
            }
          });
        });
      },      
obtenerTotal: function (conexion, funcion) {
  if (typeof funcion !== 'function') {
      throw new Error('funcion debe ser una función');
  }
  conexion.query('SELECT COUNT(*) as total FROM productos', funcion);
},
obtenerPorId: function (conexion, id, funcion) {
    conexion.query('SELECT productos.*, categorias.nombre AS categoria_nombre, imagenes_producto.imagen FROM productos LEFT JOIN categorias ON productos.categoria_id = categorias.id LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id WHERE productos.id = ?', [id], function(error, resultados) {
        if (error) {
            return funcion(error);
        } else if (resultados.length === 0) {
            return funcion(null, []);
        } else {
            const producto = resultados.reduce((producto, resultado) => {
                if (!producto) {
                    producto = {
                        ...resultado,
                        imagenes: []
                    };
                }
                if (resultado.imagen) {
                    producto.imagenes.push(resultado.imagen);
                }
                return producto;
            }, null);
            return funcion(null, [producto]);
        }
    });
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
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
        const idList = ids.join(',');
        conexion.query(`DELETE FROM imagenes_producto WHERE producto_id IN (${idList})`, (error, results) => {
            if (error) {
                reject(error);
            } else {
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
        if (datos.stock_minimo) {
            query += first ? "stock_minimo=?" : ", stock_minimo=?";
            params.push(datos.stock_minimo);
            first = false;
        }
        if (datos.stock_actual) {
            query += first ? "stock_actual=?" : ", stock_actual=?";
            params.push(datos.stock_actual);
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
      SELECT productos.*, categorias.nombre AS categoria_nombre, 
      (SELECT imagen FROM imagenes_producto WHERE producto_id = productos.id LIMIT 1) AS imagen
      FROM productos 
      INNER JOIN categorias ON productos.categoria_id = categorias.id 
      GROUP BY productos.id 
      ORDER BY productos.id DESC LIMIT ?`, 
      [cantidad], 
      function(err, rows) {
        if (err) {
          return funcion(err);
        }
        const productos = rows.map(row => ({
          ...row,
          imagen: row.imagen ? [row.imagen] : [],
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
    actualizarPreciosPDF: function(precio_lista, codigo) {
        return new Promise((resolve, reject) => {
            if (typeof codigo !== 'string') {
                console.error(`El código del producto no es una cadena: ${codigo}`);
                resolve(null);
                return;
            }
    
            const sql = `SELECT pp.*, p.utilidad, p.precio_venta, dp.descuento 
                         FROM producto_proveedor pp 
                         JOIN productos p ON pp.producto_id = p.id 
                         JOIN descuentos_proveedor dp ON pp.proveedor_id = dp.proveedor_id 
                         WHERE pp.codigo = ?`;
    
            conexion.getConnection((err, conexion) => {
                if (err) {
                    console.error('Error al obtener la conexión:', err);
                    resolve(null);
                    return;
                }
    
                conexion.query(sql, [codigo], (error, results) => {
                    if (error) {
                        console.error(`Error al ejecutar la consulta SQL para el código ${codigo}:`, error);
                        conexion.release();
                        resolve(null);
                        return;
                    }
    
                    let producto = results[0];
                    if (!producto) {
                        console.log(`No se encontró ningún producto con el código ${codigo}`);
                        conexion.release();
                        resolve(null);
                        return;
                    }
    
                    let descuento = producto.descuento;
                    let costo_neto = precio_lista - (precio_lista * descuento / 100);
                    producto.costo_neto = costo_neto;
                    let IVA = 21; 
                    let costo_iva = costo_neto + (costo_neto * IVA / 100);
                    let utilidad = producto.utilidad;
                    
                    if (isNaN(costo_iva) || isNaN(utilidad)) {
                        console.error('Costo con IVA o utilidad no es un número válido');
                        conexion.release();
                        resolve(null);
                        return;
                    }
    
                    let precio_venta = costo_iva + (costo_iva * utilidad / 100);
                    precio_venta = Math.ceil(precio_venta / 10) * 10;
    
                    const sqlUpdateProductoProveedor = 'UPDATE producto_proveedor SET precio_lista = ? WHERE producto_id = ?';
                    const sqlUpdateProductos = 'UPDATE productos SET precio_venta = ? WHERE id = ?';
    
                    conexion.query(sqlUpdateProductoProveedor, [precio_lista, producto.producto_id], (errorUpdatePP, resultsUpdatePP) => {
                        if (errorUpdatePP) {
                            console.error('Error en la consulta SQL de actualización en producto_proveedor:', errorUpdatePP);
                            conexion.release();
                            resolve(null);
                            return;
                        }
    
                        conexion.query(sqlUpdateProductos, [precio_venta, producto.producto_id], (errorUpdateProd, resultsUpdateProd) => {
                            conexion.release();
                            if (errorUpdateProd) {
                                console.error('Error en la consulta SQL de actualización en productos:', errorUpdateProd);
                                resolve(null);
                            } else {
                                resolve({
                                    codigo: codigo,
                                    precio_lista_antiguo: producto.precio_lista,
                                    precio_lista_nuevo: precio_lista,
                                    precio_venta: precio_venta
                                });
                            }
                        });
                    });
                });
            });
        });
    },
      
    obtenerProductoPorCodigo: function(codigo) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM producto_proveedor WHERE codigo = ?';
            console.log(`Ejecutando consulta SQL: ${sql}`);
            console.log(`Con el valor: codigo = ${codigo}`);
            
            conexion.getConnection((err, conexion) => {
                if (err) {
                    console.error('Error al obtener la conexión:', err);
                    reject(err);
                } else {
                    conexion.query(sql, [codigo], (error, results) => {
                        conexion.release();
                        if (error) {
                            reject(error);
                        } else {
                            console.log(`Resultados de la consulta SQL: ${JSON.stringify(results)}`);
                            resolve(results[0]); 
                        }
                    });
                }
            });
        });
    },
    buscar : async (busqueda, categoria_id, marca_id, modelo_id) => {
        let query = `
            SELECT productos.*, imagenes_producto.imagen, categorias.nombre AS categoria 
            FROM productos 
            LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id 
            LEFT JOIN categorias ON productos.categoria_id = categorias.id`;
        let params = [];
    
        if (busqueda && typeof busqueda === 'string') {
            query += ' WHERE LOWER(productos.nombre) LIKE ?';
            params.push(`%${busqueda.toLowerCase()}%`);
        }
        if (categoria_id) {
            query += (params.length ? ' AND' : ' WHERE') + ' productos.categoria_id = ?';
            params.push(categoria_id);
        }
        if (marca_id) {
            query += (params.length ? ' AND' : ' WHERE') + ' productos.marca_id = ?';
            params.push(marca_id);
        }
        if (modelo_id) {
            query += (params.length ? ' AND' : ' WHERE') + ' productos.modelo_id = ?';
            params.push(modelo_id);
        }
    
        const [filas] = await conexion.promise().query(query, params);
        console.log('Filas obtenidas de la base de datos:', filas);
        const productos = {};
        filas.forEach(fila => {
            if (!productos[fila.id]) {
                productos[fila.id] = {
                    ...fila,
                    imagenes: fila.imagen ? [fila.imagen] : []
                };
            } else if (fila.imagen) {
                productos[fila.id].imagenes.push(fila.imagen);
            }
        });
    
        return Object.values(productos);
    },
    actualizarStock: function(conexion, idProducto, stockMinimo, stockActual) {
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE productos SET stock_minimo = ?, stock_actual = ? WHERE id = ?';
            conexion.query(sql, [stockMinimo, stockActual, idProducto], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    },
    obtenerStock: function(conexion, idProducto) {
        return new Promise((resolve, reject) => {
            conexion.query('SELECT stock_minimo, stock_actual FROM productos WHERE id = ?', [idProducto], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results[0]);
                }
            });
        });
    },
    actualizarStock: function(conexion, datosProducto) {
        return new Promise((resolve, reject) => {
            const query = 'UPDATE productos SET stock_actual = ? WHERE id = ?';
            conexion.query(query, [datosProducto.stock, datosProducto.id], (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
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
        console.log('Proveedor:', proveedor);
        const query = `
            SELECT productos.*, producto_proveedor.codigo AS codigo_proveedor, producto_proveedor.precio_lista, productos.precio_venta
            FROM productos 
            INNER JOIN producto_proveedor ON productos.id = producto_proveedor.producto_id
            WHERE producto_proveedor.proveedor_id = ?
        `;
        const queryPromise = util.promisify(conexion.query).bind(conexion);
        return queryPromise(query, [proveedor])
            .then(result => {
                console.log('Resultados de obtenerProductosPorProveedor:', result);
                return result;
            });
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
        conexion.query('SELECT * FROM marcas ORDER BY nombre ASC', function(error, resultados) {
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
  
        query += ' ORDER BY nombre ASC';
  
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
},obtenerCategorias: function(conexion) {
    return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM categorias ORDER BY nombre ASC';

        conexion.query(query, function(error, resultados) {
            if (error) {
                console.error('Error al obtener categorías:', error);
                reject(error);
            } else {
                resolve(resultados);
            }
        });
    });
},
obtenerProductosPorIds: async function(conexion, categoriaId, marcaId, modeloId) {
    let query = `
        SELECT productos.*, 
        GROUP_CONCAT(imagenes_producto.imagen) AS imagenes 
        FROM productos 
        LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id 
        WHERE 1=1
    `;
    let params = [];

    if (categoriaId !== undefined && categoriaId !== null) {
        query += ' AND categoria_id = ?';
        params.push(categoriaId);
    }

    if (marcaId !== undefined && marcaId !== null) {
        query += ' AND marca_id = ?';
        params.push(marcaId);
    }

    if (modeloId !== undefined && modeloId !== null) {
        query += ' AND modelo_id IN (SELECT id FROM modelos WHERE id_marca = ?)';
        params.push(modeloId);
    }

    query += ' GROUP BY productos.id';

    return new Promise((resolve, reject) => {
        conexion.query(query, params, (error, results) => {
            if (error) {
                console.error('Error al ejecutar la consulta:', error);
                reject(error);
            } else {
                // Convertir la cadena de imágenes en un array
                results = results.map(producto => {
                    producto.imagenes = producto.imagenes ? producto.imagenes.split(',') : [];
                    return producto;
                });
                resolve(results);
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
    var query = "SELECT * FROM productos WHERE categoria_id = ? ORDER BY id DESC";
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
obtenerProductosPorProveedorYCategoría: function(conexion, proveedor, categoria) {
    console.log('Proveedor:', proveedor, 'Categoría:', categoria);
    const query = `
        SELECT productos.*, producto_proveedor.codigo AS codigo_proveedor, producto_proveedor.precio_lista, productos.precio_venta
        FROM productos 
        INNER JOIN producto_proveedor ON productos.id = producto_proveedor.producto_id
        WHERE producto_proveedor.proveedor_id = ? AND productos.categoria_id = ?
    `;
    const queryPromise = util.promisify(conexion.query).bind(conexion);
    return queryPromise(query, [proveedor, categoria])
        .then(result => {
            console.log('Resultados de obtenerProductosPorProveedorYCategoría:', result);
            return result;
        });
},
obtenerProductosPorProveedorConStock: function(conexion, proveedor) {
    console.log('Proveedor:', proveedor);
    const query = `
        SELECT producto_proveedor.codigo AS codigo_proveedor, productos.nombre, productos.stock_minimo, productos.stock_actual
        FROM productos 
        INNER JOIN producto_proveedor ON productos.id = producto_proveedor.producto_id
        WHERE producto_proveedor.proveedor_id = ?
    `;
    const queryPromise = util.promisify(conexion.query).bind(conexion);
    return queryPromise(query, [proveedor])
        .then(result => {
            console.log('Resultados de obtenerProductosPorProveedorConStock:', result);
            return result;
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
obtenerPorFiltros(conexion, categoria, marca, modelo, busqueda_nombre) {
    return new Promise((resolve, reject) => {
        let sql = 'SELECT productos.*, categorias.nombre as categoria_nombre, imagenes_producto.imagen as imagen, producto_proveedor.codigo FROM productos';
        sql += ' LEFT JOIN categorias ON productos.categoria_id = categorias.id';
        sql += ' LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id';
        sql += ' LEFT JOIN producto_proveedor ON productos.id = producto_proveedor.producto_id';
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
        if (busqueda_nombre) {
            const palabras = busqueda_nombre.split(' ');
            palabras.forEach(palabra => {
                sql += ' AND productos.nombre LIKE ?';
                parametros.push('%' + palabra + '%');
            });
        }
        sql += ' ORDER BY productos.id DESC';

        conexion.query(sql, parametros, (error, productos) => {
            if (error) {
                reject(error);
            } else {
                const productosAgrupados = productos.reduce((acc, producto) => {
                    const productoExistente = acc.find(p => p.id === producto.id);
                    if (productoExistente) {
                        if (producto.imagen) {
                            productoExistente.imagenes.push({ imagen: producto.imagen });
                        }
                    } else {
                        producto.imagenes = producto.imagen ? [{ imagen: producto.imagen }] : [];
                        producto.codigo = producto.codigo || '';
                        acc.push(producto);
                    }
                    return acc;
                }, []);
                resolve(productosAgrupados);
            }
        });
    });
},
eliminarPresupuesto : (id) => {
    return new Promise((resolve, reject) => {
        conexion.getConnection((err, conexion) => {
            if (err) return reject(err);

            conexion.beginTransaction(err => {
                if (err) {
                    conexion.release();
                    return reject(err);
                }

                // Eliminar primero los items relacionados
                conexion.query(`
                    DELETE FROM items_presupuesto
                    WHERE presupuesto_id = ?
                `, [id], (error, resultados) => {
                    if (error) {
                        return conexion.rollback(() => {
                            conexion.release();
                            return reject(error);
                        });
                    }

                    // Luego eliminar el presupuesto
                    conexion.query(`
                        DELETE FROM presupuestos_mostrador
                        WHERE id = ?
                    `, [id], (error, result) => {
                        if (error) {
                            return conexion.rollback(() => {
                                conexion.release();
                                return reject(error);
                            });
                        }

                        if (result.affectedRows > 0) {
                            conexion.commit(err => {
                                if (err) {
                                    return conexion.rollback(() => {
                                        conexion.release();
                                        return reject(err);
                                    });
                                }
                                conexion.release();
                                resolve(result.affectedRows);
                            });
                        } else {
                            conexion.rollback(() => {
                                conexion.release();
                                reject(new Error('No se encontró el presupuesto para eliminar.'));
                            });
                        }
                    });
                });
            });
        });
    });
},
editarPresupuesto : (id, nombre_cliente, fecha, total, items) => {
    return new Promise((resolve, reject) => {
        conexion.getConnection((err, conexion) => {
            if (err) return reject(err);

            conexion.beginTransaction(err => {
                if (err) {
                    conexion.release();
                    return reject(err);
                }

                const updateFields = [];
                const updateValues = [];
                if (nombre_cliente !== undefined) {
                    updateFields.push('nombre_cliente = ?');
                    updateValues.push(nombre_cliente);
                }
                if (fecha !== undefined) {
                    updateFields.push('fecha = ?');
                    updateValues.push(fecha);
                }
                if (total !== undefined) {
                    updateFields.push('total = ?');
                    updateValues.push(total);
                }
                if (updateFields.length === 0) {
                    return reject(new Error('No fields to update'));
                }
                updateValues.push(id);

                const query = `UPDATE presupuestos_mostrador SET ${updateFields.join(', ')} WHERE id = ?`;

                conexion.query(query, updateValues, (error, resultados) => {
                    if (error) {
                        return conexion.rollback(() => {
                            conexion.release();
                            return reject(error);
                        });
                    }

                    const updates = items.map(item => {
                        return new Promise((resolve, reject) => {
                            const itemUpdateFields = [];
                            const itemUpdateValues = [];
                            if (item.producto_id !== undefined) {
                                itemUpdateFields.push('producto_id = ?');
                                itemUpdateValues.push(item.producto_id);
                            }
                            if (item.cantidad !== undefined) {
                                itemUpdateFields.push('cantidad = ?');
                                itemUpdateValues.push(item.cantidad);
                            }
                            if (item.precio_unitario !== undefined) {
                                itemUpdateFields.push('precio_unitario = ?');
                                itemUpdateValues.push(item.precio_unitario);
                            }
                            if (item.subtotal !== undefined) {
                                itemUpdateFields.push('subtotal = ?');
                                itemUpdateValues.push(item.subtotal);
                            }
                            itemUpdateValues.push(item.id, id);

                            const itemQuery = `UPDATE items_presupuesto SET ${itemUpdateFields.join(', ')} WHERE id = ? AND presupuesto_id = ?`;

                            conexion.query(itemQuery, itemUpdateValues, (error, result) => {
                                if (error) {
                                    return reject(error);
                                }
                                resolve(result);
                            });
                        });
                    });

                    Promise.all(updates)
                        .then(() => {
                            conexion.commit(err => {
                                if (err) {
                                    return conexion.rollback(() => {
                                        conexion.release();
                                        return reject(err);
                                    });
                                }
                                conexion.release();
                                resolve(resultados.affectedRows);
                            });
                        })
                        .catch(error => {
                            conexion.rollback(() => {
                                conexion.release();
                                return reject(error);
                            });
                        });
                });
            });
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
        conexion.query('SELECT productos.*, IFNULL(productos.costo_neto, 0) AS costo_neto, IFNULL(productos.costo_iva, 0) AS costo_iva, IFNULL(productos.utilidad, 0) AS utilidad, productos.precio_venta, imagenes_producto.id AS imagen_id, imagenes_producto.imagen FROM productos LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id WHERE productos.id = ?', [id], function(error, results, fields) {
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
},retornarDatosProveedores: function(conexion, productoId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT pp.proveedor_id, pp.codigo, pp.precio_lista, dp.descuento, p.costo_neto, p.costo_iva, p.utilidad, p.precio_venta
            FROM producto_proveedor AS pp
            INNER JOIN productos AS p ON pp.producto_id = p.id
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
        console.log('Eliminar imagen llamado con id:', id); 
        const sql = 'DELETE FROM imagenes_producto WHERE id = ?';
        conexion.query(sql, [id], function(err, results) {
            if (err) {
                console.log('Error al ejecutar la consulta SQL:', err); 
                return reject(err);
            }
            console.log('Resultados de la consulta SQL:', results); 
            resolve(results);
        });
    });
},
calcularNumeroDePaginas: function(conexion, productosPorPagina) {
    return new Promise((resolve, reject) => {
        // Cuenta todos los productos en la base de datos
        conexion.query('SELECT COUNT(*) AS total FROM productos', function(error, results, fields) {
            if (error) {
                reject(error);
            } else {
                const totalProductos = results[0].total;
                const numeroDePaginas = Math.ceil(totalProductos / productosPorPagina);
                resolve(numeroDePaginas);
            }
        });
    });
}
}