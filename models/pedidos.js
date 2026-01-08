const pool = require('../config/conexion');

module.exports = {
  // ✅ Solo pedidos reales: excluye carritos abiertos
  obtenerPedidos: (callback) => {
    const query = `
      SELECT 
        c.id AS id_pedido,
        CONCAT(u.nombre, ' ', IFNULL(u.apellido,'')) AS cliente,
        c.usuario_id,
        c.estado,
        c.tipo_envio,
        COALESCE(SUM(pc.cantidad * p.precio_venta), 0) AS total,
        COALESCE(c.actualizado_en, c.creado_en) AS fecha
      FROM carritos c
      JOIN usuarios u ON c.usuario_id = u.id
      LEFT JOIN productos_carrito pc ON c.id = pc.carrito_id
      LEFT JOIN productos p ON pc.producto_id = p.id
      WHERE c.estado <> 'carrito'
      GROUP BY c.id, u.nombre, u.apellido, c.usuario_id, c.estado, c.tipo_envio, c.actualizado_en, c.creado_en
      ORDER BY fecha DESC;
    `;

    pool.query(query, (error, resultados) => {
      if (error) {
        console.error("❌ Error al obtener pedidos:", error);
        return callback(error, null);
      }
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
      SELECT u.nombre AS cliente, c.creado_en AS fecha,
             pp_min.codigo, p.nombre AS nombre_producto, pc.cantidad, p.precio_venta,
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

      const cliente = resultados[0].cliente;
      const fecha = resultados[0].fecha;
      let total = 0;

      const productos = resultados.map(r => {
        total += Number(r.subtotal || 0);
        return {
          codigo: r.codigo || 'SIN CÓDIGO',
          nombre: r.nombre_producto,
          cantidad: r.cantidad,
          precio_unitario: r.precio_venta,
          subtotal: r.subtotal
        };
      });

      callback(null, { cliente, fecha, total, productos });
    });
  },

  // ✅ Contador de “pedidos a atender” (excluye carrito y finalizado)
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
  }
};
