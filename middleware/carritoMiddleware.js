const carrito = require('../models/carrito'); // Ajusta la ruta según tu estructura

const calcularCantidadCarrito = async (req, res, next) => {
    res.locals.cantidadCarrito = 0; // Por defecto, 0

    if (req.session && req.session.usuario) {
        try {
            const id_usuario = req.session.usuario.id;

            // Obtener el carrito activo del usuario
            const carritoActivo = await new Promise((resolve, reject) => {
                carrito.obtenerCarritoActivo(id_usuario, (error, carrito) => {
                    if (error) {
                        console.error('Error al obtener el carrito activo:', error);
                        return reject(error);
                    }
                    resolve(carrito);
                });
            });

            if (carritoActivo && carritoActivo.length > 0) {
                const id_carrito = carritoActivo[0].id;

                // Obtener los productos del carrito
                const productosCarrito = await new Promise((resolve, reject) => {
                    carrito.obtenerProductosCarrito(id_carrito, (error, productos) => {
                        if (error) {
                            console.error('Error al obtener productos del carrito:', error);
                            return reject(error);
                        }
                        resolve(productos);
                    });
                });

                // Contar los ítems únicos (no la suma de cantidades)
                if (productosCarrito) {
                    res.locals.cantidadCarrito = productosCarrito.length;
                }
            }
        } catch (error) {
            console.error('Error en calcularCantidadCarrito:', error);
        }
    }

    next(); // Continuar con el siguiente middleware o controlador
};

module.exports = calcularCantidadCarrito;
