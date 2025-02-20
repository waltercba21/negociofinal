const carrito = require('../models/carrito'); // Ajusta la ruta si es necesario

const calcularCantidadCarrito = (req, res, next) => {
    if (!req.session.usuario) {
        res.locals.cantidadProductosCarrito = 0;
        return next();
    }

    const id_usuario = req.session.usuario.id;

    carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
        if (error || carritoActivo.length === 0) {
            res.locals.cantidadProductosCarrito = 0;
            return next();
        }

        const id_carrito = carritoActivo[0].id;

        carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
            if (error) {
                res.locals.cantidadProductosCarrito = 0;
                return next();
            }

            // Calcula la cantidad total de productos en el carrito
            const cantidadTotal = productos.reduce((acc, p) => acc + p.cantidad, 0);
            res.locals.cantidadProductosCarrito = cantidadTotal;
            next();
        });
    });
};

module.exports = calcularCantidadCarrito;
