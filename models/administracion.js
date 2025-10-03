const pool = require('../config/conexion');

// ================== Productos (sin cambios funcionales) ==================
function obtenerProductosFactura(facturaId) {
  return new Promise((resolve, reject) => {
    pool.query(`
      SELECT pr.nombre, fi.cantidad
      FROM facturas_admin_items fi
      JOIN productos pr ON pr.id = fi.producto_id
      WHERE fi.factura_id = ?
    `, [facturaId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function obtenerProductosPresupuesto(presupuestoId) {
  return new Promise((resolve, reject) => {
    pool.query(`
      SELECT pr.nombre, pi.cantidad
      FROM presupuestos_admin_items pi
      JOIN productos pr ON pr.id = pi.producto_id
      WHERE pi.presupuesto_id = ?
    `, [presupuestoId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ====== OBJETIVOS: helpers de periodo / etiquetas / SQL ======
// ⚠️ Cambiado: ANUAL ahora es MONTH con 12 puntos (para 12 barras enero..diciembre)
function _configuracionPeriodo(periodo) {
  switch ((periodo || '').toLowerCase()) {
    case 'diario':  return { puntos: 7,  grupo: 'DAY'   };
    case 'semanal': return { puntos: 12, grupo: 'WEEK'  };
    case 'mensual': return { puntos: 12, grupo: 'MONTH' };
    case 'anual':   return { puntos: 12, grupo: 'MONTH' }; // <- antes YEAR(5), ahora MONTH(12)
    default:        return { puntos: 7,  grupo: 'DAY'   };
  }
}

function _armarEtiquetas(now, puntos, grupo) {
  const etiquetas = [];
  const pad = (n) => String(n).padStart(2, '0');
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { isoYear: d.getUTCFullYear(), isoWeek: weekNo };
  }

  for (let i = puntos - 1; i >= 0; i--) {
    const dt = new Date(base);
    if (grupo === 'DAY') {
      dt.setDate(base.getDate() - i);
      etiquetas.push(`${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`);
    } else if (grupo === 'WEEK') {
      dt.setDate(base.getDate() - (i * 7));
      const { isoYear, isoWeek } = isoWeek(dt);
      etiquetas.push(`${isoYear}-W${pad(isoWeek)}`); // match con %x-W%v
    } else if (grupo === 'MONTH') {
      const copy = new Date(base.getFullYear(), base.getMonth(), 1);
      copy.setMonth(copy.getMonth() - i);
      etiquetas.push(`${copy.getFullYear()}-${pad(copy.getMonth()+1)}`);
    } else if (grupo === 'YEAR') {
      const copy = new Date(base.getFullYear(), 0, 1);
      copy.setFullYear(copy.getFullYear() - i);
      etiquetas.push(`${copy.getFullYear()}`);
    }
  }
  return etiquetas;
}

function _mapearSeries(filas, etiquetas) {
  const mapa = new Map();
  for (const f of filas || []) mapa.set(f.bucket, Number(f.total || 0));
  return etiquetas.map(lbl => mapa.get(lbl) || 0);
}

// WHERE por período (cuando NO hay fechas manuales)
const _wherePeriodo = {
  diario:  `fecha = CURDATE()`,
  semanal: `YEARWEEK(fecha,1) = YEARWEEK(CURDATE(),1)`,
  mensual: `YEAR(fecha)=YEAR(CURDATE()) AND MONTH(fecha)=MONTH(CURDATE())`,
  anual:   `YEAR(fecha)=YEAR(CURDATE())`
};

// Devuelve { whereSql, params } en base a fechas (si existen) o periodo
function _whereFecha(feTableAlias, periodo, fechas) {
  if (fechas && fechas.desde && fechas.hasta) {
    return { whereSql: `${feTableAlias}fecha BETWEEN ? AND ?`, params: [fechas.desde, fechas.hasta] };
  }
  const p = (periodo || 'diario').toLowerCase();
  return { whereSql: _wherePeriodo[p] || _wherePeriodo.diario, params: [] };
}

// ================== Series COMPRAS ==================
function _sqlSerieFacturas(grupo, puntos, fechas) {
  if (fechas && fechas.desde && fechas.hasta) {
    // rango explícito → agrupación diaria (el front puede reagrupar a meses si es anual)
    return {
      sql: `
        SELECT DATE(fecha) AS bucket, SUM(importe_factura) AS total
        FROM facturas
        WHERE fecha BETWEEN ? AND ?
        GROUP BY DATE(fecha)
        ORDER BY DATE(fecha)
      `,
      params: [fechas.desde, fechas.hasta]
    };
  }
  if (grupo === 'DAY') {
    return {
      sql: `
        SELECT DATE(fecha) AS bucket, SUM(importe_factura) AS total
        FROM facturas
        WHERE fecha >= CURDATE() - INTERVAL ${puntos - 1} DAY
        GROUP BY DATE(fecha)
        ORDER BY DATE(fecha)
      `,
      params: []
    };
  }
  if (grupo === 'WEEK') {
    return {
      sql: `
        SELECT CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0')) AS bucket,
               SUM(importe_factura) AS total
        FROM facturas
        WHERE fecha >= CURDATE() - INTERVAL ${(puntos - 1) * 7} DAY
        GROUP BY CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0'))
        ORDER BY CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0'))
      `,
      params: []
    };
  }
  if (grupo === 'MONTH') {
    return {
      sql: `
        SELECT DATE_FORMAT(fecha, '%Y-%m') AS bucket, SUM(importe_factura) AS total
        FROM facturas
        WHERE fecha >= DATE_FORMAT(CURDATE() - INTERVAL ${puntos - 1} MONTH, '%Y-%m-01')
        GROUP BY DATE_FORMAT(fecha, '%Y-%m')
        ORDER BY DATE_FORMAT(fecha, '%Y-%m')
      `,
      params: []
    };
  }
  // (grupo YEAR ya no se usa cuando 'anual' => MONTH)
  return {
    sql: `
      SELECT DATE_FORMAT(fecha, '%Y') AS bucket, SUM(importe_factura) AS total
      FROM facturas
      WHERE fecha >= DATE_FORMAT(CURDATE() - INTERVAL ${puntos - 1} YEAR, '%Y-01-01')
      GROUP BY DATE_FORMAT(fecha, '%Y')
      ORDER BY DATE_FORMAT(fecha, '%Y')
    `,
    params: []
  };
}

function _sqlSeriePresupuestos(grupo, puntos, fechas) {
  if (fechas && fechas.desde && fechas.hasta) {
    return {
      sql: `
        SELECT DATE(fecha) AS bucket, SUM(importe) AS total
        FROM presupuestos
        WHERE fecha BETWEEN ? AND ?
        GROUP BY DATE(fecha)
        ORDER BY DATE(fecha)
      `,
      params: [fechas.desde, fechas.hasta]
    };
  }
  if (grupo === 'DAY') {
    return {
      sql: `
        SELECT DATE(fecha) AS bucket, SUM(importe) AS total
        FROM presupuestos
        WHERE fecha >= CURDATE() - INTERVAL ${puntos - 1} DAY
        GROUP BY DATE(fecha)
        ORDER BY DATE(fecha)
      `,
      params: []
    };
  }
  if (grupo === 'WEEK') {
    return {
      sql: `
        SELECT CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0')) AS bucket,
               SUM(importe) AS total
        FROM presupuestos
        WHERE fecha >= CURDATE() - INTERVAL ${(puntos - 1) * 7} DAY
        GROUP BY CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0'))
        ORDER BY CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0'))
      `,
      params: []
    };
  }
  if (grupo === 'MONTH') {
    return {
      sql: `
        SELECT DATE_FORMAT(fecha, '%Y-%m') AS bucket, SUM(importe) AS total
        FROM presupuestos
        WHERE fecha >= DATE_FORMAT(CURDATE() - INTERVAL ${puntos - 1} MONTH, '%Y-%m-01')
        GROUP BY DATE_FORMAT(fecha, '%Y-%m')
        ORDER BY DATE_FORMAT(fecha, '%Y-%m')
      `,
      params: []
    };
  }
  return {
    sql: `
      SELECT DATE_FORMAT(fecha, '%Y') AS bucket, SUM(importe) AS total
      FROM presupuestos
      WHERE fecha >= DATE_FORMAT(CURDATE() - INTERVAL ${puntos - 1} YEAR, '%Y-01-01')
      GROUP BY DATE_FORMAT(fecha, '%Y')
      ORDER BY DATE_FORMAT(fecha, '%Y')
    `,
    params: []
  };
}

// ====== HELPERS SQL VENTAS ======
function _sqlWhereFechasVentas(fechas) {
  if (fechas && fechas.desde && fechas.hasta) {
    return { where: ' WHERE fecha BETWEEN ? AND ? ', params: [fechas.desde, fechas.hasta] };
  }
  return { where: '', params: [] };
}

function _sqlSerieFacturasMostrador(grupo, puntos, fechas) {
  const { where, params } = _sqlWhereFechasVentas(fechas);
  if (grupo === 'WEEK') {
    return {
      sql: `
        SELECT CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0')) AS bucket,
               SUM(total) AS total
        FROM facturas_mostrador
        ${where || `WHERE fecha >= CURDATE() - INTERVAL ${(puntos - 1) * 7} DAY`}
        GROUP BY CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0'))
        ORDER BY CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0'))
      `,
      params
    };
  }
  if (grupo === 'MONTH') {
    return {
      sql: `
        SELECT DATE_FORMAT(fecha,'%Y-%m') AS bucket, SUM(total) AS total
        FROM facturas_mostrador
        ${where || `WHERE fecha >= CURDATE() - INTERVAL ${(puntos - 1)} MONTH`}
        GROUP BY DATE_FORMAT(fecha,'%Y-%m')
        ORDER BY DATE_FORMAT(fecha,'%Y-%m')
      `,
      params
    };
  }
  return {
    sql: `
      SELECT YEAR(fecha) AS bucket, SUM(total) AS total
      FROM facturas_mostrador
      ${where || `WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ${(puntos - 1)} YEAR)`}
      GROUP BY YEAR(fecha)
      ORDER BY YEAR(fecha)
    `,
    params
  };
}

function _sqlSeriePresupuestosMostrador(grupo, puntos, fechas) {
  const { where, params } = _sqlWhereFechasVentas(fechas);
  if (grupo === 'WEEK') {
    return {
      sql: `
        SELECT CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0')) AS bucket,
               SUM(total) AS total
        FROM presupuestos_mostrador
        ${where || `WHERE fecha >= CURDATE() - INTERVAL ${(puntos - 1) * 7} DAY`}
        GROUP BY CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0'))
        ORDER BY CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0'))
      `,
      params
    };
  }
  if (grupo === 'MONTH') {
    return {
      sql: `
        SELECT DATE_FORMAT(fecha,'%Y-%m') AS bucket, SUM(total) AS total
        FROM presupuestos_mostrador
        ${where || `WHERE fecha >= CURDATE() - INTERVAL ${(puntos - 1)} MONTH`}
        GROUP BY DATE_FORMAT(fecha,'%Y-%m')
        ORDER BY DATE_FORMAT(fecha,'%Y-%m')
      `,
      params
    };
  }
  return {
    sql: `
      SELECT YEAR(fecha) AS bucket, SUM(total) AS total
      FROM presupuestos_mostrador
      ${where || `WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ${(puntos - 1)} YEAR)`}
      GROUP BY YEAR(fecha)
      ORDER BY YEAR(fecha)
    `,
    params
  };
}

// ⚠️ Cambiado: ANUAL ahora es MONTH con 12 puntos (para 12 barras enero..diciembre)
function _configuracionPeriodoVentas(periodo) {
  const p = (periodo || 'mensual').toLowerCase();
  if (p === 'semanal') return { puntos: 12, grupo: 'WEEK'  };
  if (p === 'anual')   return { puntos: 12, grupo: 'MONTH' }; // <- antes YEAR(5)
  return { puntos: 12, grupo: 'MONTH' };
}

module.exports ={
  getProveedores : function(callback) {
    pool.query(`
      SELECT 
        p.id, p.nombre, p.telefono, p.direccion, p.ciudad, p.provincia, 
        p.contacto, p.cuit, p.mail, p.banco, p.cbu, p.alias,
        (
          SELECT d.descuento 
          FROM descuentos_proveedor d 
          WHERE d.proveedor_id = p.id 
          LIMIT 1
        ) AS descuento
      FROM proveedores p
    `, function(error, results) {
      if (error) return callback(error);
      callback(null, results);
    });
  },
  insertFactura: function (factura, callback) {
    const {
      id_proveedor,
      fecha,
      numero_factura,
      importe_bruto,
      iva,
      importe_factura,
      fecha_pago,
      condicion,
      comprobante_pago,
      administrador
    } = factura;
  
    const datosFactura = {
      id_proveedor,
      fecha,
      numero_factura,
      importe_bruto,
      iva,
      importe_factura,
      fecha_pago,
      condicion,
      comprobante_pago,
      administrador
    };
  
    pool.query('INSERT INTO facturas SET ?', datosFactura, function (error, results) {
      if (error) {
        console.error("❌ Error al insertar la factura:", error);
        return callback(null, error);
      }
      if (!results.insertId) {
        console.error("⚠️ La consulta de inserción no devolvió insertId.");
        return callback(null, new Error("Factura no insertada correctamente."));
      }
      console.log("✅ Factura insertada con ID:", results.insertId);
      callback(results.insertId, null);
    });
  },
  insertarItemFactura: function (item, callback) {
  const sql = `
    INSERT INTO facturas_admin_items (factura_id, producto_id, cantidad)
    VALUES (?, ?, ?)
  `;
  const params = [item.factura_id, item.producto_id, item.cantidad];

  pool.query(sql, params, function (error, results) {
    if (error) return callback(error);
    callback(null, results);
  });
},

insertarItemPresupuesto: function(item, callback) {
  pool.query('INSERT INTO presupuestos_admin_items SET ?', item, function(error, results) {
    if (error) return callback(error);
    callback(null, results);
  });
},

    actualizarStockProducto: function(productoID, cantidad, callback) {
        if (!productoID || !cantidad) {
            return callback(new Error("El productoID y la cantidad son obligatorios"));
        }
    
        pool.query(
            'UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?',
            [cantidad, productoID],
            function(error, results) {
                if (error) {
                    console.error("Error al actualizar el stock:", error);
                    return callback(error);
                }
                if (results.affectedRows === 0) {
                    return callback(new Error("No se pudo actualizar el stock: producto no encontrado"));
                }
                callback(null, results);  // La actualización fue exitosa
            }
        );
    },
    
    getFacturas : function(callback) {
        pool.query('SELECT facturas.*, proveedores.nombre AS nombre_proveedor FROM facturas LEFT JOIN proveedores ON facturas.id_proveedor = proveedores.id', function(error, results) {
            if (error) {
                callback(error, null);
            } else {
                callback(null, results);
            }
        });
    },
    getFacturaById: function(id, callback) {
        const query = `
            SELECT facturas.*, proveedores.nombre AS nombre_proveedor 
            FROM facturas 
            LEFT JOIN proveedores ON facturas.id_proveedor = proveedores.id 
            WHERE facturas.id = ?
        `;
        pool.query(query, [id], function(error, results) {
            if (error) throw error;
            if (results.length > 0) {
                callback(null, results[0]);
            } else {
                callback(new Error('No se encontró ninguna factura con el id ' + id));
            }
        });
    },
    deleteFacturaById : function(id, callback) {
        pool.query('DELETE FROM facturas WHERE id = ?', [id], function(error, results) {
            if (error) throw error;
            callback(null, results);
        });
    },
    updateFacturaById : function(id, factura, callback) {
      const {
        id_proveedor,
        fecha,
        numero_factura,
        importe_bruto,
        iva,
        importe_factura,
        fecha_pago,
        condicion,
        comprobante_pago
      } = factura;
    
      const datosActualizados = {
        id_proveedor,
        fecha,
        numero_factura,
        importe_bruto,
        iva,
        importe_factura,
        fecha_pago,
        condicion,
        comprobante_pago
      };
    
      pool.query('UPDATE facturas SET ? WHERE id = ?', [datosActualizados, id], function(error, results) {
        if (error) return callback(error);
        callback(null, results);
      });
    },
    
    getProveedorById : function(idProveedor, callback) {
        pool.query(`
          SELECT p.*, d.descuento 
          FROM proveedores p 
          LEFT JOIN descuentos_proveedor d ON d.proveedor_id = p.id
          WHERE p.id = ?
        `, [idProveedor], function(error, results) {
          if (error) return callback(error, null);
          if (!results.length) return callback(null, null);
          callback(null, results[0]);
        });
      },
    getFacturasByProveedorId : function(idProveedor, callback) {
        pool.query('SELECT * FROM facturas WHERE id_proveedor = ?', [idProveedor], function(error, results) {
            if (error) throw error;
            callback(null, results);
        });
    },
    getProductosByFacturaId: function(facturaID, callback) {
        const query = `
            SELECT fai.*, prod.nombre AS nombre_producto 
            FROM facturas_admin_items fai
            JOIN productos prod ON fai.producto_id = prod.id 
            WHERE fai.factura_id = ?
        `;
        pool.query(query, [facturaID], function(error, results) {
            if (error) throw error;
            callback(null, results);
        });
    },
    insertProveedor: (data, callback) => {
        // Clonar data y quitar id y descuento manualmente
        const descuento = data.descuento;
        const datosProveedor = { ...data };
        delete datosProveedor.descuento;
        delete datosProveedor.id;
      
        pool.query('INSERT INTO proveedores SET ?', datosProveedor, (err, result) => {
          if (err) return callback(err);
      
          if (descuento !== undefined && result.insertId) {
            pool.query('INSERT INTO descuentos_proveedor SET ?', {
              proveedor_id: result.insertId,
              descuento: descuento
            }, err2 => {
              if (err2) return callback(err2);
              callback(null, result);
            });
          } else {
            callback(null, result);
          }
        });
      },
      updateProveedor: (id, data, callback) => {
        const { descuento, ...datosProveedor } = data;
      
        // Primero actualizamos los datos generales del proveedor
        pool.query('UPDATE proveedores SET ? WHERE id = ?', [datosProveedor, id], (err, result) => {
          if (err) return callback(err);
      
          // Luego actualizamos o insertamos el descuento (si existe)
          pool.query('SELECT * FROM descuentos_proveedor WHERE proveedor_id = ?', [id], (err2, rows) => {
            if (err2) return callback(err2);
      
            if (rows.length > 0) {
              // Ya existe un descuento → actualizar
              pool.query(
                'UPDATE descuentos_proveedor SET descuento = ? WHERE proveedor_id = ?',
                [descuento, id],
                err3 => {
                  if (err3) return callback(err3);
                  callback(null, result);
                }
              );
            } else {
              // No existe → insertar nuevo descuento
              pool.query(
                'INSERT INTO descuentos_proveedor (proveedor_id, descuento) VALUES (?, ?)',
                [id, descuento],
                err4 => {
                  if (err4) return callback(err4);
                  callback(null, result);
                }
              );
            }
          });
        });
      },
      
      deleteProveedor: (id, callback) => {
        // Primero borrar el descuento
        pool.query('DELETE FROM descuentos_proveedor WHERE proveedor_id = ?', [id], (err1) => {
          if (err1) return callback(err1);
      
          // Luego borrar el proveedor
          pool.query('DELETE FROM proveedores WHERE id = ?', [id], (err2, result) => {
            if (err2) return callback(err2);
            callback(null, result);
          });
        });
      },
  insertPresupuesto: function (presupuesto, callback) {
  const {
    id_proveedor,
    fecha,
    numero_presupuesto,
    fecha_pago,
    importe,
    condicion,
    administrador
  } = presupuesto;

  const datos = {
    id_proveedor,
    fecha,
    numero_presupuesto,
    fecha_pago,
    importe,
    condicion,
    administrador
  };

  pool.query('INSERT INTO presupuestos SET ?', datos, function (error, results) {
    if (error) return callback(null, error);
    if (!results.insertId) return callback(null, new Error("Presupuesto no insertado."));
    callback(results.insertId, null);
  });
},

guardarItemsPresupuesto: function (presupuestoId, items, callback) {
  const sql = 'INSERT INTO presupuestos_admin_items (presupuesto_id, producto_id, cantidad) VALUES ?';
  const values = items.map(item => [presupuestoId, item.id, item.cantidad]);

  pool.query(sql, [values], callback);
},
filtrarFacturas: function (proveedor, fecha, condicion, callback) {
  const sql = `
    SELECT f.id, f.numero_factura, f.fecha, f.condicion, p.nombre AS nombre_proveedor
    FROM facturas f
    JOIN proveedores p ON p.id = f.id_proveedor
    WHERE (f.id_proveedor = ? OR ? = '')
      AND (f.fecha = ? OR ? = '')
      AND (f.condicion = ? OR ? = '')
  `;
  pool.query(sql, [proveedor, proveedor, fecha, fecha, condicion, condicion], callback);
},

filtrarPresupuestos: function (proveedor, fecha, condicion, callback) {
  const sql = `
    SELECT pr.id, pr.numero_presupuesto, pr.fecha, pr.condicion, p.nombre AS nombre_proveedor
    FROM presupuestos pr
    JOIN proveedores p ON p.id = pr.id_proveedor
    WHERE (pr.id_proveedor = ? OR ? = '')
      AND (pr.fecha = ? OR ? = '')
      AND (pr.condicion = ? OR ? = '')
  `;
  pool.query(sql, [proveedor, proveedor, fecha, fecha, condicion, condicion], callback);
},
obtenerFacturaPorId: function (id, callback) {
  const sql = `
    SELECT f.*, p.nombre AS nombre_proveedor
    FROM facturas f
    JOIN proveedores p ON p.id = f.id_proveedor
    WHERE f.id = ?
  `;
  pool.query(sql, [id], async (err, result) => {
    if (err) return callback(err);
    if (!result.length) return callback(null, {});
    const productos = await obtenerProductosFactura(id);
    callback(null, { ...result[0], productos });
  });
},

obtenerPresupuestoPorId: function (id, callback) {
  const sql = `
    SELECT pr.*, p.nombre AS nombre_proveedor
    FROM presupuestos pr
    JOIN proveedores p ON p.id = pr.id_proveedor
    WHERE pr.id = ?
  `;
  pool.query(sql, [id], async (err, result) => {
    if (err) return callback(err);
    if (!result.length) return callback(null, {});
    const productos = await obtenerProductosPresupuesto(id);
    callback(null, { ...result[0], productos });
  });
},
editarFactura: function (id, datos, callback) {
  const {
    id_proveedor,
    numero_factura,
    fecha,
    fecha_pago,
    importe_bruto,
    iva,
    importe_factura,
    condicion,
    administrador,
    comprobante_pago
  } = datos;

  const sql = `
    UPDATE facturas 
    SET 
      id_proveedor = ?,
      numero_factura = ?, 
      fecha = ?, 
      fecha_pago = ?, 
      importe_bruto = ?, 
      iva = ?, 
      importe_factura = ?, 
      condicion = ?, 
      administrador = ?, 
      comprobante_pago = ?
    WHERE id = ?
  `;

  const valores = [
    id_proveedor,
    numero_factura,
    fecha,
    fecha_pago,
    importe_bruto,
    iva,
    importe_factura,
    condicion,
    administrador,
    comprobante_pago,
    id
  ];

  pool.query(sql, valores, callback);
},

editarPresupuesto: function (id, datos, callback) {
  const {
    numero_presupuesto,
    fecha,
    fecha_pago,
    importe,
    condicion,
    administrador,
    id_proveedor
  } = datos;

  const sql = `
    UPDATE presupuestos 
    SET 
      numero_presupuesto = ?, 
      fecha = ?, 
      fecha_pago = ?, 
      importe = ?, 
      condicion = ?, 
      administrador = ?, 
      id_proveedor = ?
    WHERE id = ?
  `;

  const valores = [
    numero_presupuesto,
    fecha,
    fecha_pago,
    importe,
    condicion,
    administrador,
    id_proveedor,
    id
  ];

  pool.query(sql, valores, callback);
},
obtenerDocumentosFiltrados: function (tipo, proveedor, fechaDesde, fechaHasta, condicion, numero, callback) {
  const filtrosFactura = [];
  const filtrosPresupuesto = [];

  if (proveedor && proveedor.trim() !== '') {
    filtrosFactura.push(`f.id_proveedor = ${pool.escape(proveedor)}`);
    filtrosPresupuesto.push(`pz.id_proveedor = ${pool.escape(proveedor)}`);
  }

  if (condicion && condicion.trim() !== '') {
    filtrosFactura.push(`f.condicion = ${pool.escape(condicion)}`);
    filtrosPresupuesto.push(`pz.condicion = ${pool.escape(condicion)}`);
  }

  if (fechaDesde) {
    filtrosFactura.push(`f.fecha >= ${pool.escape(fechaDesde)}`);
    filtrosPresupuesto.push(`pz.fecha >= ${pool.escape(fechaDesde)}`);
  }

  if (fechaHasta) {
    filtrosFactura.push(`f.fecha <= ${pool.escape(fechaHasta)}`);
    filtrosPresupuesto.push(`pz.fecha <= ${pool.escape(fechaHasta)}`);
  }

  if (numero && numero.trim() !== '') {
    filtrosFactura.push(`f.numero_factura = ${pool.escape(numero)}`);
    filtrosPresupuesto.push(`pz.numero_presupuesto = ${pool.escape(numero)}`);
  }

  const whereFactura = filtrosFactura.length ? `WHERE ${filtrosFactura.join(' AND ')}` : '';
  const wherePresupuesto = filtrosPresupuesto.length ? `WHERE ${filtrosPresupuesto.join(' AND ')}` : '';

  const consultas = [];

  if (!tipo || tipo === 'factura') {
    consultas.push(`
      SELECT 
        'factura' AS tipo,
        f.id,
        f.numero_factura AS numero,
        f.fecha,
        f.fecha_pago,
        f.condicion,
        f.importe_factura AS importe,
        COALESCE(p.nombre, 'SIN PROVEEDOR') AS nombre_proveedor
      FROM facturas f
      LEFT JOIN proveedores p ON p.id = f.id_proveedor
      ${whereFactura}
    `);
  }

  if (!tipo || tipo === 'presupuesto') {
    consultas.push(`
      SELECT 
        'presupuesto' AS tipo,
        pz.id,
        pz.numero_presupuesto AS numero,
        pz.fecha,
        pz.fecha_pago,
        pz.condicion,
        pz.importe AS importe,
        COALESCE(pr.nombre, 'SIN PROVEEDOR') AS nombre_proveedor
      FROM presupuestos pz
      LEFT JOIN proveedores pr ON pr.id = pz.id_proveedor
      ${wherePresupuesto}
    `);
  }

  const sqlFinal = consultas.join(' UNION ALL ') + ' ORDER BY fecha_pago ASC';

  pool.query(sqlFinal, callback);
},

getFacturasEntreFechas: function(desde, hasta, proveedorId, condicion, callback) {
  let sql = `
    SELECT f.numero_factura, f.fecha, f.importe_factura, f.condicion, p.nombre AS proveedor
    FROM facturas f
    JOIN proveedores p ON f.id_proveedor = p.id
    WHERE f.fecha BETWEEN ? AND ?
  `;
  const params = [desde, hasta];

  if (proveedorId && proveedorId !== '') {
    sql += ' AND f.id_proveedor = ?';
    params.push(proveedorId);
  }

  if (condicion && condicion !== '') {
    sql += ' AND f.condicion = ?';
    params.push(condicion);
  }

  sql += ' ORDER BY f.fecha ASC';
  pool.query(sql, params, callback);
},
getPresupuestosEntreFechas: function(desde, hasta, proveedorId, condicion, callback) {
  let sql = `
    SELECT pr.numero_presupuesto, pr.fecha, pr.importe, pr.condicion, p.nombre AS proveedor
    FROM presupuestos pr
    JOIN proveedores p ON pr.id_proveedor = p.id
    WHERE pr.fecha BETWEEN ? AND ?
  `;
  const params = [desde, hasta];

  if (proveedorId && proveedorId !== '') {
    sql += ' AND pr.id_proveedor = ?';
    params.push(proveedorId);
  }

  if (condicion && condicion !== '') {
    sql += ' AND pr.condicion = ?';
    params.push(condicion);
  }

  sql += ' ORDER BY pr.fecha ASC';

  pool.query(sql, params, callback);
},
verificarDocumentoDuplicado: function (tipo, proveedorId, fecha, numero, callback) {
  let sql = '';
  const params = [proveedorId, fecha, numero];

  if (tipo === 'factura') {
    sql = `SELECT id FROM facturas WHERE id_proveedor = ? AND fecha = ? AND numero_factura = ?`;
  } else if (tipo === 'presupuesto') {
    sql = `SELECT id FROM presupuestos WHERE id_proveedor = ? AND fecha = ? AND numero_presupuesto = ?`;
  } else {
    return callback(new Error('Tipo inválido'), null);
  }

  pool.query(sql, params, callback);
},
deletePresupuestoById: function(id, callback) {
  // Primero eliminamos los ítems relacionados en presupuestos_admin_items
  pool.query('DELETE FROM presupuestos_admin_items WHERE presupuesto_id = ?', [id], function(error) {
    if (error) return callback(error);

    // Luego eliminamos el presupuesto
    pool.query('DELETE FROM presupuestos WHERE id = ?', [id], function(error2, results) {
      if (error2) return callback(error2);
      callback(null, results);
    });
  });
},

deleteFacturaById: function(id, callback) {
  // Primero eliminamos los ítems relacionados en facturas_admin_items
  pool.query('DELETE FROM facturas_admin_items WHERE factura_id = ?', [id], function(error) {
    if (error) return callback(error);

    // Luego eliminamos la factura
    pool.query('DELETE FROM facturas WHERE id = ?', [id], function(error2, results) {
      if (error2) return callback(error2);
      callback(null, results);
    });
  });
},
// ====== EXPORTS: callbacks ======
// Totales del periodo o rango
obtenerTotalesPeriodoCompras: function (periodo, fechas, callback) {
  try {
    const wf = _whereFecha('', periodo, fechas); // '' = sin alias; usamos "fecha"
    const sqlA = `SELECT COALESCE(SUM(importe_factura),0) AS total FROM facturas WHERE ${wf.whereSql}`;
    const sqlB = `SELECT COALESCE(SUM(importe),0) AS total FROM presupuestos WHERE ${wf.whereSql}`;

    let hecho = 0; let A = 0, B = 0; let errorGuardado = null;

    pool.query(sqlA, wf.params, (errF, rowsF) => {
      if (errF) errorGuardado = errF; else A = Number((rowsF && rowsF[0] && rowsF[0].total) || 0);
      if (++hecho === 2) return errorGuardado ? callback(errorGuardado) : callback(null, { A, B, TOTAL: A + B });
    });

    pool.query(sqlB, wf.params, (errP, rowsP) => {
      if (errP) errorGuardado = errP; else B = Number((rowsP && rowsP[0] && rowsP[0].total) || 0);
      if (++hecho === 2) return errorGuardado ? callback(errorGuardado) : callback(null, { A, B, TOTAL: A + B });
    });
  } catch (e) {
    callback(e);
  }
},
obtenerSeriesCompras: function (periodo, fechas, callback) {
  try {
    const { puntos, grupo } = _configuracionPeriodo(periodo);

    const fA = _sqlSerieFacturas(grupo, puntos, fechas);
    const fB = _sqlSeriePresupuestos(grupo, puntos, fechas);

    let hecho = 0;
    let filasA = [], filasB = [];
    let errorGuardado = null;

    const finSiListo = () => {
      if (++hecho < 2) return;
      if (errorGuardado) return callback(errorGuardado);

      // 1) Etiquetas = unión ordenada de todos los buckets
      const set = new Set();
      (filasA || []).forEach(r => set.add(r.bucket));
      (filasB || []).forEach(r => set.add(r.bucket));
      const etiquetas = Array.from(set).sort();

      // 2) Mapas A/B por bucket
      const mapA = new Map((filasA || []).map(r => [r.bucket, Number(r.total || 0)]));
      const mapB = new Map((filasB || []).map(r => [r.bucket, Number(r.total || 0)]));

      // 3) Series alineadas
      const serieA = etiquetas.map(lbl => mapA.get(lbl) || 0);
      const serieB = etiquetas.map(lbl => mapB.get(lbl) || 0);
      const serieTotal = serieA.map((v, i) => v + serieB[i]);

      callback(null, { etiquetas, A: serieA, B: serieB, TOTAL: serieTotal });
    };

    pool.query(fA.sql, fA.params, (errA, rowsA) => {
      if (errA) errorGuardado = errA; else filasA = rowsA || [];
      finSiListo();
    });

    pool.query(fB.sql, fB.params, (errB, rowsB) => {
      if (errB) errorGuardado = errB; else filasB = rowsB || [];
      finSiListo();
    });
  } catch (e) {
    callback(e);
  }
},
// ====== TOTALES PERIODO (VENTAS) ======
obtenerTotalesPeriodoVentas: function (periodo, fechas, callback) {
  try {
    const { where, params } = _sqlWhereFechasVentas(fechas);

    // A (Facturas de mostrador)
    const sqlA = `
      SELECT COALESCE(SUM(total),0) AS total
      FROM facturas_mostrador
      ${where}
    `;
    // B (Presupuestos de mostrador)
    const sqlB = `
      SELECT COALESCE(SUM(total),0) AS total
      FROM presupuestos_mostrador
      ${where}
    `;

    let hechos = 0;
    let totA = 0, totB = 0;
    let errorGuardado = null;

    const fin = () => {
      if (++hechos < 2) return;
      if (errorGuardado) return callback(errorGuardado);
      callback(null, { A: totA, B: totB, TOTAL: totA + totB });
    };

    pool.query(sqlA, params, (errA, rA) => {
      if (errA) errorGuardado = errA; else totA = Number(rA?.[0]?.total || 0);
      fin();
    });
    pool.query(sqlB, params, (errB, rB) => {
      if (errB) errorGuardado = errB; else totB = Number(rB?.[0]?.total || 0);
      fin();
    });
  } catch (e) {
    callback(e);
  }
},

// ====== SERIES (VENTAS) ======
obtenerSeriesVentas: function (periodo, fechas, callback) {
  try {
    const { puntos, grupo } = _configuracionPeriodoVentas(periodo);

    const fA = _sqlSerieFacturasMostrador(grupo, puntos, fechas);
    const fB = _sqlSeriePresupuestosMostrador(grupo, puntos, fechas);

    let hecho = 0;
    let filasA = [], filasB = [];
    let errorGuardado = null;

    const finSiListo = () => {
      if (++hecho < 2) return;
      if (errorGuardado) return callback(errorGuardado);

      // Unir buckets y alinear
      const set = new Set();
      (filasA || []).forEach(r => set.add(String(r.bucket)));
      (filasB || []).forEach(r => set.add(String(r.bucket)));
      const etiquetas = Array.from(set).sort();

      const mapA = new Map((filasA || []).map(r => [String(r.bucket), Number(r.total || 0)]));
      const mapB = new Map((filasB || []).map(r => [String(r.bucket), Number(r.total || 0)]));

      const serieA = etiquetas.map(lbl => mapA.get(lbl) || 0);
      const serieB = etiquetas.map(lbl => mapB.get(lbl) || 0);
      const serieT = serieA.map((v, i) => v + (serieB[i] || 0));

      callback(null, { etiquetas, A: serieA, B: serieB, TOTAL: serieT });
    };

    pool.query(fA.sql, fA.params, (errA, rowsA) => {
      if (errA) errorGuardado = errA; else filasA = rowsA || [];
      finSiListo();
    });
    pool.query(fB.sql, fB.params, (errB, rowsB) => {
      if (errB) errorGuardado = errB; else filasB = rowsB || [];
      finSiListo();
    });
  } catch (e) {
    callback(e);
  }
},
// ====== GASTOS ======
insertGasto: function (data, callback) {
  const { categoria, fecha, monto, descripcion, administrador } = data;
  const sql = `
    INSERT INTO gastos (categoria, fecha, monto, descripcion, administrador)
    VALUES (?, ?, ?, ?, ?)
  `;
  pool.query(sql, [categoria, fecha, monto, descripcion || null, administrador || null], (err, result) => {
    if (err) return callback(err);
    callback(null, { insertId: result.insertId });
  });
},

listarGastos: function (desde, hasta, categoria, callback) {
  let sql = `SELECT id, categoria, fecha, monto, descripcion, administrador, creado_en
             FROM gastos WHERE 1=1`;
  const params = [];

  if (desde) { sql += ` AND fecha >= ?`; params.push(desde); }
  if (hasta) { sql += ` AND fecha <= ?`; params.push(hasta); }
  if (categoria && categoria.trim() !== '') {
    sql += ` AND categoria = ?`; params.push(categoria);
  }

  sql += ` ORDER BY fecha DESC, id DESC LIMIT 500`;
  pool.query(sql, params, callback);
},
obtenerTotalesPeriodoGastos(periodo, fechas, tipo, categoria, callback) {
  try {
    const wf = _whereFecha('', periodo, fechas);
    const whereBase = `WHERE ${wf.whereSql}`;
    const paramsBase = [...wf.params];

    const catSql = (categoria && categoria.trim() !== '') ? ' AND categoria = ? ' : '';
    const catParams = (categoria && categoria.trim() !== '') ? [categoria] : [];

    // Si piden un solo tipo (A o B)
    if (tipo === 'A' || tipo === 'B') {
      const sql = `SELECT COALESCE(SUM(monto),0) AS total
                   FROM gastos ${whereBase} AND tipo = ? ${catSql}`;
      const params = [...paramsBase, tipo, ...catParams];
      return pool.query(sql, params, (err, rows) => {
        if (err) return callback(err);
        const total = Number(rows?.[0]?.total || 0);
        callback(null, { [tipo]: total });
      });
    }

    // TOTAL + desglose A/B
    const sql = `
      SELECT tipo, COALESCE(SUM(monto),0) AS total
      FROM gastos
      ${whereBase} ${catSql}
      GROUP BY tipo
    `;
    pool.query(sql, [...paramsBase, ...catParams], (err, rows) => {
      if (err) return callback(err);
      const A = Number((rows || []).find(r => r.tipo === 'A')?.total || 0);
      const B = Number((rows || []).find(r => r.tipo === 'B')?.total || 0);
      callback(null, { A, B, TOTAL: A + B });
    });
  } catch (e) {
    callback(e);
  }
},

// === SERIES (GASTOS A/B/TOTAL) ===
obtenerSeriesGastos(periodo, fechas, tipo, categoria, callback) {
  try {
    const { puntos, grupo } = _configuracionPeriodo(periodo);
    const catSql = (categoria && categoria.trim() !== '') ? ' AND categoria = ? ' : '';
    const catParams = (categoria && categoria.trim() !== '') ? [categoria] : [];

    const selectBucket = (grupo === 'DAY')   ? `DATE(fecha)`
                        : (grupo === 'WEEK')  ? `CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha,1),2,'0'))`
                        : (grupo === 'MONTH') ? `DATE_FORMAT(fecha,'%Y-%m')`
                        :                        `DATE_FORMAT(fecha,'%Y')`;

    let whereRango = '';
    if (fechas && fechas.desde && fechas.hasta) {
      whereRango = `fecha BETWEEN ? AND ?`;
    } else if (grupo === 'DAY') {
      whereRango = `fecha >= CURDATE() - INTERVAL ${puntos - 1} DAY`;
    } else if (grupo === 'WEEK') {
      whereRango = `fecha >= CURDATE() - INTERVAL ${(puntos - 1) * 7} DAY`;
    } else if (grupo === 'MONTH') {
      whereRango = `fecha >= DATE_FORMAT(CURDATE() - INTERVAL ${puntos - 1} MONTH, '%Y-%m-01')`;
    } else {
      whereRango = `fecha >= DATE_FORMAT(CURDATE() - INTERVAL ${puntos - 1} YEAR, '%Y-01-01')`;
    }

    // Un tipo específico (A o B)
    if (tipo === 'A' || tipo === 'B') {
      const sql = `
        SELECT ${selectBucket} AS bucket, SUM(monto) AS total
        FROM gastos
        WHERE ${whereRango} AND tipo = ? ${catSql}
        GROUP BY ${selectBucket}
        ORDER BY ${selectBucket}
      `;
      const baseParams = (fechas?.desde && fechas?.hasta)
        ? [fechas.desde, fechas.hasta] : [];
      const params = [...baseParams, tipo, ...catParams];

      return pool.query(sql, params, (err, rows) => {
        if (err) return callback(err);
        const etiquetas = (rows || []).map(r => String(r.bucket));
        const serie = (rows || []).map(r => Number(r.total || 0));
        callback(null, { etiquetas, [tipo]: serie });
      });
    }

    // TOTAL con desglose A/B
    const sql = `
      SELECT ${selectBucket} AS bucket, tipo, SUM(monto) AS total
      FROM gastos
      WHERE ${whereRango} ${catSql}
      GROUP BY ${selectBucket}, tipo
      ORDER BY ${selectBucket}
    `;
    const baseParams = (fechas?.desde && fechas?.hasta)
      ? [fechas.desde, fechas.hasta] : [];
    const params = [...baseParams, ...catParams];

    pool.query(sql, params, (err, rows) => {
      if (err) return callback(err);

      // pivot por bucket
      const map = new Map(); // bucket -> { A:0, B:0 }
      (rows || []).forEach(r => {
        const k = String(r.bucket);
        if (!map.has(k)) map.set(k, { A:0, B:0 });
        map.get(k)[r.tipo] += Number(r.total || 0);
      });
      const etiquetas = [...map.keys()];
      const A = etiquetas.map(k => map.get(k).A);
      const B = etiquetas.map(k => map.get(k).B);
      const TOTAL = etiquetas.map((_, i) => A[i] + B[i]);

      callback(null, { etiquetas, A, B, TOTAL });
    });
  } catch (e) {
    callback(e);
  }
},
// Modificar la función insertGasto para incluir el campo tipo
insertGasto: function (data, callback) {
  const { categoria, tipo, fecha, monto, descripcion, administrador } = data;
  const sql = `
    INSERT INTO gastos (categoria, tipo, fecha, monto, descripcion, administrador)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const params = [categoria, tipo, fecha, monto, descripcion || null, administrador || null];
  pool.query(sql, params, (err, result) => {
    if (err) return callback(err);
    callback(null, { insertId: result.insertId });
  });
},

// Modificar la función listarGastos para seleccionar también el campo tipo
listarGastos: function (desde, hasta, categoria, callback) {
  let sql = `SELECT id, categoria, tipo, fecha, monto, descripcion, administrador, creado_en
             FROM gastos WHERE 1=1`;
  const params = [];
  if (desde) { sql += ` AND fecha >= ?`; params.push(desde); }
  if (hasta) { sql += ` AND fecha <= ?`; params.push(hasta); }
  if (categoria && categoria.trim() !== '') {
    sql += ` AND categoria = ?`; params.push(categoria);
  }
  sql += ` ORDER BY fecha DESC, id DESC LIMIT 500`;
  pool.query(sql, params, callback);
},
deleteGasto: function(id, callback) {
  const sql = 'DELETE FROM gastos WHERE id = ?';
  pool.query(sql, [id], callback);
},



}