function ensureAuthenticated(req, res, next) {
    console.log('Usuario autenticado: ', req.session.usuario)
    if (req.session.usuario) {
        return next();
    } else {
        // Redirige al usuario a la página de inicio de sesión si no está autenticado
        res.redirect('/users/login');
    }
}
module.exports = ensureAuthenticated;