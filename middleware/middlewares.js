// middlewares.js
const adminEmails = ['walter@autofaros.com.ar', 'chacho@autofaros.com.ar', 'gera@autofaros.com.ar'];

module.exports = {
  setGlobalVariables: (req, res, next) => {
    res.locals.isLogged = req.session.usuario ? true : false;
    res.locals.isAdminUser = req.session.usuario && adminEmails.includes(req.session.usuario.email);
    next();
  }
};