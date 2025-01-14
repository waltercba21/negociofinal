// middleware/adminMiddleware.js

module.exports = (req, res, next) => {
  // Verificar si el usuario es el administrador
  const isAdminUser = req.session.usuario && req.session.usuario.isAdmin;

  // Agregar una propiedad al objeto res.locals para usar en las vistas
  res.locals.isAdminUser = isAdminUser;

  // Continuar con la solicitud
  next();
};
