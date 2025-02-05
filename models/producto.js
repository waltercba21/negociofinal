const conexion = require('../config/conexion')
const util = require('util');
const path = require('path');

module.exports ={
    
    obtener: function (conexion, pagina, callback) {
        console.log('Entrando en el modelo obtener');
        console.log('Pagina:', pagina);
      
        const offset = (pagina - 1) * 20;
        const consulta = `
          SELECT productos.*, GROUP_CONCAT(imagenes_producto.imagen) AS imagenes
          FROM productos
          LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id
          GROUP BY productos.id
          ORDER BY productos.id DESC
          LIMIT 20 OFFSET ?`;
      
        conexion.query(consulta, [offset], (error, resultados) => {
          console.log('Resultados:', resultados);
          if (error) {
            callback(error);
            return;
          }
      
          const productos = resultados.map(resultado => {
            return {
              ...resultado,
              imagenes: resultado.imagenes ? resultado.imagenes.split(',') : []
            };
          });
      
          console.log('Productos obtenidos:', productos);
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
      obtenerSiguienteIDFactura: function() {
        return new Promise((resolve, reject) => {
            conexion.query('SELECT MAX(id) AS max_id FROM facturas_mostrador', (error, resultado) => {
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
    obtenerOfertas: function(conexion, callback) {
        const consulta = `
          SELECT p.*, GROUP_CONCAT(ip.imagen) AS imagenes
          FROM productos p
          LEFT JOIN imagenes_producto ip ON p.id = ip.producto_id
          WHERE p.oferta = 1
          GROUP BY p.id
        `;
        conexion.query(consulta, (error, resultados) => {
          if (error) {
            callback(error);
            return;
          }
          callback(null, resultados);
        });
      },
    eliminarPresupuesto : (conexion, id) => {
        return new Promise((resolve, reject) => {
            // Primero, eliminamos los ítems asociados al presupuesto
            conexion.query('DELETE FROM presupuesto_items WHERE presupuesto_id = ?', [id], (error, results) => {
                if (error) {
                    return reject(error);
                }
                // Luego, eliminamos el presupuesto en sí
                conexion.query('DELETE FROM presupuestos_mostrador WHERE id = ?', [id], (error, results) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve(results.affectedRows);
                });
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
    guardarFactura: (factura) => {
        return new Promise((resolve, reject) => {
            conexion.query('INSERT INTO facturas_mostrador SET ?', factura, (error, resultado) => {
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
            const query = 'INSERT INTO presupuesto_items (presupuesto_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ?';
            conexion.query(query, [items], (error, resultado) => {
                if (error) {
                    console.error('Error al insertar items del presupuesto:', error);
                    reject(error);
                } else {
                    resolve(resultado);
                }
            });
        });
    },
    guardarItemsFactura: (items) => {
        return new Promise((resolve, reject) => {
            const query = 'INSERT INTO factura_items (factura_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ?';
            
            conexion.query(query, [items], (error, resultado) => {
                if (error) {
                    console.error('Error al insertar items de la factura:', error);
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
    getAllFacturas: (fechaInicio, fechaFin) => {
        return new Promise((resolve, reject) => {
            const sqlQuery = `
                SELECT p.id, p.nombre_cliente, DATE_FORMAT(p.fecha, '%d/%m/%Y') AS fecha, 
                       p.total, p.metodos_pago 
                FROM facturas_mostrador p
                WHERE DATE(p.fecha) BETWEEN ? AND ?;
            `;
            conexion.query(sqlQuery, [fechaInicio, fechaFin], (error, resultados) => {
                if (error) {
                    reject(new Error('Error al obtener facturas: ' + error.message));
                } else {
                    const facturasFormateadas = resultados.map(factura => {
                        return {
                            ...factura,
                            total: new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0 }).format(factura.total) // Formatear el total
                        };
                    });
                    resolve(facturasFormateadas);
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
     obtenerItemsPresupuesto : (presupuestoId) => {
        return new Promise((resolve, reject) => {
          const query = `
            SELECT pi.cantidad, pi.precio_unitario, pi.subtotal, p.nombre as producto_nombre
            FROM presupuesto_items pi
            JOIN productos p ON pi.producto_id = p.id
            WHERE pi.presupuesto_id = ?
          `;
      
          conexion.query(query, [presupuestoId], (error, resultados) => {
            if (error) {
              reject(error);
            } else {
              resolve(resultados);
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
  eliminar: async (idOrIds) => {
    return new Promise((resolve, reject) => {
      const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
      const idList = ids.join(',');
  
      conexion.query(`DELETE FROM pedido_items WHERE producto_id IN (${idList})`, (error, results) => {
        if (error) {
          console.error("Error al eliminar de pedido_items:", error);
          return reject(error);
        }
  
        // Continuar con las demás eliminaciones
        conexion.query(`DELETE FROM estadisticas WHERE producto_id IN (${idList})`, (error, results) => {
          if (error) return reject(error);
          conexion.query(`DELETE FROM factura_items WHERE producto_id IN (${idList})`, (error, results) => {
            if (error) return reject(error);
            conexion.query(`DELETE FROM imagenes_producto WHERE producto_id IN (${idList})`, (error, results) => {
              if (error) return reject(error);
              conexion.query(`DELETE FROM items_presupuesto WHERE producto_id IN (${idList})`, (error, results) => {
                if (error) return reject(error);
                conexion.query(`DELETE FROM presupuesto_items WHERE producto_id IN (${idList})`, (error, results) => {
                  if (error) return reject(error);
                  conexion.query(`DELETE FROM presupuesto_productos WHERE producto_id IN (${idList})`, (error, results) => {
                    if (error) return reject(error);
                    conexion.query(`DELETE FROM producto_proveedor WHERE producto_id IN (${idList})`, (error, results) => {
                      if (error) return reject(error);
  
                      // Finalmente, eliminar los productos de la tabla productos
                      conexion.query(`DELETE FROM productos WHERE id IN (${idList})`, (error, results) => {
                        if (error) {
                          console.error("Error al eliminar de productos:", error);
                          return reject(error);
                        }
                        resolve(results);
                      });
                    });
                  });
                });
              });
            });
          });
        });
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
            first = false;
        }
        if (typeof datos.calidad_original !== 'undefined') {
            query += first ? "calidad_original=?" : ", calidad_original=?";
            params.push(datos.calidad_original);
            first = false;
        }
        // Campo VIC
        if (typeof datos.calidad_vic !== 'undefined') {
            query += first ? "calidad_vic=?" : ", calidad_vic=?";
            params.push(datos.calidad_vic);
            first = false;
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
        const querySelect = 'SELECT * FROM producto_proveedor WHERE producto_id = ? AND proveedor_id = ?';
        conexion.query(querySelect, [datosProductoProveedor.producto_id, datosProductoProveedor.proveedor_id], (error, results) => {
            if (error) {
                reject(error);
                return;
            }
            if (results.length > 0) {
                // Si ya existe una entrada, actualízala
                const queryUpdate = 'UPDATE producto_proveedor SET precio_lista = ?, codigo = ? WHERE producto_id = ? AND proveedor_id = ?';
                const paramsUpdate = [
                    datosProductoProveedor.precio_lista,
                    datosProductoProveedor.codigo,
                    datosProductoProveedor.producto_id,
                    datosProductoProveedor.proveedor_id
                ];
                conexion.query(queryUpdate, paramsUpdate, (error, results) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            } else {
                // Si no existe una entrada, crea una nueva
                const queryInsert = 'INSERT INTO producto_proveedor (producto_id, proveedor_id, precio_lista, codigo) VALUES (?, ?, ?, ?)';
                const paramsInsert = [
                    datosProductoProveedor.producto_id,
                    datosProductoProveedor.proveedor_id,
                    datosProductoProveedor.precio_lista,
                    datosProductoProveedor.codigo
                ];
                conexion.query(queryInsert, paramsInsert, (error, results) => {
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
                        callback(null);
                    }
                });
            }
        });
    }, 
    actualizarPreciosPDF: function (precio_lista, codigo, proveedor_id) {
        return new Promise((resolve, reject) => {
            if (typeof codigo !== 'string') {
                console.error(`El código del producto no es una cadena: ${codigo}`);
                resolve(null);
                return;
            }
            const sql = `SELECT pp.*, p.utilidad, p.precio_venta, p.nombre, dp.descuento 
                         FROM producto_proveedor pp 
                         JOIN productos p ON pp.producto_id = p.id 
                         JOIN descuentos_proveedor dp ON pp.proveedor_id = dp.proveedor_id 
                         WHERE pp.codigo = ? AND pp.proveedor_id = ?`; // Asegúrate de filtrar por proveedor
    
            conexion.getConnection((err, conexion) => {
                if (err) {
                    console.error('Error al obtener la conexión:', err);
                    resolve(null);
                    return;
                }
    
                // Cambiar los parámetros de la consulta
                conexion.query(sql, [codigo, proveedor_id], (error, results) => {
                    if (error) {
                        console.error(`Error al ejecutar la consulta SQL para el código ${codigo}:`, error);
                        conexion.release();
                        resolve(null);
                        return;
                    }
    
                    if (results.length === 0) {
                        conexion.release();
                        resolve(null);
                        return;
                    }
    
                    const updatePromises = results.map(producto => {
                        let descuento = producto.descuento;
                        let costo_neto = precio_lista - (precio_lista * descuento / 100);
                        let IVA = 21; 
                        let costo_iva = costo_neto + (costo_neto * IVA / 100);
                        let utilidad = producto.utilidad;
    
                        if (isNaN(costo_iva) || isNaN(utilidad)) {
                            console.error('Costo con IVA o utilidad no es un número válido');
                            return Promise.resolve(null);
                        }
    
                        let precio_venta = costo_iva + (costo_iva * utilidad / 100);
                        precio_venta = Math.ceil(precio_venta / 10) * 10;
    
                        const sqlUpdateProductoProveedor = 'UPDATE producto_proveedor SET precio_lista = ? WHERE producto_id = ? AND codigo = ? AND proveedor_id = ?'; // Asegúrate de actualizar por proveedor
                        const sqlUpdateProductos = 'UPDATE productos SET precio_venta = ? WHERE id = ?';
    
                        return new Promise((resolveUpdate, rejectUpdate) => {
                            conexion.query(sqlUpdateProductoProveedor, [precio_lista, producto.producto_id, codigo, producto.proveedor_id], (errorUpdatePP, resultsUpdatePP) => {
                                if (errorUpdatePP) {
                                    console.error('Error en la consulta SQL de actualización en producto_proveedor:', errorUpdatePP);
                                    resolveUpdate(null);
                                    return;
                                }
    
                                conexion.query(sqlUpdateProductos, [precio_venta, producto.producto_id], (errorUpdateProd, resultsUpdateProd) => {
                                    if (errorUpdateProd) {
                                        console.error('Error en la consulta SQL de actualización en productos:', errorUpdateProd);
                                        resolveUpdate(null);
                                    } else {
                                        resolveUpdate({
                                            codigo: codigo,
                                            nombre: producto.nombre, // Aquí se incluye el nombre del producto
                                            producto_id: producto.producto_id,
                                            precio_lista_antiguo: producto.precio_lista,
                                            precio_lista_nuevo: precio_lista,
                                            precio_venta: precio_venta
                                        });
                                    }
                                });
                            });
                        });
                    });
    
                    Promise.all(updatePromises).then(updatedProducts => {
                        conexion.release();
                        resolve(updatedProducts.filter(producto => producto !== null));
                    }).catch(err => {
                        console.error('Error al actualizar los productos:', err);
                        conexion.release();
                        resolve(null);
                    });
                });
            });
        });
    },    
    
obtenerProductoPorCodigo: function(codigo) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM producto_proveedor WHERE codigo = ?';
            conexion.getConnection((err, conexion) => {
                if (err) {
                    reject(err);
                } else {
                    conexion.query(sql, [codigo], (error, results) => {
                        conexion.release();
                        if (error) {
                            reject(error);
                        } else {
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
actualizarStockPresupuesto: (producto_id, cantidadVendida) => {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?';
        conexion.query(query, [cantidadVendida, producto_id], (error, resultado) => {
            if (error) {
                console.error('Error al actualizar el stock:', error);
                reject(error);
            } else {
                resolve(resultado);
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
obtenerProductosPorProveedorYCategoría: function (conexion, proveedor, categoria) {
    const query = `
        SELECT productos.*, producto_proveedor.codigo AS codigo_proveedor, producto_proveedor.precio_lista, productos.precio_venta
        FROM productos 
        INNER JOIN producto_proveedor ON productos.id = producto_proveedor.producto_id
        WHERE producto_proveedor.proveedor_id = ? 
        AND productos.categoria_id = ?
        ORDER BY productos.nombre ASC
    `;
    const queryPromise = util.promisify(conexion.query).bind(conexion);
    return queryPromise(query, [proveedor, categoria])
        .then(result => {
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
                resolve(resultados);
            }
        });
    });
},
obtenerProveedorMasBarato : async (conexion, productoId) => {
    try {
      const query = `
        SELECT 
          pp.proveedor_id,
          pp.precio_lista,
          dp.descuento,
          (pp.precio_lista * (1 - (dp.descuento / 100))) + (pp.precio_lista * 0.21) AS costo_iva
        FROM 
          producto_proveedor pp
        INNER JOIN 
          descuentos_proveedor dp ON pp.proveedor_id = dp.proveedor_id
        WHERE 
          pp.producto_id = ?
        ORDER BY 
          costo_iva ASC
        LIMIT 1
      `;
      const resultado = await conexion.query(query, [productoId]);
      return resultado[0];
    } catch (error) {
      console.error(`Error al obtener el proveedor más barato para el producto con ID ${productoId}:`, error);
      throw error;
    }
  },
obtenerMarcas: function(conexion) {
    return new Promise((resolve, reject) => {
        conexion.query('SELECT * FROM marcas ORDER BY nombre ASC', function(error, resultados) {
            if (error) {
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
                resolve(resultados);
            }
        });
    });
  },
obtenerModeloPorId: function (conexion, id, callback) {
  conexion.query('SELECT * FROM modelos WHERE id = ?', [id], function (error, resultados) {
      if (error) {
          callback(error, null);
      } else {
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
obtenerProductosPorProveedorYCategoria: function(conexion, proveedor, categoria) {
    let query = `
        SELECT 
            pp.codigo AS codigo_proveedor, 
            p.nombre, 
            pp.precio_lista, 
            p.precio_venta, 
            p.stock_minimo, 
            p.stock_actual
        FROM productos p
        INNER JOIN producto_proveedor pp ON p.id = pp.producto_id
        WHERE 1=1
    `;

    const params = [];
    if (proveedor && proveedor !== 'TODOS') {
        query += ` AND pp.proveedor_id = ?`;
        params.push(proveedor);
    }
    if (categoria && categoria !== 'TODAS') {
        query += ` AND p.categoria_id = ?`;
        params.push(categoria);
    }

    query += `
        ORDER BY LOWER(REGEXP_REPLACE(p.nombre, '^[0-9]+', '')) ASC
    `;

    const queryPromise = util.promisify(conexion.query).bind(conexion);
    return queryPromise(query, params);
},

obtenerProductosPorProveedorConStock: function(conexion, proveedor) {
    if (!proveedor) {
        const query = `
            SELECT pp.codigo AS codigo_proveedor, p.nombre, p.stock_minimo, p.stock_actual
            FROM productos p
            INNER JOIN producto_proveedor pp ON p.id = pp.producto_id
            WHERE 
                p.id NOT IN (
                    SELECT DISTINCT producto_id 
                    FROM producto_proveedor 
                    WHERE proveedor_id != pp.proveedor_id
                )
            ORDER BY LOWER(REGEXP_REPLACE(p.nombre, '^[0-9]+', '')) ASC
        `;
        const queryPromise = util.promisify(conexion.query).bind(conexion);
        return queryPromise(query)
            .then(result => {
                return result;
            })
            .catch(error => {
                throw error;
            });
    } else {
        const query = `
            SELECT pp.codigo AS codigo_proveedor, p.nombre, p.stock_minimo, p.stock_actual
            FROM productos p
            INNER JOIN producto_proveedor pp ON p.id = pp.producto_id
            WHERE 
                pp.proveedor_id = ? 
                AND (p.id, pp.precio_lista - (pp.precio_lista * p.descuentos_proveedor_id / 100) + (pp.precio_lista - (pp.precio_lista * p.descuentos_proveedor_id / 100)) * 0.21) 
                IN (
                    SELECT p2.id, MIN(pp2.precio_lista - (pp2.precio_lista * p2.descuentos_proveedor_id / 100) + (pp2.precio_lista - (pp2.precio_lista * p2.descuentos_proveedor_id / 100)) * 0.21)
                    FROM productos p2
                    INNER JOIN producto_proveedor pp2 ON p2.id = pp2.producto_id
                    GROUP BY p2.id
                )
            ORDER BY LOWER(REGEXP_REPLACE(p.nombre, '^[0-9]+', '')) ASC
        `;
        const queryPromise = util.promisify(conexion.query).bind(conexion);
        return queryPromise(query, [proveedor])
            .then(result => {
                return result;
            })
            .catch(error => {
                throw error;
            });
    }
},
obtenerProductosParaPedidoPorProveedorConStock: function(conexion, proveedor, categoria) {

    const query = `
        SELECT pp.codigo AS codigo_proveedor, p.nombre, p.stock_minimo, p.stock_actual, c.nombre AS categoria
        FROM productos p
        INNER JOIN producto_proveedor pp ON p.id = pp.producto_id
        INNER JOIN categorias c ON p.categoria_id = c.id
        WHERE ${proveedor ? 'pp.proveedor_id = ?' : '1=1'}
        ${categoria ? 'AND p.categoria_id = ?' : ''}
        AND p.stock_actual < p.stock_minimo
        ORDER BY LOWER(REGEXP_REPLACE(p.nombre, '^[0-9]+', '')) ASC
    `;

    const params = [];
    if (proveedor) params.push(proveedor);
    if (categoria) params.push(categoria);

    const queryPromise = util.promisify(conexion.query).bind(conexion);
    return queryPromise(query, params)
        .then(result => {
            return result;
        })
        .catch(error => {
            throw error;
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
obtenerPorFiltros: function(conexion, categoria, marca, modelo, busqueda_nombre, limite) {
    return new Promise((resolve, reject) => {
        let sql = `
            SELECT 
                p.id, p.nombre, p.precio_venta, p.stock_actual, p.stock_minimo, p.calidad_original, 
                c.nombre AS categoria_nombre, 
                pp.codigo, 
                GROUP_CONCAT(ip.imagen) AS imagenes
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN imagenes_producto ip ON p.id = ip.producto_id
            LEFT JOIN producto_proveedor pp ON p.id = pp.producto_id
            WHERE 1=1
        `;

        const parametros = [];

        if (categoria) {
            sql += ' AND p.categoria_id = ?';
            parametros.push(categoria);
        }
        if (marca) {
            sql += ' AND p.marca_id = ?';
            parametros.push(marca);
        }
        if (modelo) {
            sql += ' AND p.modelo_id = ?';
            parametros.push(modelo);
        }
        if (busqueda_nombre) {
            sql += ` AND (MATCH(p.nombre) AGAINST(?) OR MATCH(pp.codigo) AGAINST(?))`;
            parametros.push(busqueda_nombre, busqueda_nombre);
        }

        sql += ' GROUP BY p.id ORDER BY p.nombre ASC';

        if (limite) {
            sql += ' LIMIT ?';
            parametros.push(limite);
        }

        conexion.query(sql, parametros, (error, productos) => {
            if (error) {
                return reject(error);
            }

            // Transformar las imágenes en un array
            productos.forEach(producto => {
                producto.imagenes = producto.imagenes ? producto.imagenes.split(',').map(img => ({ imagen: img })) : [];
            });

            resolve(productos);
        });
    });
},


eliminarFactura: (id) => {
    return new Promise((resolve, reject) => {
        conexion.getConnection((err, conexion) => {
            if (err) return reject(err);

            conexion.beginTransaction(err => {
                if (err) {
                    conexion.release();
                    return reject(err); 
                }

                // Eliminar los items relacionados con la factura
                conexion.query(`
                    DELETE FROM factura_items
                    WHERE factura_id = ?
                `, [id], (error, resultados) => {
                    if (error) {
                        return conexion.rollback(() => {
                            conexion.release();
                            return reject(error);
                        });
                    }

                    // Eliminar la factura
                    conexion.query(`
                        DELETE FROM facturas_mostrador
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
                                reject(new Error('No se encontró la factura para eliminar.'));
                            });
                        }
                    });
                });
            });
        });
    });
},
obtenerDetallePresupuesto : (id) => {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT pm.id AS presupuesto_id, pm.nombre_cliente, pm.fecha, pm.total,
               p.nombre AS nombre_producto, pi.cantidad, pi.precio_unitario, pi.subtotal
        FROM presupuestos_mostrador pm
        LEFT JOIN presupuesto_items pi ON pm.id = pi.presupuesto_id
        LEFT JOIN productos p ON pi.producto_id = p.id
        WHERE pm.id = ?;
      `;
      conexion.query(query, [id], (error, resultados) => {
        if (error) {
          reject(error);
        } else if (resultados.length === 0) {
          reject(new Error("No se encontró el presupuesto"));
        } else {
          const presupuesto = resultados[0];
          const items = resultados.map(r => ({
            nombre_producto: r.nombre_producto,
            cantidad: r.cantidad,
            precio_unitario: r.precio_unitario,
            subtotal: r.subtotal
          }));
          resolve({ presupuesto, items });
        }
      });
    });
  },  
  obtenerDetalleFactura: (id) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT fm.id AS factura_id, fm.nombre_cliente, fm.fecha, fm.total,
                   p.nombre AS nombre_producto, fi.cantidad, fi.precio_unitario, fi.subtotal
            FROM facturas_mostrador fm
            LEFT JOIN factura_items fi ON fm.id = fi.factura_id
            LEFT JOIN productos p ON fi.producto_id = p.id
            WHERE fm.id = ?;
        `;

        conexion.query(query, [id], (error, resultados) => {
            if (error) {
                reject(error);
            } else if (resultados.length === 0) {
                reject(new Error("No se encontró la factura"));
            } else {
                const factura = {
                    id: resultados[0].factura_id,
                    nombre_cliente: resultados[0].nombre_cliente,
                    fecha: resultados[0].fecha,
                    total: resultados[0].total
                };

                // Si no hay items, devolvemos un array vacío.
                const items = resultados[0].nombre_producto ? resultados.map(r => ({
                    nombre_producto: r.nombre_producto,
                    cantidad: r.cantidad,
                    precio_unitario: r.precio_unitario,
                    subtotal: r.subtotal
                })) : [];

                resolve({ factura, items });
            }
        });
    });
},


editarPresupuesto : (id, nombre_cliente, fecha, total, items) => {
    return new Promise((resolve, reject) => {
        conexion.getConnection((err, conexion) => {
            if (err) {
                console.error('Error obteniendo conexión:', err);
                return reject(err);
            }

            conexion.beginTransaction(err => {
                if (err) {
                    console.error('Error iniciando transacción:', err);
                    conexion.release();
                    return reject(err);
                }

                const updateFields = [];
                const updateValues = [];
                if (nombre_cliente !== undefined && nombre_cliente !== '') {
                    updateFields.push('nombre_cliente = ?');
                    updateValues.push(nombre_cliente);
                }
                if (fecha !== undefined && fecha !== '') {
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
                                    console.error('Error ejecutando query de item:', error);
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
                                    console.error('Error al hacer commit:', err);
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
                            console.error('Error al actualizar items:', error);
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
editarFactura: (id, nombre_cliente, fecha, total, items) => {
    return new Promise((resolve, reject) => {
        conexion.getConnection((err, conexion) => {
            if (err) {
                console.error('Error obteniendo conexión:', err);
                return reject(err);
            }

            conexion.beginTransaction(err => {
                if (err) {
                    console.error('Error iniciando transacción:', err);
                    conexion.release();
                    return reject(err);
                }

                const updateFields = [];
                const updateValues = [];
                if (nombre_cliente !== undefined && nombre_cliente !== '') {
                    updateFields.push('nombre_cliente = ?');
                    updateValues.push(nombre_cliente);
                }
                if (fecha !== undefined && fecha !== '') {
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

                const query = `UPDATE facturas_mostrador SET ${updateFields.join(', ')} WHERE id = ?`;
                conexion.query(query, updateValues, (error, resultados) => {
                    if (error) {
                        console.error('Error ejecutando query de factura:', error);
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

                            const itemQuery = `UPDATE factura_items SET ${itemUpdateFields.join(', ')} WHERE id = ? AND factura_id = ?`;
                            conexion.query(itemQuery, itemUpdateValues, (error, result) => {
                                if (error) {
                                    console.error('Error ejecutando query de item:', error);
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
                                    console.error('Error al hacer commit:', err);
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
                            console.error('Error al actualizar items:', error);
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
                    resolve(producto);
                } else {
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
                resolve(resultados);
            }
        });
    });
},
asignarProveedorMasBarato:function(conexion, productoId, proveedorId) {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE productos SET proveedor_id = ? WHERE id = ?';
        conexion.query(query, [proveedorId, productoId], (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
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
eliminarProveedor: function(conexion, proveedorId, productoId) {
    return new Promise((resolve, reject) => {
        conexion.query('DELETE FROM producto_proveedor WHERE proveedor_id = ? AND producto_id = ?', [proveedorId, productoId], function(error, results, fields) {
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
        const sql = 'DELETE FROM imagenes_producto WHERE id = ?';
        conexion.query(sql, [id], function(err, results) {
            if (err) {
                return reject(err);
            }
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
},
obtenerProductosOferta: (conexion, callback) => {
    const query = `
        SELECT p.*, GROUP_CONCAT(i.imagen) AS imagenes
        FROM productos p
        LEFT JOIN imagenes_producto i ON p.id = i.producto_id
        WHERE p.oferta = TRUE
        GROUP BY p.id
    `;
    conexion.query(query, (error, results) => {
        if (error) {
            return callback(error);
        }
        // Procesar las imágenes
        results.forEach(producto => {
            if (producto.imagenes) {
                producto.imagenes = producto.imagenes.split(',');
            } else {
                producto.imagenes = [];
            }
        });
        callback(null, results);
    });
},
crearPedido: (proveedor_id, total) => {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO pedidos (proveedor_id, total) VALUES (?, ?)';
        conexion.query(sql, [proveedor_id, total], (err, result) => {
            if (err) reject(err);
            resolve(result.insertId); 
        });
    });
},
crearPedidoItem : (pedido_id, producto_id, cantidad, precio_unitario, subtotal) => {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)';
        conexion.query(sql, [pedido_id, producto_id, cantidad, precio_unitario, subtotal], (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
},
obtenerProductoConImagenes : (conexion, id_producto, callback) => {
    const query = `
        SELECT 
            p.id AS producto_id,
            p.nombre,
            p.descripcion,
            p.precio_venta,
            p.stock_actual,
            p.oferta,
            GROUP_CONCAT(i.imagen) AS imagenes
        FROM 
            productos p
        LEFT JOIN 
            imagenes_producto i ON p.id = i.producto_id
        WHERE 
            p.id = ?
        GROUP BY 
            p.id;
    `;

    conexion.query(query, [id_producto], (error, resultados) => {
        if (error) {
            callback(error, null);
        } else {
            if (resultados.length > 0) {
                const producto = resultados[0];
                producto.imagenes = producto.imagenes ? producto.imagenes.split(',') : [];
                callback(null, producto);
            } else {
                callback(null, null); // Producto no encontrado
            }
        }
    });
}
}