// middlewares/adminMiddleware.js

module.exports = (req, res, next) => {
  // Verificar si el usuario es el administrador (puedes usar el criterio que prefieras)
  const isAdminUser = (
    (req.session.usuario && req.session.usuario.email === 'waltercordobadev@gmail.com') ||
    req.session.isAdminUser // Nueva condición para manejar al admin incluso si no ha iniciado sesión
  );

  // Agregar una propiedad al objeto res.locals para usar en las vistas
  res.locals.isAdminUser = isAdminUser;

  // Continuar con la solicitud
  next();
};
