// Array de correos electrónicos de administradores
const adminEmails = ['walter@autofaros.com.ar', 'chacho@autofaros.com.ar', 'gera@autofaros.com.ar'];

module.exports = (req, res, next) => {
  // Verificar si el usuario es el administrador
  const isAdminUser = (
    req.session.usuario && adminEmails.includes(req.session.usuario.email) ||
    req.session.isAdminUser // Nueva condición para manejar al admin incluso si no ha iniciado sesión
  );

  // Agregar una propiedad al objeto res.locals para usar en las vistas
  res.locals.isAdminUser = isAdminUser;

  // Continuar con la solicitud
  next();
};