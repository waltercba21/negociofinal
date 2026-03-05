const adminEmails = require('../config/admins');

module.exports = (req, res, next) => {
  res.locals.isAdminUser = !!(
    req.session.usuario && adminEmails.includes(req.session.usuario.email)
  );
  next();
};