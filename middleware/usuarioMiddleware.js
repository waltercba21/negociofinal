function ensureAuthenticated(req, res, next) {
    console.log('Usuario autenticado:', req.session.usuario);
    if (req.session.usuario) {
      return next();
    }
    res.redirect('/users/login');
  }
  
module.exports = ensureAuthenticated;