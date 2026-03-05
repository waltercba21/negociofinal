const adminEmails = require('../config/admins');

module.exports = {
  setGlobalVariables: (req, res, next) => {
    res.locals.isLogged = !!req.session.usuario;
    res.locals.isAdminUser = req.session.usuario && adminEmails.includes(req.session.usuario.email);
    next();
  }
};