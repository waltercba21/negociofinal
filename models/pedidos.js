const pool = require('../config/conexion');

module.exports = {
 obtenerPedidos: (callback) => {
    const query = `
      SELECT 
        c.id AS id_pedido,
        CONCAT(u.nombre, ' ', IFNULL(u.apellido,'')) AS cliente,
        c.usuario_id,
        c.estado,
        c.tipo_envio,
        c.direccion,

        COALESCE(SUM(pc.cantidad * p.precio_venta), 0) AS subtotal_productos,
        CASE WHEN c.tipo_envio = 'delivery' THEN ? ELSE 0 END AS costo_envio,
        COALESCE(SUM(pc.cantidad * p.precio_venta), 0)
          + CASE WHEN c.tipo_envio = 'delivery' THEN ? ELSE 0 END AS total,

        COALESCE(c.actualizado_en, c.creado_en) AS fecha
      FROM carritos c
      JOIN usuarios u ON c.usuario_id = u.id
      LEFT JOIN productos_carrito pc ON c.id = pc.carrito_id
      LEFT JOIN productos p ON pc.producto_id = p.id
      WHERE c.estado <> 'carrito'
        AND c.es_pedido = 1
      GROUP BY c.id, u.nombre, u.apellido, c.usuario_id, c.estado, c.tipo_envio, c.direccion, c.actualizado_en, c.creado_en
      ORDER BY fecha DESC;
    `;

    pool.query(query, [COSTO_DELIVERY, COSTO_DELIVERY], (error, resultados) => {
      if (error) return callback(error, null);
      callback(null, resultados);
    });
  },

  // ✅ Para validar estado actual / usuario_id antes de cambiar estado
  obtenerPedidoPorId: (id_pedido, callback) => {
    const query = `
      SELECT id, usuario_id, estado, tipo_envio
      FROM carritos
      WHERE id = ?
      LIMIT 1
    `;
    pool.query(query, [id_pedido], (error, rows) => {
      if (error) return callback(error, null);
      callback(null, rows && rows.length ? rows[0] : null);
    });
  },

    obtenerDetallePedido: (id_carrito, callback) => {
    const query = `
      SELECT
        u.nombre AS cliente,
        c.creado_en AS fecha,
        c.tipo_envio,
        c.direccion,

        pp_min.codigo,
        p.nombre AS nombre_producto,
        pc.cantidad,
        p.precio_venta,
        (pc.cantidad * p.precio_venta) AS subtotal
      FROM carritos c
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN productos_carrito pc ON c.id = pc.carrito_id
      JOIN productos p ON pc.producto_id = p.id
      LEFT JOIN (
          SELECT pp1.producto_id, pp1.codigo
          FROM producto_proveedor pp1
          INNER JOIN (
              SELECT producto_id, MIN(precio_lista) AS precio_minimo
              FROM producto_proveedor
              GROUP BY producto_id
          ) AS pp2
          ON pp1.producto_id = pp2.producto_id AND pp1.precio_lista = pp2.precio_minimo
      ) AS pp_min
      ON pp_min.producto_id = p.id
      WHERE c.id = ?
    `;

    pool.query(query, [id_carrito], (error, resultados) => {
      if (error) return callback(error, null);
      if (!resultados || resultados.length === 0) return callback(null, null);

      const { cliente, fecha, tipo_envio, direccion } = resultados[0];

      let totalProductos = 0;
      const productos = resultados.map(r => {
        totalProductos += Number(r.subtotal || 0);
        return {
          codigo: r.codigo || 'SIN CÓDIGO',
          nombre: r.nombre_producto,
          cantidad: r.cantidad,
          precio_unitario: r.precio_venta,
          subtotal: r.subtotal
        };
      });

      const costo_envio = (tipo_envio === 'delivery') ? COSTO_DELIVERY : 0;
      const total = totalProductos + costo_envio;

      callback(null, {
        cliente,
        fecha,
        tipo_envio,
        direccion,
        costo_envio,
        total_productos: totalProductos,
        total, // total final (productos + envío)
        productos
      });
    });
  },
  obtenerCantidadPedidosPendientes: (callback) => {
    const query = `
      SELECT COUNT(*) AS cantidad
      FROM carritos
      WHERE estado IN ('pendiente','confirmado','preparación','listo para entrega')
    `;

    pool.query(query, (error, resultados) => {
      if (error) return callback(error, null);
      callback(null, resultados[0].cantidad);
    });
  },

  actualizarEstadoPedido: (id_pedido, nuevoEstado, callback) => {
    const query = "UPDATE carritos SET estado = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?";
    pool.query(query, [nuevoEstado, id_pedido], (error, resultados) => {
      if (error) return callback(error);
      callback(null, resultados);
    });
  },
  confirmarPedidoYDescontarStock: (id_pedido, callback) => {
  pool.getConnection((err, conn) => {
    if (err) return callback(err);

    const rollback = (e) => conn.rollback(() => {
      conn.release();
      callback(e);
    });

    conn.beginTransaction((errTx) => {
      if (errTx) return rollback(errTx);

      // 1) bloquear el carrito/pedido
      const qCarrito = `
        SELECT id, estado
        FROM carritos
        WHERE id = ?
        FOR UPDATE
      `;
      conn.query(qCarrito, [id_pedido], (e1, rowsC) => {
        if (e1) return rollback(e1);
        if (!rowsC || !rowsC.length) return rollback(Object.assign(new Error("Pedido no encontrado"), { code: "NO_EXISTE" }));

        const est = String(rowsC[0].estado || '').toLowerCase();
        if (est !== 'pendiente') return rollback(Object.assign(new Error("No está pendiente"), { code: "NO_PENDIENTE" }));

        // 2) items + lock stock productos
        const qItems = `
          SELECT pc.producto_id, pc.cantidad, p.stock_actual
          FROM productos_carrito pc
          JOIN productos p ON p.id = pc.producto_id
          WHERE pc.carrito_id = ?
          FOR UPDATE
        `;
        conn.query(qItems, [id_pedido], (e2, items) => {
          if (e2) return rollback(e2);
          if (!items || !items.length) return rollback(Object.assign(new Error("Sin items"), { code: "SIN_ITEMS" }));

          // 3) validar stock
          for (const it of items) {
            const stock = Number(it.stock_actual) || 0;
            const cant = Number(it.cantidad) || 0;
            if (cant <= 0) return rollback(Object.assign(new Error("Cantidad inválida"), { code: "CANT_INVALIDA" }));
            if (stock < cant) {
              return rollback(Object.assign(new Error("Stock insuficiente"), {
                code: "STOCK_INSUFICIENTE",
                detalle: { producto_id: it.producto_id, stock_actual: stock, solicitado: cant }
              }));
            }
          }

          // 4) descontar stock
          let i = 0;
          const next = () => {
            if (i >= items.length) {
              // 5) confirmar pedido
              const qUpd = `
                UPDATE carritos
                SET estado = 'confirmado', actualizado_en = NOW()
                WHERE id = ?
              `;
              return conn.query(qUpd, [id_pedido], (e5) => {
                if (e5) return rollback(e5);
                conn.commit((eCommit) => {
                  if (eCommit) return rollback(eCommit);
                  conn.release();
                  callback(null);
                });
              });
            }

            const it = items[i++];
            conn.query(
              `UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?`,
              [it.cantidad, it.producto_id],
              (e4) => {
                if (e4) return rollback(e4);
                next();
              }
            );
          };

          next();
        });
      });
    });
  });
},

};
