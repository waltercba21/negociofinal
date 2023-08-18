// middlewares.js
module.exports = {
    setGlobalVariables: (req, res, next) => {
      res.locals.isLogged = req.session.usuario ? true : false;
      res.locals.isAdminUser = req.session.usuario && req.session.usuario.email === 'waltercordobadev@gmail.com';
      next();
    }
  };
  