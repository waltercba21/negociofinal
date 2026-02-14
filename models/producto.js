const conexion = require('../config/conexion')
const pool = require('../config/conexion');
const util = require('util');
const path = require('path');

function isSet(v) {
  return typeof v !== 'undefined' && v !== null;
}
function parseDecimal(v, def = null) {
  if (!isSet(v)) return def;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : def;
}

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
    // Normalizar mínimo (no inventar cliente)
    if (factura && typeof factura === "object") {
      // Si por algún motivo viene vendedor vacío, lo limpiamos
      if (factura.vendedor != null && String(factura.vendedor).trim() === "") {
        factura.vendedor = null;
      }

      // Importante: NO autocompletar cliente_nombre acá
      // cliente_nombre debe ser NULL en "factura interna" y venir de ARCA luego
      if (factura.cliente_nombre != null && String(factura.cliente_nombre).trim() === "") {
        factura.cliente_nombre = null;
      }
    }

    conexion.query("INSERT INTO facturas_mostrador SET ?", factura, (error, resultado) => {
      if (error) return reject(error);
      resolve(resultado.insertId);
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
                SELECT p.id, p.nombre_cliente, p.fecha, p.total, p.creado_en
                FROM presupuestos_mostrador p
                WHERE DATE(p.fecha) BETWEEN ? AND ?
            `, [fechaInicio, fechaFin], (error, resultados) => {
                if (error) {
                    reject(new Error('Error al obtener presupuestos: ' + error.message));
                } else {
                    const presupuestosFormateados = resultados.map(presupuesto => {
                        const creadoUTC = new Date(presupuesto.creado_en);
                        const creadoArgentina = new Date(creadoUTC.getTime() - 3 * 60 * 60 * 1000);

                        return {
                            ...presupuesto,
                            fecha: new Date(presupuesto.fecha).toLocaleDateString('es-ES'),
                            hora: creadoArgentina.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
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
                SELECT 
                    p.id, 
                    p.nombre_cliente, 
                    p.fecha, 
                    p.total, 
                    p.metodos_pago,
                    p.creado_en
                FROM facturas_mostrador p
                WHERE DATE(p.fecha) BETWEEN ? AND ?
                ORDER BY p.fecha DESC, p.creado_en DESC;
            `;
    
            conexion.query(sqlQuery, [fechaInicio, fechaFin], (error, resultados) => {
                if (error) {
                    reject(new Error('Error al obtener facturas: ' + error.message));
                } else {
                    const facturasFormateadas = resultados.map(factura => {
                        const creadoUTC = new Date(factura.creado_en);
                        const creadoAR = new Date(creadoUTC.getTime() - 3 * 60 * 60 * 1000); // Ajuste UTC-3
    
                        return {
                            id: factura.id,
                            nombre_cliente: factura.nombre_cliente,
                            fecha: new Date(factura.fecha).toLocaleDateString('es-AR'),
                            hora: creadoAR.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
                            total: new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0 }).format(factura.total),
                            metodos_pago: factura.metodos_pago
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
    if (!isSet(datos.id)) {
      return reject(new Error('Los datos del producto deben incluir un ID'));
    }

    let query = "UPDATE productos SET ";
    const params = [];
    let first = true;

    const add = (sqlFrag, val) => {
      query += first ? sqlFrag : ", " + sqlFrag;
      params.push(val);
      first = false;
    };

    if (isSet(datos.nombre)) add("nombre=?", datos.nombre);

    // ✅ FIX: faltaba actualizar descripcion, por eso en EDITAR no se guardaba
    if (isSet(datos.descripcion)) add("descripcion=?", datos.descripcion);

    if (isSet(datos.codigo)) add("codigo=?", datos.codigo);
    if (isSet(datos.categoria_id)) add("categoria_id=?", datos.categoria_id);
    if (isSet(datos.marca_id)) add("marca_id=?", datos.marca_id);
    if (isSet(datos.modelo_id)) add("modelo_id=?", datos.modelo_id);

    if (isSet(datos.precio_venta)) add("precio_venta=?", parseDecimal(datos.precio_venta, 0));
    if (isSet(datos.utilidad)) add("utilidad=?", parseDecimal(datos.utilidad, 0));
    if (isSet(datos.descuentos_proveedor_id)) add("descuentos_proveedor_id=?", datos.descuentos_proveedor_id);
    if (isSet(datos.costo_neto)) add("costo_neto=?", parseDecimal(datos.costo_neto, 0));

    // IVA de referencia del producto (no confundir con iva por proveedor)
    if (isSet(datos.IVA)) add("IVA=?", parseDecimal(datos.IVA, 21));

    if (isSet(datos.costo_iva)) add("costo_iva=?", parseDecimal(datos.costo_iva, 0));
    if (isSet(datos.estado)) add("estado=?", datos.estado);
    if (isSet(datos.stock_minimo)) add("stock_minimo=?", parseInt(datos.stock_minimo, 10) || 0);
    if (isSet(datos.stock_actual)) add("stock_actual=?", parseInt(datos.stock_actual, 10) || 0);

    if (archivo && isSet(archivo.filename)) add("imagen=?", archivo.filename);

    if (isSet(datos.calidad_original)) add("calidad_original=?", datos.calidad_original ? 1 : 0);
    if (isSet(datos.calidad_vic)) add("calidad_vic=?", datos.calidad_vic ? 1 : 0);

    if (isSet(datos.proveedor_id)) add("proveedor_id=?", datos.proveedor_id);

    if (isSet(datos.oferta)) add("oferta=?", datos.oferta ? 1 : 0);

    query += " WHERE id=?";
    params.push(datos.id);

    if (first) {
      return resolve({ affectedRows: 0, warning: 'Sin campos para actualizar' });
    }

    conexion.query(query, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
},

 actualizarProductoProveedor: function (conexion, datos) {
    return new Promise((resolve, reject) => {
      const producto_id  = Number(datos.producto_id) || 0;
      const proveedor_id = Number(datos.proveedor_id) || 0;
      const precio_lista = parseDecimal(datos.precio_lista, 0);
      const codigo       = (typeof datos.codigo === 'string' && datos.codigo.trim() !== '') ? datos.codigo.trim() : null;
      const iva          = parseDecimal(datos.iva, 21);

      if (!producto_id || !proveedor_id) {
        return reject(new Error('producto_id y proveedor_id son obligatorios'));
      }

      const sql = `
        INSERT INTO producto_proveedor (producto_id, proveedor_id, precio_lista, codigo, iva)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          precio_lista = VALUES(precio_lista),
          codigo       = VALUES(codigo),
          iva          = VALUES(iva)
      `;
      const params = [producto_id, proveedor_id, precio_lista, codigo, iva];

      conexion.query(sql, params, (error, results) => {
        if (error) return reject(error);
        resolve(results);
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

    function redondearAlCentenar(valor) {
      let n = Number(valor) || 0;
      const resto = n % 100;
      n = (resto < 50) ? (n - resto) : (n + (100 - resto));
      return Math.ceil(n);
    }

    // 1) Traer productos del proveedor (incluye asignado + iva + presentacion)
    const queryProductos = `
      SELECT
        p.id,
        p.utilidad,
        p.proveedor_id AS proveedor_asignado,
        COALESCE(pp.iva, p.IVA, 21) AS iva_aplicado,
        LOWER(COALESCE(pp.presentacion, 'unidad')) AS presentacion,
        pp.precio_lista,
        COALESCE(dp.descuento, 0) AS descuento,
        pp.producto_id
      FROM producto_proveedor pp
      JOIN productos p ON p.id = pp.producto_id
      LEFT JOIN descuentos_proveedor dp ON pp.proveedor_id = dp.proveedor_id
      WHERE pp.proveedor_id = ?
    `;
    const [productos] = await conexion.promise().query(queryProductos, [proveedorId]);

    if (!productos || productos.length === 0) {
      return callback(null, 0);
    }

    let actualizadosPP = 0;
    let actualizadosProductos = 0;

    for (const prod of productos) {
      const precioListaBase = Number(prod.precio_lista || 0);
      if (!Number.isFinite(precioListaBase) || precioListaBase <= 0) {
        continue;
      }

      const nuevaLista = +(precioListaBase * (1 + porcentaje)).toFixed(2);

      const descuento = Number(prod.descuento || 0);
      const utilidad = Number(prod.utilidad || 0);

      const iva = Number(String(prod.iva_aplicado ?? 21).replace(',', '.')) || 21;

      const pres = (String(prod.presentacion || 'unidad').toLowerCase() === 'juego') ? 'juego' : 'unidad';
      const factor = (pres === 'juego') ? 0.5 : 1;

      // costo neto raw (como venís usando en editar.js)
      const costo_neto_raw = nuevaLista * (1 - (descuento / 100));
      const costo_neto_guardado = Math.ceil(costo_neto_raw);

      // costo IVA normalizado a UNIDAD (respeta presentacion + iva por proveedor)
      const costo_neto_unidad = costo_neto_raw * factor;
      const costo_iva_unidad = Math.ceil(costo_neto_unidad * (1 + (iva / 100)));

      const precio_venta_calc = costo_iva_unidad * (1 + utilidad / 100);
      const precio_venta = redondearAlCentenar(precio_venta_calc);

      // ✅ Siempre actualizar la lista del proveedor para ese producto
      const updatePP = `
        UPDATE producto_proveedor
           SET precio_lista = ?,
               costo_neto   = ?,
               costo_iva    = ?,
               actualizado_en = NOW()
         WHERE producto_id = ? AND proveedor_id = ?;
      `;
      await conexion.promise().query(updatePP, [
        nuevaLista,
        costo_neto_guardado,
        costo_iva_unidad,
        prod.producto_id,
        proveedorId
      ]);
      actualizadosPP++;

      // ✅ SOLO actualizar tabla productos si ESTE proveedor es el asignado del producto
      if (Number(prod.proveedor_asignado) === Number(proveedorId)) {
        const updateProducto = `
          UPDATE productos
             SET costo_neto   = ?,
                 costo_iva    = ?,
                 precio_venta = ?,
                 IVA          = ?
           WHERE id = ?;
        `;
        await conexion.promise().query(updateProducto, [
          costo_neto_guardado,
          costo_iva_unidad,
          precio_venta,
          iva,
          prod.id
        ]);
        actualizadosProductos++;
      }
    }

    console.log(`✅ producto_proveedor actualizados: ${actualizadosPP}`);
    console.log(`✅ productos actualizados (solo asignados): ${actualizadosProductos}`);

    // mantenemos el "count" como antes: cantidad procesada para ese proveedor
    return callback(null, actualizadosPP);

  } catch (err) {
    console.error('❌ Error al actualizar precios por proveedor con cálculo:', err);
    return callback(err);
  }
},

actualizarPreciosPDF: async function (precio_lista, codigo, proveedor_id) {
  try {
    if (typeof codigo !== 'string') return null;

    const precioListaNum = Number(precio_lista);
    if (!Number.isFinite(precioListaNum) || precioListaNum <= 0) return null;

    function redondearAlCentenar(valor) {
      let n = Number(valor) || 0;
      const resto = n % 100;
      n = (resto < 50) ? (n - resto) : (n + (100 - resto));
      return Math.ceil(n);
    }

    const buscarProductos = `
      SELECT 
        pp.producto_id,
        pp.codigo,
        LOWER(COALESCE(pp.presentacion,'unidad')) AS presentacion,
        COALESCE(pp.iva, p.IVA, 21) AS iva_aplicado,
        p.utilidad,
        p.nombre,
        p.precio_venta AS precio_venta_anterior,
        COALESCE(dp.descuento, 0) AS descuento
      FROM producto_proveedor pp
      JOIN productos p ON pp.producto_id = p.id
      LEFT JOIN descuentos_proveedor dp ON pp.proveedor_id = dp.proveedor_id
      WHERE pp.codigo = ? AND pp.proveedor_id = ?
    `;

    const conn = await conexion.promise().getConnection();
    try {
      const [results] = await conn.query(buscarProductos, [codigo, proveedor_id]);

      // si no existe, devolvemos null sin spamear logs (así tu controller lo lista como "nuevo")
      if (!results || results.length === 0) return null;

      const salidas = await Promise.all(results.map(async (row) => {
        const producto_id = Number(row.producto_id);
        const utilidad = Number(row.utilidad || 0);
        const descuento = Number(row.descuento || 0);
        const iva = Number(row.iva_aplicado || 21);

        const pres = (row.presentacion === 'juego') ? 'juego' : 'unidad';
        const factor = (pres === 'juego') ? 0.5 : 1;

        // costo neto sobre el precio_lista (raw)
        const costo_neto_raw = precioListaNum - (precioListaNum * descuento / 100);

        // normalizado a unidad (igual que tu editar.js)
        const costo_neto_unidad = costo_neto_raw * factor;
        const costo_iva_unidad = Math.ceil(costo_neto_unidad * (1 + iva / 100));

        const precio_venta_calc = costo_iva_unidad * (1 + utilidad / 100);
        const precio_venta = redondearAlCentenar(precio_venta_calc);

        // Guardamos costo_neto (raw, como venís manejando) y costo_iva por unidad
        const updatePrecioLista = `
          UPDATE producto_proveedor 
             SET precio_lista = ?,
                 costo_neto = ?,
                 costo_iva = ?,
                 actualizado_en = NOW()
           WHERE producto_id = ? AND proveedor_id = ? AND codigo = ?
        `;

        await conn.query(updatePrecioLista, [
          precioListaNum,
          Math.ceil(costo_neto_raw),   // igual que tu JS (ceil)
          costo_iva_unidad,            // por unidad
          producto_id,
          proveedor_id,
          codigo
        ]);

        // Comparar proveedor más barato (POR UNIDAD, respetando presentacion + iva)
        const compararProveedor = `
          SELECT 
            pp.proveedor_id,
            (
              (
                (pp.precio_lista - (pp.precio_lista * IFNULL(dp.descuento, 0) / 100))
                * (CASE 
                    WHEN LOWER(COALESCE(pp.presentacion,'unidad')) = 'juego' THEN 0.5
                    ELSE 1
                  END)
              )
              * (1 + (COALESCE(pp.iva, 21) / 100))
            ) AS costo_iva_unit
          FROM producto_proveedor pp
          LEFT JOIN descuentos_proveedor dp ON pp.proveedor_id = dp.proveedor_id
          WHERE pp.producto_id = ?
          ORDER BY costo_iva_unit ASC
          LIMIT 1
        `;

        const [res2] = await conn.query(compararProveedor, [producto_id]);
        if (!res2 || res2.length === 0) {
          return {
            codigo,
            nombre: row.nombre,
            producto_id,
            precio_lista: precioListaNum,
            precio_venta: 0,
            sin_cambio: true
          };
        }

        const proveedorMasBarato = res2[0];
        const esMasBarato = Number(proveedorMasBarato.proveedor_id) === Number(proveedor_id);

        if (esMasBarato) {
          await conn.query(`UPDATE productos SET precio_venta = ? WHERE id = ?`, [precio_venta, producto_id]);
          return {
            codigo,
            nombre: row.nombre,
            producto_id,
            precio_lista: precioListaNum,
            precio_venta,
            sin_cambio: false
          };
        }

        return {
          codigo,
          nombre: row.nombre,
          producto_id,
          precio_lista: precioListaNum,
          precio_venta: 0,
          sin_cambio: true
        };
      }));

      return salidas.filter(Boolean);

    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('❌ Error en actualizarPreciosPDF:', err);
    return null;
  }
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
ajustarStockPorOperacion: function(conexion, productoId, cantidad) {
    return new Promise((resolve, reject) => {
        const sql = `
            UPDATE productos
            SET stock_actual = stock_actual + ?
            WHERE id = ?
        `;
        conexion.query(sql, [cantidad, productoId], (error, results) => {
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
obtenerTodos: function (conexion, saltar, productosPorPagina, categoriaSeleccionada = null, proveedorSeleccionado = null) {
  // ✅ Compatibilidad con llamada vieja: obtenerTodos(conexion, callback)
  if (typeof saltar === 'function') {
    const cb = saltar;
    const sql = `SELECT id, nombre, imagen, precio_venta FROM productos ORDER BY id DESC`;
    return conexion.query(sql, cb);
  }

  return new Promise((resolve, reject) => {
    let consulta = `
      SELECT
        productos.*,
        categorias.nombre AS categoria,
        GROUP_CONCAT(
          imagenes_producto.imagen
          ORDER BY IFNULL(imagenes_producto.posicion, 999999), imagenes_producto.id
          SEPARATOR ','
        ) AS imagenes
      FROM productos
      LEFT JOIN categorias ON productos.categoria_id = categorias.id
      LEFT JOIN imagenes_producto ON productos.id = imagenes_producto.producto_id
    `;

    const where = [];
    const params = [];

    const catNum = Number(categoriaSeleccionada);
    if (Number.isFinite(catNum) && catNum > 0) {
      where.push(`productos.categoria_id = ?`);
      params.push(catNum);
    }

    const provNum = Number(proveedorSeleccionado);
    if (Number.isFinite(provNum) && provNum > 0) {
      // ✅ filtra por relación producto_proveedor (mismo criterio que /productos/api/buscar)
      where.push(`
        EXISTS (
          SELECT 1
          FROM producto_proveedor pp
          WHERE pp.producto_id = productos.id
            AND pp.proveedor_id = ?
        )
      `);
      params.push(provNum);
    }

    if (where.length) {
      consulta += ` WHERE ${where.join(' AND ')} `;
    }

    consulta += ` GROUP BY productos.id ORDER BY productos.id DESC LIMIT ?, ?`;
    params.push(Number(saltar) || 0, Number(productosPorPagina) || 30);

    conexion.query(consulta, params, (error, resultados) => {
      if (error) return reject(error);

      (resultados || []).forEach(p => {
        p.imagenes = p.imagenes ? String(p.imagenes).split(',') : [];
      });

      resolve(resultados || []);
    });
  });
},

obtenerProductosPorProveedorDetalle: async function (conexion, proveedorId, categoriaId = null) {
  let sql = `
    SELECT
      p.*,
      pp.codigo AS codigo_proveedor,
      pp.precio_lista,
      p.precio_venta
    FROM productos p
    INNER JOIN producto_proveedor pp
      ON p.id = pp.producto_id
    WHERE pp.proveedor_id = ?
  `;

  const params = [proveedorId];

  if (categoriaId && categoriaId !== 'TODAS' && categoriaId !== '') {
    sql += ` AND p.categoria_id = ? `;
    params.push(categoriaId);
  }

  sql += ` ORDER BY LOWER(REGEXP_REPLACE(p.nombre, '^[0-9]+', '')) ASC, p.nombre ASC `;

  const [rows] = await conexion.promise().query(sql, params);
  return rows;
},

// ✅ Alias temporal (para no romper nada si quedara alguna llamada vieja).
// Cuando confirmes que ya no se usa, lo eliminamos.
obtenerProductosPorProveedorYCategoría: function (conexion, proveedorId, categoriaId = null) {
  return this.obtenerProductosPorProveedorDetalle(conexion, proveedorId, categoriaId);
},

obtenerProveedores: function(conexion) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT proveedores.id, proveedores.nombre, dp.descuento
            FROM proveedores
            LEFT JOIN (
                SELECT proveedor_id, MAX(descuento) AS descuento
                FROM descuentos_proveedor
                GROUP BY proveedor_id
            ) AS dp ON proveedores.id = dp.proveedor_id
            ORDER BY proveedores.nombre ASC
        `;

        conexion.query(query, function(error, resultados) {
            if (error) {
                reject(error);
            } else {
                resolve(resultados);
            }
        });
    });
},
buscarPorProveedor: function (conexion, proveedorId, q) {
  return new Promise((resolve, reject) => {
    const like = `%${q}%`;

    const sql = `
      SELECT
        p.id,
        p.nombre,
        MAX(pp.codigo)       AS codigo,
        MAX(pp.precio_lista) AS precio_lista,
        MAX(pp.descuento)    AS descuento,
        MAX(pp.costo_neto)   AS costo_neto,
        MAX(pp.costo_iva)    AS costo_iva,
        MAX(pp.iva)          AS iva,
        MAX(pp.presentacion) AS presentacion,
        MAX(pp.factor_unidad) AS factor_unidad,
        GROUP_CONCAT(i.imagen) AS imagenes
      FROM productos p
      JOIN producto_proveedor pp
        ON pp.producto_id = p.id
       AND pp.proveedor_id = ?
      LEFT JOIN imagenes_producto i
        ON i.producto_id = p.id
      WHERE (p.nombre LIKE ? OR pp.codigo LIKE ?)
      GROUP BY p.id, p.nombre
      ORDER BY p.nombre ASC
      LIMIT 30
    `;

    conexion.query(sql, [proveedorId, like, like], (error, rows) => {
      if (error) return reject(error);

      rows.forEach(r => {
        r.imagenes = r.imagenes ? r.imagenes.split(',') : [];
      });

      resolve(rows);
    });
  });
},
obtenerPorFiltrosYProveedor: function (
  conexion,
  categoria_id,
  marca_id,
  modelo_id,
  busqueda_nombre,
  limite,
  proveedorId
) {
  return new Promise((resolve, reject) => {
    const params = [Number(proveedorId)];

    let sql = `
      SELECT
        p.id,
        p.nombre,
        p.descripcion,
        p.categoria_id,
        p.marca_id,
        p.modelo_id,
        p.proveedor_id,
        p.utilidad,
        p.estado,
        p.stock_actual,
        p.stock_minimo,
        p.oferta,
        p.calidad_original,
        p.calidad_vic,

        pp.codigo        AS codigo,
        pp.precio_lista  AS precio_lista,
        pp.descuento     AS descuento,
        pp.costo_neto    AS costo_neto,
        pp.costo_iva     AS costo_iva,
        pp.iva           AS iva,
        pp.presentacion  AS presentacion,
        pp.factor_unidad AS factor_unidad
      FROM productos p
      INNER JOIN producto_proveedor pp
        ON pp.producto_id = p.id
       AND pp.proveedor_id = ?
      WHERE 1=1
    `;

    if (categoria_id) { sql += ` AND p.categoria_id = ?`; params.push(Number(categoria_id)); }
    if (marca_id)     { sql += ` AND p.marca_id = ?`;     params.push(Number(marca_id)); }
    if (modelo_id)    { sql += ` AND p.modelo_id = ?`;    params.push(Number(modelo_id)); }

    // ✅ BUSCAR EN nombre + descripcion + codigo proveedor
    if (busqueda_nombre && String(busqueda_nombre).trim().length) {
      const raw = String(busqueda_nombre).trim().replace(/\s+/g, ' ');
      const tokens = raw.split(' ').map(t => t.trim()).filter(t => t.length >= 2);

      if (tokens.length) {
        sql += ` AND (`;
        tokens.forEach((t, idx) => {
          if (idx > 0) sql += ` AND `;
          sql += `(p.nombre LIKE ? OR p.descripcion LIKE ? OR pp.codigo LIKE ?)`;
          const likeTok = `%${t}%`;
          params.push(likeTok, likeTok, likeTok);
        });
        sql += `)`;
      }
    }

    sql += ` ORDER BY p.id DESC LIMIT ?`;
    params.push(Number(limite) || 100);

    conexion.query(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows || []);
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
        const consulta = 'SELECT * FROM marcas ORDER BY nombre ASC';

        conexion.query(consulta, function(error, resultados) {
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
obtenerProductosPorCategoria: function(conexion, categoriaId) {
  const query = `
    SELECT 
      p.id,                           -- ✅ necesario para deduplicar
      p.nombre, 
      p.stock_actual, 
      pp.codigo AS codigo
    FROM productos p
    LEFT JOIN producto_proveedor pp ON p.id = pp.producto_id
    WHERE p.categoria_id = ?
    ORDER BY p.nombre ASC
  `;
  return new Promise((resolve, reject) => {
    conexion.query(query, [categoriaId], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
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
obtenerProductosPorProveedorYCategoria: function (conexion, proveedor, categoria) {
  // Normalizo parámetros para facilitar las condiciones
  const prov = (!proveedor || proveedor === 'TODOS') ? null : proveedor;
  const cat  = (!categoria || categoria === 'TODAS') ? null : categoria;

  // Usamos LEFT JOIN para no excluir productos sin filas en producto_proveedor
  // y GROUP BY para tener una sola fila por producto cuando no se filtró proveedor.
  // MIN(pp.precio_lista) y MIN(pp.codigo) funcionan:
  //  - Si hay proveedor → solo queda ese proveedor por el WHERE, el MIN no cambia nada.
  //  - Si NO hay proveedor → trae todos los proveedores y toma el mínimo precio por producto.
  //    (Si preferís otra estrategia, ej. máximo o “cualquiera”, cambiás la agregación).
  let query = `
    SELECT
      p.id,
      p.nombre,
      MIN(pp.codigo)         AS codigo_proveedor,
      MIN(pp.precio_lista)   AS precio_lista,
      p.precio_venta,
      p.stock_minimo,
      p.stock_actual
    FROM productos p
    LEFT JOIN producto_proveedor pp
      ON pp.producto_id = p.id
    WHERE 1=1
      AND ( ? IS NULL OR pp.proveedor_id = ? )
      AND ( ? IS NULL OR p.categoria_id = ? )
    GROUP BY
      p.id, p.nombre, p.precio_venta, p.stock_minimo, p.stock_actual
    ORDER BY LOWER(REGEXP_REPLACE(p.nombre, '^[0-9]+', '')) ASC
  `;

  // Params: proveedor para las dos primeras ?, categoría para las dos siguientes ?
  const params = [prov, prov, cat, cat];

  const queryPromise = require('util').promisify(conexion.query).bind(conexion);
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

    // ✅ BUSCAR EN nombre + descripcion + codigo proveedor
    if (busqueda_nombre && typeof busqueda_nombre === 'string') {
      const palabras = busqueda_nombre.split(' ');
      palabras.forEach(palabra => {
        if (palabra !== undefined && palabra !== null && palabra !== '') {
          sql += ' AND (productos.nombre LIKE ? OR productos.descripcion LIKE ? OR producto_proveedor.codigo LIKE ?)';
          parametros.push('%' + palabra + '%', '%' + palabra + '%', '%' + palabra + '%');
        }
      });
    }
    
    sql += ' ORDER BY productos.nombre ASC';
    if (limite && typeof limite === 'number' && limite > 0 && limite % 1 === 0) {
      sql += ' LIMIT ?';
      parametros.push(limite);
    }

    conexion.query(sql, parametros, (error, productos) => {
      if (error) return reject(error);

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
            SELECT fm.id AS factura_id, fm.nombre_cliente, fm.fecha, fm.total, fm.creado_en,
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
                    total: resultados[0].total,
                    creado_en: resultados[0].creado_en // ✅ Aquí incluimos la hora
                };

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
    const sql = `
      SELECT
        productos.*,
        IFNULL(productos.costo_neto, 0) AS costo_neto,
        IFNULL(productos.costo_iva, 0) AS costo_iva,
        IFNULL(productos.utilidad, 0) AS utilidad,
        productos.precio_venta,
        imagenes_producto.id AS imagen_id,
        imagenes_producto.imagen
      FROM productos
      LEFT JOIN imagenes_producto
        ON productos.id = imagenes_producto.producto_id
      WHERE productos.id = ?
      -- ✅ FIX: respetar el orden guardado (posicion)
      ORDER BY IFNULL(imagenes_producto.posicion, 999999), imagenes_producto.id ASC
    `;

    conexion.query(sql, [id], function(error, results) {
      if (error) return reject(error);
      if (!results || results.length === 0) return resolve(null);

      const producto = results[0];

      // ✅ FIX: no inventar imagen por defecto; si no hay imagen, devolver []
      producto.imagenes = (results || [])
        .filter(r => !!r.imagen)
        .map(r => ({
          id: r.imagen_id,
          imagen: path.join('/uploads/productos', r.imagen)
        }));

      resolve(producto);
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
retornarDatosProveedores: function (conexion, producto_id) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        pp.producto_id,
        pp.proveedor_id,
        pp.precio_lista,
        pp.codigo,
        pp.iva,
        COALESCE(pp.presentacion, 'unidad') AS presentacion,
        COALESCE(pp.factor_unidad, 1.0)    AS factor_unidad,
        COALESCE(dp.descuento, 0.00)       AS descuento,
        pr.nombre AS proveedor_nombre
      FROM producto_proveedor pp
      JOIN proveedores pr 
        ON pr.id = pp.proveedor_id
      LEFT JOIN (
        SELECT proveedor_id, MAX(descuento) AS descuento
        FROM descuentos_proveedor
        GROUP BY proveedor_id
      ) dp
        ON dp.proveedor_id = pp.proveedor_id
      WHERE pp.producto_id = ?
      ORDER BY pr.nombre ASC, pp.proveedor_id ASC
    `;
    conexion.query(sql, [producto_id], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
},

eliminarProveedor: function (conexion, proveedorId, productoId) {
  const pid = Number(productoId) || 0;
  const prv = Number(proveedorId) || 0;

  if (!pid || !prv) {
    // entrada inválida: resolvemos coherentemente sin tocar DB
    return Promise.resolve({ affectedRows: 0 });
  }

  const sql = `
    DELETE FROM producto_proveedor
    WHERE producto_id = ? AND proveedor_id = ?
  `;
  const params = [pid, prv];

  // Soporta mysql2 (promises) y mysql (callbacks)
  if (conexion.promise && typeof conexion.promise === 'function') {
    return conexion.promise().query(sql, params).then(([result]) => result);
  }

  return new Promise((resolve, reject) => {
    conexion.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results); // results.affectedRows disponible
    });
  });
},
// models/producto.js (o donde esté)
insertarImagenProducto(conexion, { producto_id, imagen, posicion = null }) {
  const sql = `
    INSERT INTO imagenes_producto (producto_id, imagen, posicion)
    VALUES (?, ?, ?)
  `;
  return conexion.promise().query(sql, [producto_id, imagen, posicion]);
},
   obtenerProveedoresDeProducto: function (conexion, producto_id) {
    return new Promise((resolve, reject) => {
      const pid = Number(producto_id) || 0;
      if (!pid) return reject(new Error('producto_id inválido'));

      const sql = `
        SELECT
          pp.producto_id,
          pp.proveedor_id,
          pp.precio_lista,
          pp.codigo,
          pp.iva,
          pp.actualizado_en
        FROM producto_proveedor pp
        WHERE pp.producto_id = ?
        ORDER BY pp.proveedor_id ASC
      `;
      conexion.query(sql, [pid], (error, rows) => {
        if (error) return reject(error);
        resolve(rows || []);
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
calcularNumeroDePaginas: function (conexion, productosPorPagina, categoriaId = null, proveedorId = null) {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT COUNT(*) AS total FROM productos';
    const where = [];
    const params = [];

    const catNum = Number(categoriaId);
    if (Number.isFinite(catNum) && catNum > 0) {
      where.push('categoria_id = ?');
      params.push(catNum);
    }

    const provNum = Number(proveedorId);
    if (Number.isFinite(provNum) && provNum > 0) {
      where.push(`
        EXISTS (
          SELECT 1
          FROM producto_proveedor pp
          WHERE pp.producto_id = productos.id
            AND pp.proveedor_id = ?
        )
      `);
      params.push(provNum);
    }

    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    conexion.query(sql, params, (error, results) => {
      if (error) return reject(error);

      const total = results?.[0]?.total || 0;
      const pages = Math.max(1, Math.ceil(total / (Number(productosPorPagina) || 30)));
      resolve(pages);
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
},
obtenerProductosProveedorMasBaratoConStock: async function (conexion, proveedorId, categoriaId) {
  const util = require('util');
  try {
    let query = `
      SELECT 
        p.id, p.nombre,
        pp.codigo AS codigo_proveedor,
        p.stock_minimo, p.stock_actual
      FROM productos p
      JOIN producto_proveedor pp ON pp.producto_id = p.id
      JOIN descuentos_proveedor dp ON dp.proveedor_id = pp.proveedor_id
      WHERE
        pp.proveedor_id = COALESCE(
          p.proveedor_id,
          (
            SELECT sub_pp.proveedor_id
            FROM producto_proveedor sub_pp
            JOIN descuentos_proveedor sub_dp ON sub_pp.proveedor_id = sub_dp.proveedor_id
            WHERE sub_pp.producto_id = p.id
            ORDER BY (sub_pp.precio_lista * (1 - (sub_dp.descuento / 100))) * 1.21 ASC
            LIMIT 1
          )
        )
        AND (${proveedorId ? 'pp.proveedor_id = ?' : '1=1'})
        AND (${categoriaId && categoriaId !== 'TODAS' ? 'p.categoria_id = ?' : '1=1'})
        AND p.stock_actual < p.stock_minimo
      ORDER BY 
        LOWER(REGEXP_REPLACE(p.nombre, '^[0-9]+', '')) COLLATE utf8mb4_general_ci ASC,
        p.nombre ASC
    `;

    const params = [];
    if (proveedorId) params.push(proveedorId);
    if (categoriaId && categoriaId !== 'TODAS') params.push(categoriaId);

    const queryPromise = util.promisify(conexion.query).bind(conexion);
    return await queryPromise(query, params);
  } catch (error) {
    console.error("❌ Error en obtenerProductosProveedorMasBaratoConStock:", error);
    throw error;
  }
},

  obtenerProveedorMasBaratoPorProducto: async function (conexion, productoId) {
    const query = `
      SELECT pr.nombre AS proveedor_nombre, pp.codigo AS codigo_proveedor
      FROM producto_proveedor pp
      JOIN proveedores pr ON pr.id = pp.proveedor_id
      JOIN descuentos_proveedor dp ON pp.proveedor_id = dp.proveedor_id
      WHERE pp.producto_id = ?
      ORDER BY (pp.precio_lista * (1 - (dp.descuento / 100))) * 1.21 ASC
      LIMIT 1
    `;
    return new Promise((resolve, reject) => {
      conexion.query(query, [productoId], (err, results) => {
        if (err) return reject(err);
        resolve(results[0]); // { proveedor_nombre, codigo_proveedor }
      });
    });
  },
obtenerProductosAsignadosAlProveedor: async function (conexion, proveedorId, categoriaId) {
  try {
    // Armamos la consulta en una sola pieza para que el orden de parámetros sea claro:
    // 1) proveedorId para el subquery del código
    // 2) proveedorId para p.proveedor_id = ?
    // 3) proveedorId para el EXISTS (fallback cuando p.proveedor_id es NULL)
    let query = `
      SELECT
        p.id,
        p.nombre,
        COALESCE(p.stock_minimo, 0) AS stock_minimo,
        COALESCE(p.stock_actual, 0) AS stock_actual,
        (
          SELECT pp.codigo
          FROM producto_proveedor AS pp
          WHERE pp.producto_id = p.id
            AND pp.proveedor_id = ?
          LIMIT 1
        ) AS codigo_proveedor
      FROM productos AS p
      WHERE
        (
          p.proveedor_id = ?                                   -- ✅ estrictamente asignados al proveedor
          OR (
               p.proveedor_id IS NULL                          -- ✅ fallback: no asignado aún
               AND EXISTS (
                 SELECT 1
                 FROM producto_proveedor AS pp2
                 WHERE pp2.producto_id = p.id
                   AND pp2.proveedor_id = ?                    -- ...pero hay relación con el proveedor elegido
               )
             )
        )
    `;

    const params = [proveedorId, proveedorId, proveedorId];

    if (categoriaId && categoriaId !== 'TODAS' && categoriaId !== '') {
      query += ` AND p.categoria_id = ?`;
      params.push(categoriaId);
    }

    query += `
      ORDER BY LOWER(REGEXP_REPLACE(p.nombre, '^[0-9]+', '')) ASC, p.nombre ASC
    `;

    const [rows] = await conexion.promise().query(query, params);
    return rows;
  } catch (error) {
    console.error('❌ Error en obtenerProductosAsignadosAlProveedor:', error);
    return [];
  }
},

  obtenerProductosOfertaFiltrados: function (conexion, filtros, callback) {
    let sql = `
      SELECT p.*, c.nombre AS categoria_nombre, m.nombre AS marca_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN marcas m ON p.marca_id = m.id
      WHERE p.oferta = 1
    `;
    const params = [];
  
    if (filtros.categoria_id) {
      sql += " AND p.categoria_id = ?";
      params.push(filtros.categoria_id);
    }
  
    if (filtros.marca_id) {
      sql += " AND p.marca_id = ?";
      params.push(filtros.marca_id);
    }
  
    sql += " ORDER BY p.nombre ASC";
  
    conexion.query(sql, params, (error, resultados) => {
      if (error) {
        console.error("❌ Error al filtrar productos en oferta:", error);
        return callback(error, null);
      }
      callback(null, resultados);
    });
  },
obtenerProveedoresPorProducto: async (conexion, producto_id) => {
  const query = `
    SELECT pp.proveedor_id AS id, pp.codigo, pr.nombre AS proveedor_nombre
    FROM producto_proveedor pp
    JOIN proveedores pr ON pr.id = pp.proveedor_id
    WHERE pp.producto_id = ?
  `;
  return new Promise((resolve, reject) => {
    conexion.query(query, [producto_id], (error, resultados) => {
      if (error) reject(error);
      else resolve(resultados);
    });
  });
},

  obtenerHistorialPedidos: async function (conexion) {
    const query = `
      SELECT 
        pedidos.id AS pedido_id,
        pedidos.fecha,
        pedidos.total,
        proveedores.nombre AS proveedor
      FROM pedidos
      JOIN proveedores ON pedidos.proveedor_id = proveedores.id
      ORDER BY pedidos.fecha DESC
    `;
  
    try {
      const [rows] = await conexion.promise().query(query);
      return rows;
    } catch (error) {
      console.error('❌ Error al obtener historial de pedidos:', error);
      return [];
    }
  },
  obtenerHistorialPedidosFiltrado: async function (conexion, fechaDesde, fechaHasta, proveedorId) {
    let query = `
      SELECT 
        pedidos.id AS pedido_id,
        pedidos.fecha,
        pedidos.total,
        proveedores.nombre AS proveedor
      FROM pedidos
      JOIN proveedores ON pedidos.proveedor_id = proveedores.id
      WHERE 1 = 1
    `;
  
    const params = [];
  
    if (fechaDesde) {
      query += ' AND pedidos.fecha >= ?';
      params.push(fechaDesde);
    }
  
    if (fechaHasta) {
      query += ' AND pedidos.fecha <= ?';
      params.push(fechaHasta);
    }
  
    if (proveedorId) {
      query += ' AND pedidos.proveedor_id = ?';
      params.push(proveedorId);
    }
  
    query += ' ORDER BY pedidos.fecha DESC';
  
    try {
      const [rows] = await conexion.promise().query(query, params);
      return rows;
    } catch (error) {
      console.error('❌ Error al obtener historial filtrado:', error);
      return [];
    }
  }, 
  obtenerPedidoPorId: async function (conexion, pedidoId) {
  const sql = `SELECT id, proveedor_id, fecha, total FROM pedidos WHERE id = ? LIMIT 1`;
  const [rows] = await conexion.promise().query(sql, [pedidoId]);
  return rows?.[0] || null;
},
obtenerItemsPedido: async function (conexion, pedidoId, proveedorId) {
  const sql = `
    SELECT
      pi.producto_id AS id,
      p.nombre,
      pi.cantidad,
      pp.codigo,
      COALESCE(NULLIF(pp.costo_neto,0), p.costo_neto) AS costo_neto
    FROM pedido_items pi
    JOIN productos p ON p.id = pi.producto_id
    LEFT JOIN producto_proveedor pp
      ON pp.producto_id = pi.producto_id
     AND pp.proveedor_id = ?
    WHERE pi.pedido_id = ?
    ORDER BY p.nombre ASC
  `;
  const [rows] = await conexion.promise().query(sql, [proveedorId, pedidoId]);
  return rows || [];
},

upsertPedido: function (conexion, pedido, items) {
  return new Promise((resolve, reject) => {
    const getCx = (cb) => {
      if (conexion && typeof conexion.getConnection === 'function') return conexion.getConnection(cb); // pool
      return cb(null, conexion); // conexión directa
    };

    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

    // items pueden venir como arg o dentro del pedido (pedido.productos)
    let lista = items ?? pedido?.productos ?? pedido?.items ?? [];
    if (typeof lista === 'string') { try { lista = JSON.parse(lista); } catch { lista = []; } }
    if (!Array.isArray(lista)) lista = [];

    const proveedor_id = Number(pedido?.proveedor_id ?? pedido?.proveedorId ?? 0) || 0;

    // ✅ pedido_id viene del frontend como "pedido_id"
    let pedido_id = Number(pedido?.id ?? pedido?.pedido_id ?? pedido?.pedidoId ?? 0) || null;

    if (!proveedor_id) return reject(new Error('proveedor_id inválido'));

    // ✅ producto_id en el frontend viene como "id"
    const normItems = lista
      .filter(it => it && (it.producto_id != null || it.id_producto != null || it.id != null))
      .map(it => {
        const producto_id = Number(it.producto_id ?? it.id_producto ?? it.id) || 0;
        const cantidad = parseInt(it.cantidad, 10) > 0 ? parseInt(it.cantidad, 10) : 1;

        // precio unitario: en tu pedido manual es costo_neto
        const precio_unitario = round2(it.precio_unitario ?? it.costo_neto ?? 0);
        const subtotal = round2(precio_unitario * cantidad);

        return { producto_id, cantidad, precio_unitario, subtotal };
      })
      .filter(it => it.producto_id > 0);

    if (!normItems.length) {
      return reject(new Error('El pedido llegó sin productos (revisar keys: se espera productos[].id)'));
    }

    // total: usá el que manda el front si existe, sino recalculá
    const totalReq = Number(pedido?.total);
    const total = Number.isFinite(totalReq) && totalReq > 0
      ? round2(totalReq)
      : round2(normItems.reduce((acc, it) => acc + it.subtotal, 0));

    getCx((err, cx) => {
      if (err) return reject(err);
      if (!cx || typeof cx.beginTransaction !== 'function') {
        return reject(new Error('No se pudo obtener una conexión con beginTransaction()'));
      }

      const release = () => { if (typeof cx.release === 'function') cx.release(); };

      const rollback = (e) => cx.rollback(() => { release(); reject(e); });
      const commit = () => cx.commit((e) => {
        if (e) return rollback(e);
        release();
        resolve({ ok: true, pedido_id, total });
      });

      cx.beginTransaction((e) => {
        if (e) { release(); return reject(e); }

        const sqlPedido = pedido_id
          ? `UPDATE pedidos SET proveedor_id=?, total=? WHERE id=?`
          : `INSERT INTO pedidos (proveedor_id, total) VALUES (?, ?)`;

        const paramsPedido = pedido_id
          ? [proveedor_id, total, pedido_id]
          : [proveedor_id, total];

        cx.query(sqlPedido, paramsPedido, (e2, rPedido) => {
          if (e2) return rollback(e2);

          if (!pedido_id) pedido_id = rPedido.insertId;

          cx.query(`DELETE FROM pedido_items WHERE pedido_id=?`, [pedido_id], (e3) => {
            if (e3) return rollback(e3);

            const values = normItems.map(it => ([
              pedido_id,
              it.producto_id,
              it.cantidad,
              it.precio_unitario,
              it.subtotal
            ]));

            cx.query(
              `INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES ?`,
              [values],
              (e4) => {
                if (e4) return rollback(e4);
                commit();
              }
            );
          });
        });
      });
    });
  });
},

  obtenerDetallePedido: (pedidoId) => {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          p.nombre AS producto,
          pi.cantidad,
          p.costo_neto AS costo_unitario,  -- ← Lo traemos desde la tabla productos
          pi.subtotal,
          ped.fecha,
          prov.nombre AS proveedor,
          pp.codigo AS codigo_proveedor
        FROM pedidos ped
        JOIN pedido_items pi ON ped.id = pi.pedido_id
        JOIN productos p ON pi.producto_id = p.id
        JOIN proveedores prov ON ped.proveedor_id = prov.id
        LEFT JOIN producto_proveedor pp 
          ON pp.producto_id = p.id AND pp.proveedor_id = ped.proveedor_id
        WHERE ped.id = ?
      `;
      conexion.query(sql, [pedidoId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },
 eliminarPedido: async function (conexion, pedidoId) {
  const conn = await conexion.promise().getConnection();
  try {
    await conn.beginTransaction();

    // 1️⃣ Eliminar los items del pedido
    await conn.query(
      `DELETE FROM pedido_items WHERE pedido_id = ?`,
      [pedidoId]
    );

    // 2️⃣ Eliminar el pedido
    const [result] = await conn.query(
      `DELETE FROM pedidos WHERE id = ?`,
      [pedidoId]
    );

    await conn.commit();
    return result.affectedRows;
  } catch (error) {
    await conn.rollback();
    console.error('❌ Error al eliminar el pedido:', error);
    throw error;
  } finally {
    conn.release();
  }
},
obtenerProductosPorCategoriaYProveedorMasBarato: async function (conexion, proveedorId, categoriaId) {
  const util = require('util');
  try {
    const query = `
      SELECT 
        p.id, p.nombre,
        pp.codigo AS codigo_proveedor,
        p.stock_minimo, p.stock_actual
      FROM productos p
      JOIN producto_proveedor pp ON pp.producto_id = p.id
      JOIN descuentos_proveedor dp ON pp.proveedor_id = dp.proveedor_id
      WHERE 
        p.categoria_id = ?
        AND pp.proveedor_id = COALESCE(
          p.proveedor_id,
          (
            SELECT sub_pp.proveedor_id
            FROM producto_proveedor sub_pp
            JOIN descuentos_proveedor sub_dp ON sub_pp.proveedor_id = sub_dp.proveedor_id
            WHERE sub_pp.producto_id = p.id
            ORDER BY (sub_pp.precio_lista * (1 - (sub_dp.descuento / 100))) * 1.21 ASC
            LIMIT 1
          )
        )
        AND pp.proveedor_id = ?
      ORDER BY LOWER(p.nombre) ASC
    `;
    const queryPromise = util.promisify(conexion.query).bind(conexion);
    return await queryPromise(query, [categoriaId, proveedorId]);
  } catch (error) {
    console.error("❌ Error en obtenerProductosPorCategoriaYProveedorMasBarato:", error);
    throw error;
  }
},

obtenerProductosPorCategoriaPaginado(conexion, categoriaId, offset, limit) {
  return new Promise((resolve, reject) => {
    // ① Productos
    const sqlProductos = `
      SELECT p.*, c.nombre   AS categoria_nombre,
             GROUP_CONCAT(i.imagen) AS imagenes
      FROM productos p
      LEFT JOIN categorias        c ON p.categoria_id = c.id
      LEFT JOIN imagenes_producto i ON p.id = i.producto_id
      WHERE p.categoria_id = ?
      GROUP BY p.id
      ORDER BY p.id DESC 
      LIMIT ? OFFSET ?`;
    // ② Total para paginador
    const sqlTotal = `SELECT COUNT(*) AS total FROM productos WHERE categoria_id = ?`;

    conexion.query(sqlProductos, [categoriaId, limit, offset], (err, productos) => {
      if (err) return reject(err);

      // Convertimos la cadena de imágenes a array
      productos.forEach(p =>
        p.imagenes = p.imagenes ? p.imagenes.split(',') : []
      );

      conexion.query(sqlTotal, [categoriaId], (err2, totalRows) => {
        if (err2) return reject(err2);
        resolve({ productos, total: totalRows[0].total });
      });
    });
  });
},
obtenerMasVendidos: function (
  conexion,
  { categoria_id = null, desde = null, hasta = null, ids = null, limit = 100 }
) {
  return new Promise((resolve, reject) => {
    const filtros = [];
    const params = [];

    // Categoría
    const cat = parseInt(categoria_id, 10);
    if (!Number.isNaN(cat) && cat > 0) {
      filtros.push(`p.categoria_id = ?`);
      params.push(cat);
    }

    // Fechas (YYYY-MM-DD)
    const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
    const d1 = isDate(desde) ? desde : null;
    const d2 = isDate(hasta) ? hasta : null;

    if (d1 && d2) { filtros.push(`v.fecha BETWEEN ? AND ?`); params.push(d1, d2); }
    else if (d1)  { filtros.push(`v.fecha >= ?`);           params.push(d1); }
    else if (d2)  { filtros.push(`v.fecha <= ?`);           params.push(d2); }

    // IDs prefiltrados por texto (si vinieron)
    const idList = Array.isArray(ids)
      ? ids.map(n => parseInt(n, 10)).filter(Number.isInteger).slice(0, 500)
      : null;

    if (idList && idList.length) {
      filtros.push(`p.id IN (${idList.map(() => '?').join(',')})`);
      params.push(...idList);
    }

    const whereSQL = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 100, 500));

    const sql = `
      SELECT
        p.id,
        p.nombre,
        p.precio_venta,
        p.stock_actual,
        p.stock_minimo,
        SUM(v.cantidad) AS total_vendido
      FROM (
        /* FACTURAS */
        SELECT fi.producto_id, fi.cantidad, fm.fecha
        FROM factura_items fi
        INNER JOIN facturas_mostrador fm ON fm.id = fi.factura_id

        UNION ALL

        /* PRESUPUESTOS */
        SELECT pi.producto_id, pi.cantidad, pm.fecha
        FROM presupuesto_items pi
        INNER JOIN presupuestos_mostrador pm ON pm.id = pi.presupuesto_id
      ) v
      INNER JOIN productos p ON p.id = v.producto_id
      ${whereSQL}
      GROUP BY p.id, p.nombre, p.precio_venta, p.stock_actual, p.stock_minimo
      ORDER BY total_vendido DESC
      LIMIT ${safeLimit}
    `;

    conexion.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
},
// Inserta búsqueda de texto
insertarBusquedaTexto: function (conexion, { q, origen, user_id, ip }) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO busquedas_texto (q, origen, user_id, ip) VALUES (?, ?, ?, ?)`;
    conexion.query(sql, [q, origen || 'texto', user_id, ip], (err, r) => err ? reject(err) : resolve(r.insertId));
  });
},
insertarBusquedaProducto: function (conexion, { producto_id, q, user_id, ip }) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO busquedas_producto (producto_id, q, user_id, ip) VALUES (?, ?, ?, ?)`;
    conexion.query(sql, [producto_id, q, user_id, ip], (err, r) => err ? reject(err) : resolve(r.insertId));
  });
},
obtenerMasBuscadosDetallado: function (
  conexion,
  { categoria_id = null, desde = null, hasta = null, limit = 50, weightText = 0.3 }
) {
  return new Promise((resolve, reject) => {
    const filtrosClicks = [];
    const pcParams = [];
    const filtrosText = [];
    const ptParams = [];
    const filtrosOuter = [];
    const outerParams = [];

    const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
    const d1 = isDate(desde) ? desde : null;
    const d2 = isDate(hasta) ? hasta : null;

    // Fechas para clicks y texto
    if (d1 && d2) {
      filtrosClicks.push(`bp.created_at BETWEEN ? AND ?`);
      pcParams.push(d1, d2);
      filtrosText.push(`bt.created_at BETWEEN ? AND ?`);
      ptParams.push(d1, d2);
    } else if (d1) {
      filtrosClicks.push(`bp.created_at >= ?`);
      pcParams.push(d1);
      filtrosText.push(`bt.created_at >= ?`);
      ptParams.push(d1);
    } else if (d2) {
      filtrosClicks.push(`bp.created_at <= ?`);
      pcParams.push(d2);
      filtrosText.push(`bt.created_at <= ?`);
      ptParams.push(d2);
    }

    // Categoría (se aplica en el outer)
    const catNum = parseInt(categoria_id, 10);
    if (!Number.isNaN(catNum) && catNum > 0) {
      filtrosOuter.push(`p.categoria_id = ?`);
      outerParams.push(catNum);
    }

    const whereClicks = filtrosClicks.length ? `WHERE ${filtrosClicks.join(' AND ')}` : '';
    const whereText   = filtrosText.length   ? `WHERE ${filtrosText.join(' AND ')}`   : '';
    const whereOuter  = filtrosOuter.length  ? `WHERE ${filtrosOuter.join(' AND ')}`  : '';

    // Subselect + WHERE por total_buscado (evita errores en HAVING)
    // Collate unificado para evitar "Illegal mix of collations" en LIKE
    const sql = `
      SELECT *
      FROM (
        SELECT
          p.id,
          p.nombre,
          p.precio_venta,
          p.stock_actual,                -- 👈 para "sugerido"
          p.stock_minimo,                -- 👈 para "sugerido"
          COALESCE(pc.clicks, 0)  AS clicks,
          COALESCE(pt.textos, 0)  AS textos,
          (COALESCE(pc.clicks, 0) + (? * COALESCE(pt.textos, 0))) AS total_buscado,
          COALESCE(vv.ventas, 0)  AS ventas
        FROM productos p
        LEFT JOIN (
          SELECT bp.producto_id, COUNT(*) AS clicks
          FROM busquedas_producto bp
          ${whereClicks}
          GROUP BY bp.producto_id
        ) pc ON pc.producto_id = p.id
        LEFT JOIN (
          SELECT p2.id AS producto_id, COUNT(*) AS textos
          FROM busquedas_texto bt
          INNER JOIN productos p2
            ON p2.nombre COLLATE utf8mb4_general_ci
               LIKE CONCAT('%', REPLACE(bt.q COLLATE utf8mb4_general_ci, ' ', '%'), '%')
          ${whereText}
          GROUP BY p2.id
        ) pt ON pt.producto_id = p.id
        LEFT JOIN (
          /* Ventas (facturas + presupuestos) en el período */
          SELECT v.producto_id, SUM(v.cantidad) AS ventas
          FROM (
            SELECT fi.producto_id, fi.cantidad, fm.fecha
            FROM factura_items fi
            INNER JOIN facturas_mostrador fm ON fm.id = fi.factura_id
            ${d1 || d2 ? `WHERE fm.fecha ${d1 && d2 ? 'BETWEEN ? AND ?' : d1 ? '>= ?' : '<= ?'}` : ''}

            UNION ALL

            SELECT pi.producto_id, pi.cantidad, pm.fecha
            FROM presupuesto_items pi
            INNER JOIN presupuestos_mostrador pm ON pm.id = pi.presupuesto_id
            ${d1 || d2 ? `WHERE pm.fecha ${d1 && d2 ? 'BETWEEN ? AND ?' : d1 ? '>= ?' : '<= ?'}` : ''}
          ) v
          GROUP BY v.producto_id
        ) vv ON vv.producto_id = p.id
        ${whereOuter}
      ) x
      WHERE x.total_buscado > 0
      ORDER BY x.total_buscado DESC
      LIMIT ${Number(limit) || 50}
    `;

    // parámetros en orden
    const w = Number(weightText) || 0.3;
    const params = [w, ...pcParams, ...ptParams];

    // Fechas para subconsulta de ventas (dos apariciones: facturas y presupuestos)
    if (d1 && d2) params.push(d1, d2, d1, d2);
    else if (d1) params.push(d1, d1);
    else if (d2) params.push(d2, d2);

    // Categoría al final (outer)
    params.push(...outerParams);

    conexion.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
},
// Ventas (unidades) de un producto en un período (facturas + presupuestos)
obtenerVentasDeProducto: function (
  conexion,
  { producto_id, desde = null, hasta = null, agruparPor = null } // agruparPor: 'dia' | null
) {
  return new Promise((resolve, reject) => {
    const pid = parseInt(producto_id, 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      return reject(new Error('producto_id inválido'));
    }

    const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
    const d1 = isDate(desde) ? desde : null;
    const d2 = isDate(hasta) ? hasta : null;

    const filtros = [`v.producto_id = ?`];
    const params = [pid];

    if (d1 && d2) { filtros.push(`v.fecha BETWEEN ? AND ?`); params.push(d1, d2); }
    else if (d1) { filtros.push(`v.fecha >= ?`); params.push(d1); }
    else if (d2) { filtros.push(`v.fecha <= ?`); params.push(d2); }

    const whereSQL = `WHERE ${filtros.join(' AND ')}`;

    // subconsulta unifica facturas + presupuestos
    const base = `
      FROM (
        SELECT fi.producto_id, fi.cantidad, fm.fecha
        FROM factura_items fi
        INNER JOIN facturas_mostrador fm ON fm.id = fi.factura_id

        UNION ALL

        SELECT pi.producto_id, pi.cantidad, pm.fecha
        FROM presupuesto_items pi
        INNER JOIN presupuestos_mostrador pm ON pm.id = pi.presupuesto_id
      ) v
      ${whereSQL}
    `;

    // si pedís agrupación por día
    if (agruparPor === 'dia') {
      const sql = `
        SELECT DATE(v.fecha) AS dia, SUM(v.cantidad) AS unidades
        ${base}
        GROUP BY DATE(v.fecha)
        ORDER BY dia ASC
      `;
      return conexion.query(sql, params, (err, rows) => (err ? reject(err) : resolve({
        detalle: rows,
        total: rows.reduce((acc, r) => acc + Number(r.unidades || 0), 0)
      })));
    }

    // total simple
    const sqlTotal = `
      SELECT SUM(v.cantidad) AS total_unidades
      ${base}
    `;
    conexion.query(sqlTotal, params, (err, rows) => {
      if (err) return reject(err);
      const total = Number(rows?.[0]?.total_unidades || 0);
      resolve({ total });
    });
  });
},
// Búsquedas de un producto específico en un período
obtenerBusquedasDeProducto: function (
  conexion,
  { producto_id, desde = null, hasta = null, weightText = 0.3 }
) {
  return new Promise((resolve, reject) => {
    const pid = parseInt(producto_id, 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      return reject(new Error('producto_id inválido'));
    }

    const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
    const d1 = isDate(desde) ? desde : null;
    const d2 = isDate(hasta) ? hasta : null;

    // filtros para clicks
    const fc = ['bp.producto_id = ?'];
    const pc = [pid];
    if (d1 && d2) { fc.push('bp.created_at BETWEEN ? AND ?'); pc.push(d1, d2); }
    else if (d1) { fc.push('bp.created_at >= ?'); pc.push(d1); }
    else if (d2) { fc.push('bp.created_at <= ?'); pc.push(d2); }
    const whereC = `WHERE ${fc.join(' AND ')}`;

    // filtros para texto
    const ft = [];
    const pt = [];
    if (d1 && d2) { ft.push('bt.created_at BETWEEN ? AND ?'); pt.push(d1, d2); }
    else if (d1) { ft.push('bt.created_at >= ?'); pt.push(d1); }
    else if (d2) { ft.push('bt.created_at <= ?'); pt.push(d2); }
    const whereT = ft.length ? `WHERE ${ft.join(' AND ')}` : '';

    const sql = `
      SELECT
        p.id,
        p.nombre,
        COALESCE(c.clicks, 0) AS clicks,
        COALESCE(t.textos, 0) AS textos,
        (COALESCE(c.clicks, 0) + (? * COALESCE(t.textos, 0))) AS total_buscado
      FROM productos p
      LEFT JOIN (
        SELECT bp.producto_id, COUNT(*) AS clicks
        FROM busquedas_producto bp
        ${whereC}
        GROUP BY bp.producto_id
      ) c ON c.producto_id = p.id
      LEFT JOIN (
        /* mapeo de búsquedas de texto al nombre del producto */
        SELECT ? AS producto_id, COUNT(*) AS textos
        FROM busquedas_texto bt
        INNER JOIN productos px
          ON px.id = ?
         AND px.nombre COLLATE utf8mb4_general_ci
             LIKE CONCAT('%', REPLACE(bt.q COLLATE utf8mb4_general_ci, ' ', '%'), '%')
        ${whereT}
      ) t ON t.producto_id = p.id
      WHERE p.id = ?
      LIMIT 1
    `;

    const w = Number(weightText) || 0.3;
    const params = [w, ...pc, pid, pid, ...pt, pid];

    conexion.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows[0] || { id: pid, nombre: null, clicks: 0, textos: 0, total_buscado: 0 });
    });
  });
},

obtenerProveedoresOrdenadosPorCosto : function (conexion, productoId) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        pp.proveedor_id   AS id,
        pr.nombre         AS proveedor_nombre,
        pp.codigo         AS codigo,
        pp.precio_lista   AS precio_lista,
        COALESCE(dp.descuento, 0) AS descuento,
        /* costo_neto = lista * (1 - desc/100), costo_iva = costo_neto * 1.21 */
        ROUND(pp.precio_lista * (1 - COALESCE(dp.descuento, 0)/100) * 1.21, 2) AS costo_iva
      FROM producto_proveedor pp
      JOIN proveedores pr        ON pr.id = pp.proveedor_id
      LEFT JOIN (
        SELECT proveedor_id, MAX(descuento) AS descuento
        FROM descuentos_proveedor
        GROUP BY proveedor_id
      ) dp ON dp.proveedor_id = pp.proveedor_id
      WHERE pp.producto_id = ?
      ORDER BY costo_iva ASC, pr.nombre ASC
    `;
    conexion.query(sql, [productoId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
},
obtenerProductosProveedorConStockHasta: function (conexion, { proveedor_id, stock_max }) {
  return new Promise((resolve, reject) => {
    const prov = parseInt(proveedor_id, 10);
    const max  = parseInt(stock_max, 10);

    if (!prov || !Number.isFinite(max)) return resolve([]);

    const sql = `
      SELECT
        p.id,
        p.nombre,
        p.stock_actual,
        p.stock_minimo,
        pp.codigo AS codigo_proveedor,
        pp.precio_lista
      FROM producto_proveedor pp
      INNER JOIN productos p ON p.id = pp.producto_id
      WHERE pp.proveedor_id = ?
        AND p.stock_actual >= 0
        AND p.stock_actual <= ?
      ORDER BY p.stock_actual ASC, p.nombre ASC
    `;

    conexion.query(sql, [prov, max], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
},

obtenerMasVendidosPorProveedor: function (conexion, { proveedor_id, desde = null, hasta = null, limit = 100 }) {
  return new Promise((resolve, reject) => {
    const prov = parseInt(proveedor_id, 10);
    if (!prov) return resolve([]);

    const filtros = [];
    const params = [prov];

    const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
    const d1 = isDate(desde) ? desde : null;
    const d2 = isDate(hasta) ? hasta : null;

    if (d1 && d2) { filtros.push(`v.fecha BETWEEN ? AND ?`); params.push(d1, d2); }
    else if (d1)  { filtros.push(`v.fecha >= ?`);           params.push(d1); }
    else if (d2)  { filtros.push(`v.fecha <= ?`);           params.push(d2); }

    const whereFechas = filtros.length ? `AND ${filtros.join(' AND ')}` : '';
    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 100, 500));

    const sql = `
      SELECT
        p.id,
        p.nombre,
        p.stock_actual,
        SUM(v.cantidad) AS total_vendido
      FROM (
        /* FACTURAS */
        SELECT fi.producto_id, fi.cantidad, fm.fecha
        FROM factura_items fi
        INNER JOIN facturas_mostrador fm ON fm.id = fi.factura_id

        UNION ALL

        /* PRESUPUESTOS */
        SELECT pi.producto_id, pi.cantidad, pm.fecha
        FROM presupuesto_items pi
        INNER JOIN presupuestos_mostrador pm ON pm.id = pi.presupuesto_id
      ) v
      INNER JOIN productos p ON p.id = v.producto_id
      INNER JOIN producto_proveedor pp
        ON pp.producto_id = p.id AND pp.proveedor_id = ?
      WHERE 1=1
      ${whereFechas}
      GROUP BY p.id, p.nombre, p.stock_actual
      ORDER BY total_vendido DESC
      LIMIT ${safeLimit}
    `;

    conexion.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
},

// 3) Más buscados/consultados del proveedor (entre fechas) — usa busquedas_producto_log
obtenerMasBuscadosPorProveedor: function (conexion, { proveedor_id, desde = null, hasta = null, limit = 100 }) {
  return new Promise((resolve, reject) => {
    const prov = parseInt(proveedor_id, 10);
    if (!prov) return resolve([]);

    const filtros = [];
    const params = [prov];

    const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
    const d1 = isDate(desde) ? desde : null;
    const d2 = isDate(hasta) ? hasta : null;

    if (d1 && d2) { filtros.push(`b.fecha BETWEEN ? AND ?`); params.push(d1, d2); }
    else if (d1)  { filtros.push(`b.fecha >= ?`);           params.push(d1); }
    else if (d2)  { filtros.push(`b.fecha <= ?`);           params.push(d2); }

    const whereFechas = filtros.length ? `AND ${filtros.join(' AND ')}` : '';
    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 100, 500));

    const sql = `
      SELECT
        p.id,
        p.nombre,
        COUNT(*) AS total_buscado
      FROM busquedas_producto_log b
      INNER JOIN productos p ON p.id = b.producto_id
      INNER JOIN producto_proveedor pp ON pp.producto_id = p.id AND pp.proveedor_id = ?
      WHERE 1=1
      ${whereFechas}
      GROUP BY p.id, p.nombre
      ORDER BY total_buscado DESC
      LIMIT ${safeLimit}
    `;

    conexion.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
},

// 4) Registrar consultas de búsqueda (consultados)
registrarConsultasBusqueda: function (conexion, { productoIds = [], termino = null, usuario_id = null }) {
  return new Promise((resolve, reject) => {
    const ids = Array.isArray(productoIds)
      ? productoIds.map(n => parseInt(n, 10)).filter(Number.isInteger).slice(0, 50)
      : [];

    if (!ids.length) return resolve({ inserted: 0 });

    const values = ids.map(() => `(?, ?, ?, NOW())`).join(',');
    const params = [];
    ids.forEach(id => {
      params.push(id, termino ? String(termino).slice(0,255) : null, usuario_id ? parseInt(usuario_id,10) : null);
    });

    const sql = `
      INSERT INTO busquedas_producto_log (producto_id, termino, usuario_id, fecha)
      VALUES ${values}
    `;

    conexion.query(sql, params, (err, r) => (err ? reject(err) : resolve(r)));
  });
},



}