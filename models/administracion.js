const pool = require('../config/conexion');
const conexion = require('../config/conexion')

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
function _configuracionPeriodo(periodo) {
  switch ((periodo || '').toLowerCase()) {
    case 'diario':  return { puntos: 7,  grupo: 'DAY'   };
    case 'semanal': return { puntos: 12, grupo: 'WEEK'  };
    case 'mensual': return { puntos: 12, grupo: 'MONTH' };
    case 'anual':   return { puntos: 5,  grupo: 'YEAR'  };
    default:        return { puntos: 7,  grupo: 'DAY'   };
  }
}

function _armarEtiquetas(now, puntos, grupo) {
  const etiquetas = [];
  const pad = (n) => String(n).padStart(2, '0');
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let i = puntos - 1; i >= 0; i--) {
    const dt = new Date(base);
    if (grupo === 'DAY') {
      dt.setDate(base.getDate() - i);
      etiquetas.push(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
    } else if (grupo === 'WEEK') {
      const copy = new Date(base);
      copy.setDate(base.getDate() - i * 7);
      const unoEne = new Date(copy.getFullYear(), 0, 1);
      const semana = Math.ceil((((copy - unoEne) / 86400000) + unoEne.getDay() + 1) / 7);
      etiquetas.push(`${copy.getFullYear()}-W${pad(semana)}`);
    } else if (grupo === 'MONTH') {
      const copy = new Date(base.getFullYear(), base.getMonth(), 1);
      copy.setMonth(copy.getMonth() - i);
      etiquetas.push(`${copy.getFullYear()}-${pad(copy.getMonth() + 1)}`);
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
  for (const f of filas || []) {
    mapa.set(f.bucket, Number(f.total || 0));
  }
  return etiquetas.map(lbl => mapa.get(lbl) || 0);
}

const _wherePeriodoFacturas = {
  diario:  `WHERE fecha = CURDATE()`,
  semanal: `WHERE YEARWEEK(fecha,1) = YEARWEEK(CURDATE(),1)`,
  mensual: `WHERE YEAR(fecha)=YEAR(CURDATE()) AND MONTH(fecha)=MONTH(CURDATE())`,
  anual:   `WHERE YEAR(fecha)=YEAR(CURDATE())`
};
const _wherePeriodoPresupuestos = { ..._wherePeriodoFacturas };

function _sqlFacturasSerie(grupo, puntos) {
  if (grupo === 'DAY') {
    return `
      SELECT DATE(fecha) AS bucket, SUM(importe_factura) AS total
      FROM facturas
      WHERE fecha >= (CURDATE() - INTERVAL ${puntos - 1} DAY)
      GROUP BY DATE(fecha)
      ORDER BY DATE(fecha)
    `;
  }
  if (grupo === 'WEEK') {
    return `
      SELECT CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0')) AS bucket, SUM(importe_factura) AS total
      FROM facturas
      WHERE YEARWEEK(fecha,1) >= YEARWEEK(CURDATE() - INTERVAL ${(puntos - 1) * 7} DAY, 1)
      GROUP BY YEAR(fecha), WEEK(fecha,1)
      ORDER BY YEAR(fecha), WEEK(fecha,1)
    `;
  }
  if (grupo === 'MONTH') {
    return `
      SELECT DATE_FORMAT(fecha, '%Y-%m') AS bucket, SUM(importe_factura) AS total
      FROM facturas
      WHERE fecha >= (DATE_FORMAT(CURDATE() - INTERVAL ${puntos - 1} MONTH, '%Y-%m-01'))
      GROUP BY DATE_FORMAT(fecha, '%Y-%m')
      ORDER BY DATE_FORMAT(fecha, '%Y-%m')
    `;
  }
  return `
    SELECT DATE_FORMAT(fecha, '%Y') AS bucket, SUM(importe_factura) AS total
    FROM facturas
    WHERE fecha >= DATE_FORMAT(CURDATE() - INTERVAL ${puntos - 1} YEAR, '%Y-01-01')
    GROUP BY DATE_FORMAT(fecha, '%Y')
    ORDER BY DATE_FORMAT(fecha, '%Y')
  `;
}

function _sqlPresupuestosSerie(grupo, puntos) {
  if (grupo === 'DAY') {
    return `
      SELECT DATE(fecha) AS bucket, SUM(importe) AS total
      FROM presupuestos
      WHERE fecha >= (CURDATE() - INTERVAL ${puntos - 1} DAY)
      GROUP BY DATE(fecha)
      ORDER BY DATE(fecha)
    `;
  }
  if (grupo === 'WEEK') {
    return `
      SELECT CONCAT(YEAR(fecha), '-W', LPAD(WEEK(fecha, 1), 2, '0')) AS bucket, SUM(importe) AS total
      FROM presupuestos
      WHERE YEARWEEK(fecha,1) >= YEARWEEK(CURDATE() - INTERVAL ${(puntos - 1) * 7} DAY, 1)
      GROUP BY YEAR(fecha), WEEK(fecha,1)
      ORDER BY YEAR(fecha), WEEK(fecha,1)
    `;
  }
  if (grupo === 'MONTH') {
    return `
      SELECT DATE_FORMAT(fecha, '%Y-%m') AS bucket, SUM(importe) AS total
      FROM presupuestos
      WHERE fecha >= (DATE_FORMAT(CURDATE() - INTERVAL ${puntos - 1} MONTH, '%Y-%m-01'))
      GROUP BY DATE_FORMAT(fecha, '%Y-%m')
      ORDER BY DATE_FORMAT(fecha, '%Y-%m')
    `;
  }
  return `
    SELECT DATE_FORMAT(fecha, '%Y') AS bucket, SUM(importe) AS total
    FROM presupuestos
    WHERE fecha >= DATE_FORMAT(CURDATE() - INTERVAL ${puntos - 1} YEAR, '%Y-01-01')
    GROUP BY DATE_FORMAT(fecha, '%Y')
    ORDER BY DATE_FORMAT(fecha, '%Y')
  `;
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
obtenerTotalesPeriodoCompras: function (periodo, callback) {
  try {
    const p  = (periodo || 'diario').toLowerCase();
    const wf = _wherePeriodoFacturas[p]     || _wherePeriodoFacturas.diario;
    const wp = _wherePeriodoPresupuestos[p] || _wherePeriodoPresupuestos.diario;

    // Hacemos las dos consultas en paralelo y sincronizamos
    let hecho = 0;
    let A = 0, B = 0;
    let errorGuardado = null;

    pool.query(`SELECT COALESCE(SUM(importe_factura),0) AS total FROM facturas ${wf}`, (errF, rowsF) => {
      if (errF) errorGuardado = errF;
      else A = Number((rowsF && rowsF[0] && rowsF[0].total) || 0);
      if (++hecho === 2) {
        if (errorGuardado) return callback(errorGuardado);
        return callback(null, { A, B, TOTAL: A + B });
      }
    });

    pool.query(`SELECT COALESCE(SUM(importe),0) AS total FROM presupuestos ${wp}`, (errP, rowsP) => {
      if (errP) errorGuardado = errP;
      else B = Number((rowsP && rowsP[0] && rowsP[0].total) || 0);
      if (++hecho === 2) {
        if (errorGuardado) return callback(errorGuardado);
        return callback(null, { A, B, TOTAL: A + B });
      }
    });
  } catch (e) {
    callback(e);
  }
},

// ====== OBJETIVOS: Series históricas (labels + A, B, TOTAL) ======
obtenerSeriesCompras: function (periodo, callback) {
  try {
    const { puntos, grupo } = _configuracionPeriodo(periodo);
    const etiquetas = _armarEtiquetas(new Date(), puntos, grupo);

    const sqlA = _sqlFacturasSerie(grupo, puntos);
    const sqlB = _sqlPresupuestosSerie(grupo, puntos);

    let hecho = 0;
    let filasA = [], filasB = [];
    let errorGuardado = null;

    pool.query(sqlA, (errA, rowsA) => {
      if (errA) errorGuardado = errA;
      else filasA = rowsA || [];
      if (++hecho === 2) {
        if (errorGuardado) return callback(errorGuardado);
        const serieA = _mapearSeries(filasA, etiquetas);
        const serieB = _mapearSeries(filasB, etiquetas);
        const serieTotal = serieA.map((v, i) => v + serieB[i]);
        return callback(null, { etiquetas, A: serieA, B: serieB, TOTAL: serieTotal });
      }
    });

    pool.query(sqlB, (errB, rowsB) => {
      if (errB) errorGuardado = errB;
      else filasB = rowsB || [];
      if (++hecho === 2) {
        if (errorGuardado) return callback(errorGuardado);
        const serieA = _mapearSeries(filasA, etiquetas);
        const serieB = _mapearSeries(filasB, etiquetas);
        const serieTotal = serieA.map((v, i) => v + serieB[i]);
        return callback(null, { etiquetas, A: serieA, B: serieB, TOTAL: serieTotal });
      }
    });
  } catch (e) {
    callback(e);
  }
},


      
}