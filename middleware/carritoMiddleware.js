const pool = require('../config/db'); // Ajusta según tu conexión a la base de datos.

const calcularCantidadCarrito = (req, res, next) => {
    if (!req.session.usuario) {
        res.locals.cantidadProductosCarrito = 0;
        return next();
    }

    const usuarioId = req.session.usuario.id;
    const query = `
        SELECT SUM(pc.cantidad) AS total
        FROM productos_carrito pc
        JOIN carritos c ON pc.carrito_id = c.id
        WHERE c.usuario_id = ? AND c.estado = 'activo'
    `;

    pool.query(query, [usuarioId], (error, resultados) => {
        if (error) {
            console.error("Error al calcular el carrito:", error);
            res.locals.cantidadProductosCarrito = 0;
        } else {
            res.locals.cantidadProductosCarrito = resultados[0].total || 0;
        }
        next();
    });
};

module.exports = calcularCantidadCarrito;
