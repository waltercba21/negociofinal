const conexion = require('../config/conexion')
const pool = require('../config/conexion');
const util = require('util');
const path = require('path');

module.exports ={
    
    obtener: function (conexion, pagina, callback) {
        const offset = (pagina - 1) * 20;
        const consulta = `
          SELECT productos.*, GROUP_CONCAT(imagenes_producto.imagen) AS imagenes
          FROM productos
          LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id
          GROUP BY productos.id
          ORDER BY productos.id DESC
          LIMIT 20 OFFSET ?`;
      
        conexion.query(consulta, [offset], (error, resultados) => {
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
    obtenerUltimasOfertas: function(conexion, limite, callback) {
        const sql = `
          SELECT p.*, c.nombre AS categoria_nombre
          FROM productos p
          LEFT JOIN categorias c ON p.categoria_id = c.id
          WHERE p.oferta = 1
          ORDER BY p.id DESC
          LIMIT ?
        `;
        conexion.query(sql, [limite], callback);
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
    
    obtenerProductoIdPorCodigo: (codigo, nombre = null) => {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT p.id 
                FROM productos p
                INNER JOIN producto_proveedor pp ON p.id = pp.producto_id
                WHERE pp.codigo = ?
            `;
            const params = [codigo];
    
            // Si se proporciona un nombre, lo incluimos en la consulta
            if (nombre) {
                query += " AND p.nombre LIKE ?";
                params.push(`%${nombre}%`); // Busqueda parcial para evitar errores por espacios u otros caracteres
            }
    
            conexion.query(query, params, (error, resultados) => {
                if (error) {
                    console.error('❌ Error en la consulta SQL:', error);
                    reject(error);
                } else {
                    if (resultados.length > 0) {
                        console.log(`✅ Producto encontrado: ${JSON.stringify(resultados[0])}`);
                        resolve(resultados[0].id);
                    } else {
                        console.warn(`⚠️ Producto con código ${codigo} y nombre ${nombre} no encontrado.`);
                        resolve(null);
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
        if (typeof datos.calidad_vic !== 'undefined') {
            query += first ? "calidad_vic=?" : ", calidad_vic=?";
            params.push(datos.calidad_vic);
            first = false;
        }

        // 🔥🔥🔥 AÑADIR ACTUALIZACIÓN DEL CAMPO OFERTA 🔥🔥🔥
        if (typeof datos.oferta !== 'undefined') {
            query += first ? "oferta=?" : ", oferta=?";
            params.push(datos.oferta);
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

    console.log(`📌 Actualizando precios para proveedor ID: ${proveedorId}, Incremento: ${porcentajeCambio * 100}%`);

    if (isNaN(proveedorId) || isNaN(porcentajeCambio)) {
        console.error("❌ Error: proveedorId o porcentajeCambio no válido.");
        return callback(new Error("Datos inválidos"));
    }

    const query = `
        UPDATE producto_proveedor pp
        JOIN productos p ON pp.producto_id = p.id AND pp.proveedor_id = p.proveedor_id
        LEFT JOIN descuentos_proveedor dp ON pp.proveedor_id = dp.proveedor_id
        SET 
            pp.precio_lista = ROUND(pp.precio_lista * (1 + ?), 2),
            p.costo_neto = ROUND(pp.precio_lista - (pp.precio_lista * IFNULL(dp.descuento, 0) / 100), 2),
            p.costo_iva = ROUND((pp.precio_lista - (pp.precio_lista * IFNULL(dp.descuento, 0) / 100)) * 1.21, 2),
            p.precio_venta = ROUND(
                ((pp.precio_lista - (pp.precio_lista * IFNULL(dp.descuento, 0) / 100)) * 1.21)
                * (1 + p.utilidad / 100), 
                2
            )
        WHERE pp.proveedor_id = ?;
    `;

    const params = [porcentajeCambio, proveedorId];

    conexion.getConnection((err, conexion) => {
        if (err) {
            console.error('❌ Error al obtener la conexión:', err);
            return callback(err);
        }

        conexion.query(query, params, function (error, results) {
            conexion.release();

            if (error) {
                console.error('❌ Error en la consulta:', error);
                return callback(error);
            }

            console.log(`✅ ${results.affectedRows} productos actualizados para el proveedor ${proveedorId}`);
            callback(null, results.affectedRows);
        });
    });
},
actualizarPreciosPorProveedorConCalculo: async function (conexion, proveedorId, porcentaje, callback) {
    try {
        console.log(`🔧 Iniciando actualización completa para proveedor ID: ${proveedorId} con ${porcentaje * 100}%`);

        // 1. Obtener todos los productos del proveedor
        const queryProductos = `
            SELECT p.id, p.utilidad, pp.precio_lista, dp.descuento, pp.producto_id
            FROM producto_proveedor pp
            JOIN productos p ON p.id = pp.producto_id
            LEFT JOIN descuentos_proveedor dp ON pp.proveedor_id = dp.proveedor_id
            WHERE pp.proveedor_id = ?
        `;
        const [productos] = await conexion.promise().query(queryProductos, [proveedorId]);

        if (productos.length === 0) {
            return callback(null, 0);
        }

        let actualizados = 0;

        for (const prod of productos) {
            const nuevaLista = +(prod.precio_lista * (1 + porcentaje)).toFixed(2);
            const descuento = prod.descuento || 0;
            const utilidad = prod.utilidad || 0;

            const costo_neto = +(nuevaLista * (1 - descuento / 100)).toFixed(2);
            const costo_iva = +(costo_neto * 1.21).toFixed(2);
            const precio_venta = +(costo_iva * (1 + utilidad / 100)).toFixed(2);

            console.log(`➡ Producto ${prod.id}:`);
            console.log(`   Nueva lista: ${nuevaLista}`);
            console.log(`   Descuento: ${descuento}%`);
            console.log(`   Costo neto: ${costo_neto}`);
            console.log(`   Costo IVA: ${costo_iva}`);
            console.log(`   Utilidad: ${utilidad}%`);
            console.log(`   Precio final: ${precio_venta}`);

            const updateQuery = `
                UPDATE producto_proveedor SET precio_lista = ? 
                WHERE producto_id = ? AND proveedor_id = ?;
            `;
            await conexion.promise().query(updateQuery, [nuevaLista, prod.producto_id, proveedorId]);

            const updateProducto = `
                UPDATE productos SET 
                    costo_neto = ?, 
                    costo_iva = ?, 
                    precio_venta = ?
                WHERE id = ?;
            `;
            await conexion.promise().query(updateProducto, [costo_neto, costo_iva, precio_venta, prod.id]);

            actualizados++;
        }

        console.log(`✅ ${actualizados} productos actualizados correctamente.`);
        return callback(null, actualizados);
    } catch (err) {
        console.error('❌ Error al actualizar precios por proveedor con cálculo:', err);
        return callback(err);
    }
},
actualizarPreciosPDF: function (precio_lista, codigo, proveedor_id) {
    return new Promise((resolve, reject) => {
      if (typeof codigo !== 'string') {
        console.error(`El código del producto no es una cadena: ${codigo}`);
        resolve(null);
        return;
      }
  
      function redondearPrecioVenta(precio) {
        const resto = precio % 100;
        return resto < 50 ? precio - resto : precio + (100 - resto);
      }
  
      const sql = `SELECT pp.*, p.utilidad, p.nombre, dp.descuento 
                   FROM producto_proveedor pp 
                   JOIN productos p ON pp.producto_id = p.id 
                   JOIN descuentos_proveedor dp ON pp.proveedor_id = dp.proveedor_id 
                   WHERE pp.codigo = ? AND pp.proveedor_id = ?`;
  
      conexion.getConnection((err, conexion) => {
        if (err) {
          console.error('Error al obtener la conexión:', err);
          resolve(null);
          return;
        }
  
        conexion.query(sql, [codigo, proveedor_id], async (error, results) => {
          if (error) {
            console.error(`Error SQL para el código ${codigo}:`, error);
            conexion.release();
            resolve(null);
            return;
          }
  
          if (results.length === 0) {
            conexion.release();
            resolve(null);
            return;
          }
  
          const updatePromises = results.map(async producto => {
            const descuento = producto.descuento;
            const costo_neto = precio_lista - (precio_lista * descuento / 100);
            const costo_iva = costo_neto + (costo_neto * 0.21);
            const utilidad = producto.utilidad;
  
            const precio_venta = redondearPrecioVenta(costo_iva + (costo_iva * utilidad / 100));
  
            const sqlUpdateProductoProveedor = 'UPDATE producto_proveedor SET precio_lista = ? WHERE producto_id = ? AND codigo = ? AND proveedor_id = ?';
  
            return new Promise((resolveUpdate) => {
              conexion.query(sqlUpdateProductoProveedor, [precio_lista, producto.producto_id, codigo, producto.proveedor_id], async (err1) => {
                if (err1) {
                  console.error(`Error actualizando precio_lista para ${codigo}:`, err1);
                  return resolveUpdate(null);
                }
  
                // Verificar proveedor más barato
                try {
                  const proveedorMasBarato = await new Promise((res, rej) => {
                    const q = `
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
                    conexion.query(q, [producto.producto_id], (err, results) => {
                      if (err) rej(err);
                      else res(results[0]);
                    });
                  });
  
                  if (proveedorMasBarato.proveedor_id === producto.proveedor_id) {
                    const sqlUpdateProductos = 'UPDATE productos SET precio_venta = ? WHERE id = ?';
                    conexion.query(sqlUpdateProductos, [precio_venta, producto.producto_id], (err2) => {
                      if (err2) {
                        console.error(`Error actualizando precio_venta para ${codigo}:`, err2);
                        return resolveUpdate(null);
                      }
                      console.log(`✅ Precio de venta actualizado para ${codigo} con proveedor más barato ID ${proveedor_id}`);
                      resolveUpdate({
                        codigo,
                        producto_id: producto.producto_id,
                        precio_lista,
                        precio_venta
                      });
                    });
                  } else {
                    console.log(`🔁 Proveedor ${proveedor_id} NO es el más barato para ${codigo}. Precio no actualizado.`);
                    resolveUpdate({
                      codigo,
                      producto_id: producto.producto_id,
                      precio_lista,
                      sin_cambio: true
                    });
                  }
                } catch (errorInterno) {
                  console.error("❌ Error en la verificación del proveedor más barato:", errorInterno);
                  resolveUpdate(null);
                }
              });
            });
          });
  
          Promise.all(updatePromises).then((resultados) => {
            conexion.release();
            resolve(resultados.filter(p => p));
          }).catch((e) => {
            conexion.release();
            reject(e);
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
    actualizarStockPresupuesto: (productoId, cantidadVendida) => {
        return new Promise((resolve, reject) => {
            const query = 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?';
            conexion.query(query, [cantidadVendida, productoId], (error, resultado) => {
                if (error) {
                    console.error('Error al actualizar el stock:', error);
                    reject(error);
                } else {
                    console.log('Stock actualizado correctamente:', resultado);
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
obtenerProveedorMasBarato: async (conexion, productoId) => {
    return new Promise((resolve, reject) => {
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
      conexion.query(query, [productoId], (err, results) => {
        if (err) {
          console.error(`Error al obtener el proveedor más barato para el producto con ID ${productoId}:`, err);
          return reject(err);
        }
        resolve(results[0]);
      });
    });
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
},
obtenerCategorias: function(conexion) {
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
    let query = `
        SELECT * FROM productos
        WHERE categoria_id = ?
        ORDER BY id DESC
    `;
    
    conexion.query(query, [categoriaId], function(error, resultados) {
        if (error) {
            console.error('❌ Error en obtenerProductosPorCategoria:', error);
            return callback(error, null);
        }
        callback(null, resultados);
    });
},
obtenerTodosPaginados: function(conexion, pagina, productosPorPagina, callback) {
    const offset = (pagina - 1) * productosPorPagina;
    let query = `
        SELECT * FROM productos 
        ORDER BY id DESC 
        LIMIT ? OFFSET ?
    `;

    conexion.query(query, [productosPorPagina, offset], function(error, resultados) {
        if (error) {
            console.error("❌ Error al obtener todos los productos paginados:", error);
            return callback(error, null);
        }
        callback(null, resultados);
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
        let sql = 'SELECT productos.*, categorias.nombre as categoria_nombre, imagenes_producto.imagen as imagen, producto_proveedor.codigo, productos.stock_actual, productos.stock_minimo, productos.calidad_original FROM productos'; 
        sql += ' LEFT JOIN categorias ON productos.categoria_id = categorias.id';
        sql += ' LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id';
        sql += ' LEFT JOIN producto_proveedor ON productos.id = producto_proveedor.producto_id';
        sql += ' WHERE 1=1';
        const parametros = []; 
        
        // Añadir logs para cada filtro
        if (categoria) {
            sql += ' AND categoria_id = ?';
            parametros.push(categoria);
        }
        if (marca && marca !== '' && !isNaN(parseInt(marca))) {
            sql += ' AND marca_id = ?';
            parametros.push(parseInt(marca));
        }
        if (modelo && modelo !== '' && !isNaN(parseInt(modelo))) {
            sql += ' AND modelo_id = ?';
            parametros.push(parseInt(modelo));
        }
        if (busqueda_nombre && typeof busqueda_nombre === 'string') {
            const palabras = busqueda_nombre.split(' ');
            palabras.forEach(palabra => {
                if (palabra !== undefined && palabra !== null && palabra !== '') {
                    sql += ' AND (productos.nombre LIKE ? OR producto_proveedor.codigo LIKE ?)';
                    parametros.push('%' + palabra + '%', '%' + palabra + '%');
                }
            });
        }
        
        sql += ' ORDER BY productos.nombre ASC'; // Ordena los productos alfabéticamente
        if (limite && typeof limite === 'number' && limite > 0 && limite % 1 === 0) {
            sql += ' LIMIT ?';
            parametros.push(limite);
        }
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
obtenerImagenesProducto: function(conexion, ids) {
    return new Promise((resolve, reject) => {
        if (!ids || ids.length === 0) {
            return resolve([]); // Si no hay productos, devolvemos una lista vacía
        }

        let placeholders = ids.map(() => '?').join(', '); // Generar los placeholders correctos
        let query = `
            SELECT imagen, producto_id
            FROM imagenes_producto
            WHERE producto_id IN (${placeholders})
        `;

        conexion.query(query, ids, function(error, resultados) {
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
    WHERE p.oferta = 1
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
obtenerProductoConImagenes: (id_producto, callback) => {
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

    // Usar el pool de conexiones directamente
    pool.query(query, [id_producto], (error, resultados) => {
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